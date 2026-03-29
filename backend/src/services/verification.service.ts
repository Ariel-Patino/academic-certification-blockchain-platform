// Handles certificate verification business logic without coupling to HTTP concerns.
import {
  getCertificateByHash,
  getIssuerByAddress,
  getRevocationByCertificateId,
  isIssuerAuthorizedOnChain,
  verifyCertificateOnChain
} from "./blockchain.service";
import { createHash } from "crypto";
import { verifyCertificateProof, validateOpenBadgesV2Schema } from "./hashing.service";
import { getCertificateRecordByHash } from "./certificatePersistence.service";
import {
  CertificateDocumentVerificationResult,
  CertificateProofVerificationInput,
  CertificateProofVerificationResult,
  ServiceResult,
  VerificationResult
} from "../types";
import { AppError } from "../utils/errors";

const HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const MAX_ISSUED_AT_SKEW_SECONDS = 300;

export const hashRecipientEmailWithSalt = (recipientEmail: string, salt: string): string => {
  const normalizedEmail = String(recipientEmail || "").trim().toLowerCase();
  const normalizedSalt = String(salt || "").trim();

  if (!normalizedEmail || !normalizedEmail.includes("@") || !normalizedSalt) {
    throw new Error("Invalid recipient email or salt for identity validation.");
  }

  const digest = createHash("sha256").update(`${normalizedEmail}:${normalizedSalt}`, "utf8").digest("hex");
  return `0x${digest}`;
};

export const computeRecipientIdentityMatch = (
  recipientEmail?: string | null,
  recipientSalt?: string | null,
  recipientIdentity?: string | null
): boolean | null => {
  if (!recipientEmail || !recipientSalt || !recipientIdentity) {
    return null;
  }

  try {
    const recomputedIdentity = hashRecipientEmailWithSalt(recipientEmail, recipientSalt).toLowerCase();
    return recomputedIdentity === recipientIdentity.toLowerCase();
  } catch {
    return false;
  }
};

const buildValidationError = (
  code: string | null
): { validationErrorCode: string | null; validationErrorMessage: string | null } => {
  switch (code) {
    case "SCHEMA_VALIDATION_FAILED":
      return {
        validationErrorCode: code,
        validationErrorMessage: "El certificado no cumple con el estandar Open Badges v2."
      };
    case "INTEGRITY_MISMATCH":
      return {
        validationErrorCode: code,
        validationErrorMessage: "El hash del archivo no coincide con el hash anclado en blockchain."
      };
    case "AUTHENTICITY_ERROR":
      return {
        validationErrorCode: code,
        validationErrorMessage: "La firma no pertenece al emisor autorizado para este certificado."
      };
    case "ISSUER_NOT_AUTHORIZED":
      return {
        validationErrorCode: code,
        validationErrorMessage: "El emisor esta suspendido o no verificado por el administrador."
      };
    case "TIMESTAMP_MISMATCH":
      return {
        validationErrorCode: code,
        validationErrorMessage: "La fecha de emision del JSON no es consistente con la registrada en blockchain."
      };
    case "RECIPIENT_IDENTITY_MISMATCH":
      return {
        validationErrorCode: code,
        validationErrorMessage: "El email proporcionado no corresponde con la identidad hasheada del certificado."
      };
    case "REVOKED":
      return {
        validationErrorCode: code,
        validationErrorMessage: "El certificado fue revocado."
      };
    case "EXPIRED":
      return {
        validationErrorCode: code,
        validationErrorMessage: "El certificado esta expirado."
      };
    case "NOT_FOUND":
      return {
        validationErrorCode: code,
        validationErrorMessage: "El certificado no existe en blockchain."
      };
    default:
      return {
        validationErrorCode: null,
        validationErrorMessage: null
      };
  }
};

const validateCertificateHash = (certificateHash: string): string => {
  const normalizedHash = String(certificateHash || "").trim();

  if (!normalizedHash) {
    throw new Error("certificateHash is required.");
  }

  if (!HASH_REGEX.test(normalizedHash)) {
    throw new Error("Invalid certificate hash format. Expected 0x-prefixed SHA-256 hex.");
  }

  return normalizedHash.toLowerCase();
};

export const verifyCertificate = async (
  certificateHashInput: string
): Promise<ServiceResult<VerificationResult>> => {
  const certificateHash = validateCertificateHash(certificateHashInput);
  const verification = await verifyCertificateOnChain(certificateHash);
  const onChainCertificate = verification.exists
    ? await getCertificateByHash(certificateHash)
    : null;

  if (verification.exists && verification.status === "Revoked") {
    const revocation = await getRevocationByCertificateId(onChainCertificate!.id);
    const dbRevokedRecord = await getCertificateRecordByHash(certificateHash);

    throw new AppError(`Revocado por ${revocation.reason}.`, 409, "REVOKED", {
      certificateId: onChainCertificate!.id,
      certificateHash,
      issuedAt: onChainCertificate?.issuedDate
        ? new Date(Number(onChainCertificate.issuedDate) * 1000).toISOString()
        : null,
      studentId: null,
      reason: revocation.reason,
      revokedAt: revocation.revocationDate
        ? new Date(Number(revocation.revocationDate) * 1000).toISOString()
        : null,
      revokedBy: revocation.revokedBy,
      replacedByHash: dbRevokedRecord?.replacedByHash || null
    });
  }

  const issuerProfile = verification.exists && verification.issuer
    ? await getIssuerByAddress(verification.issuer)
    : null;

  const dbRecord = await getCertificateRecordByHash(certificateHash);

  return {
    success: true,
    message: verification.exists ? "Certificate verification completed." : "Certificate was not found on-chain.",
    data: {
      ...verification,
      certificateHash,
      issuedAt: onChainCertificate?.issuedDate
        ? new Date(Number(onChainCertificate.issuedDate) * 1000).toISOString()
        : null,
      studentId: null,
      issuerName: issuerProfile?.name || null,
      replacedByHash: dbRecord?.replacedByHash || null
    }
  };
};

export const verifyCertificateDocumentProof = (
  input: CertificateProofVerificationInput
): ServiceResult<CertificateProofVerificationResult> => {
  const verification = verifyCertificateProof(
    input.normalizedPayload,
    input.proof,
    input.hashAnchorDocument || null
  );

  const isProofValid = verification.hashMatches && verification.signatureValid && verification.signerMatches;

  return {
    success: true,
    message: isProofValid
      ? "Certificate proof verification completed successfully."
      : "Certificate proof verification failed.",
    data: verification
  };
};

export const verifyCertificateDocument = async (
  input: CertificateProofVerificationInput
): Promise<ServiceResult<CertificateDocumentVerificationResult>> => {
  // Validate Open Badges v2 schema compliance FIRST
  // This ensures certificate document structure is valid before cryptographic verification
  if (input.hashAnchorDocument) {
    const schemaValidation = validateOpenBadgesV2Schema(input.hashAnchorDocument);
    if (!schemaValidation.valid) {
      throw new AppError(
        `Certificate documents does not comply with Open Badges v2 schema: ${schemaValidation.errors.join("; ")}`,
        400
      );
    }
  }

  const proofVerification = verifyCertificateProof(
    input.normalizedPayload,
    input.proof,
    input.hashAnchorDocument || null
  );
  const certificateHash = validateCertificateHash(input.proof.certificateHash);
  const onChainVerification = await verifyCertificateOnChain(certificateHash);
  const onChainCertificate = onChainVerification.exists
    ? await getCertificateByHash(certificateHash)
    : null;
  const issuerProfile = onChainVerification.exists && onChainVerification.issuer
    ? await getIssuerByAddress(onChainVerification.issuer)
    : null;
  const issuerAuthorized = onChainVerification.exists && onChainVerification.issuer
    ? await isIssuerAuthorizedOnChain(onChainVerification.issuer)
    : false;

  const recoveredSigner = proofVerification.recoveredSigner?.toLowerCase() || null;
  const issuerAddress = onChainVerification.issuer.toLowerCase();
  const issuerMatchesOnChain = Boolean(recoveredSigner) && recoveredSigner === issuerAddress;

  const issuedAtUnixSeconds = Math.floor(Date.parse(input.normalizedPayload.issuedAt) / 1000);
  const onChainIssuedDate = onChainCertificate ? Number(onChainCertificate.issuedDate) : NaN;
  const issuedAtSkewSeconds =
    Number.isFinite(issuedAtUnixSeconds) && Number.isFinite(onChainIssuedDate)
      ? Math.abs(issuedAtUnixSeconds - onChainIssuedDate)
      : null;
  const issuedAtConsistent = issuedAtSkewSeconds !== null && issuedAtSkewSeconds <= MAX_ISSUED_AT_SKEW_SECONDS;
  const onChainIssuedAt = Number.isFinite(onChainIssuedDate)
    ? new Date(onChainIssuedDate * 1000).toISOString()
    : null;

  const recipientIdentityMatchesProvidedEmail = computeRecipientIdentityMatch(
    input.recipientEmail,
    input.recipientSalt,
    input.recipientIdentity
  );

  // Look up DB record for version/replacement metadata
  const persistenceRecord = await getCertificateRecordByHash(certificateHash);
  const replacedByHash = persistenceRecord?.replacedByHash || null;
  const replacesCertificateHashFromInput = input.replacesCertificateHash || null;

  const revoked = onChainVerification.status === "Revoked";
  const revocation = revoked && onChainCertificate
    ? await getRevocationByCertificateId(onChainCertificate.id)
    : null;

  const issuerOperationallyAuthorized = Boolean(
    issuerAuthorized && issuerProfile && issuerProfile.status === "Active" && issuerProfile.isVerified
  );

  let validationErrorCode: string | null = null;
  if (!onChainVerification.exists) {
    validationErrorCode = "NOT_FOUND";
  } else if (revoked) {
    validationErrorCode = "REVOKED";
  } else if (onChainVerification.status === "Expired") {
    validationErrorCode = "EXPIRED";
  } else if (!proofVerification.hashMatches) {
    validationErrorCode = "INTEGRITY_MISMATCH";
  } else if (!proofVerification.signatureValid || !issuerMatchesOnChain) {
    validationErrorCode = "AUTHENTICITY_ERROR";
  } else if (!issuerOperationallyAuthorized) {
    validationErrorCode = "ISSUER_NOT_AUTHORIZED";
  } else if (!issuedAtConsistent) {
    validationErrorCode = "TIMESTAMP_MISMATCH";
  } else if (recipientIdentityMatchesProvidedEmail === false) {
    validationErrorCode = "RECIPIENT_IDENTITY_MISMATCH";
  }

  const validationError = buildValidationError(validationErrorCode);

  if (revoked) {
    return {
      success: true,
      message: `Certificate is revoked: ${revocation?.reason || "Revoked"}.`,
      data: {
        certificateHash,
        programName: input.normalizedPayload.programName,
        institutionName: input.normalizedPayload.institutionName,
        studentId: input.normalizedPayload.studentId,
        recipientIdentity: input.recipientIdentity || null,
        recipientSalt: input.recipientSalt || null,
        recipientIdentityMatchesProvidedEmail,
        issuedAt: input.normalizedPayload.issuedAt,
        onChainIssuedAt,
        hashMatches: proofVerification.hashMatches,
        signatureValid: proofVerification.signatureValid,
        recoveredSigner: proofVerification.recoveredSigner,
        signerMatches: proofVerification.signerMatches,
        issuerMatchesOnChain,
        issuerName: issuerProfile?.name || null,
        issuerStatus: issuerProfile?.status || null,
        issuerVerified: issuerProfile?.isVerified ?? null,
        issuerAuthorized,
        issuedAtConsistent,
        issuedAtSkewSeconds,
        onChainExists: onChainVerification.exists,
        onChainValid: false,
        issuer: onChainVerification.issuer,
        recipient: onChainVerification.recipient,
        status: onChainVerification.status,
        revocationReason: revocation?.reason || "Revoked",
        revokedAt: revocation?.revocationDate ? new Date(Number(revocation.revocationDate) * 1000).toISOString() : null,
        revokedBy: revocation?.revokedBy || null,
        validationErrorCode: "REVOKED",
        validationErrorMessage: buildValidationError("REVOKED").validationErrorMessage,
        overallValid: false,
        replacesCertificateHash: replacesCertificateHashFromInput,
        replacedByHash
      }
    };
  }

  const overallValid =
    proofVerification.hashMatches &&
    proofVerification.signatureValid &&
    issuerMatchesOnChain &&
    issuerOperationallyAuthorized &&
    issuedAtConsistent &&
    recipientIdentityMatchesProvidedEmail !== false &&
    onChainVerification.exists &&
    onChainVerification.isValid;

  return {
    success: true,
    message: overallValid
      ? "Certificate document verification completed successfully."
      : "Certificate document verification failed.",
    data: {
      certificateHash,
      programName: input.normalizedPayload.programName,
      institutionName: input.normalizedPayload.institutionName,
      studentId: input.normalizedPayload.studentId,
      recipientIdentity: input.recipientIdentity || null,
      recipientSalt: input.recipientSalt || null,
      recipientIdentityMatchesProvidedEmail,
      issuedAt: input.normalizedPayload.issuedAt,
      onChainIssuedAt,
      hashMatches: proofVerification.hashMatches,
      signatureValid: proofVerification.signatureValid,
      recoveredSigner: proofVerification.recoveredSigner,
      signerMatches: proofVerification.signerMatches,
      issuerMatchesOnChain,
      issuerName: issuerProfile?.name || null,
      issuerStatus: issuerProfile?.status || null,
      issuerVerified: issuerProfile?.isVerified ?? null,
      issuerAuthorized,
      issuedAtConsistent,
      issuedAtSkewSeconds,
      onChainExists: onChainVerification.exists,
      onChainValid: onChainVerification.isValid,
      issuer: onChainVerification.issuer,
      recipient: onChainVerification.recipient,
      status: onChainVerification.status,
      revocationReason: null,
      revokedAt: null,
      revokedBy: null,
      validationErrorCode: validationError.validationErrorCode,
      validationErrorMessage: validationError.validationErrorMessage,
      overallValid,
      replacesCertificateHash: replacesCertificateHashFromInput,
      replacedByHash
    }
  };
};
