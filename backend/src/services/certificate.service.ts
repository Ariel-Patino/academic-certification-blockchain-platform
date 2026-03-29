import {
  getCertificateByHash,
  getCertificateById,
  getConfiguredSignerAddress,
  getRevocationByCertificateId,
  issueCertificateOnChain,
  revokeCertificateOnChain,
  verifyCertificateOnChain
} from "./blockchain.service";
import {
  getCertificateRecordByHash,
  markCertificateAsReplaced,
  persistCertificateRecord
} from "./certificatePersistence.service";
import {
  buildHashAnchorDocument,
  hashCertificateData,
  signCertificateHash,
  buildVerificationMethodUrl,
  validateOpenBadgesV2Schema
} from "./hashing.service";
import { uploadJsonToIpfs } from "./ipfs.service";
import { createHash, randomBytes, randomUUID } from "crypto";

import {
  AcademicCertificateDocument,
  BlockchainRevokeResult,
  CertificatePayload,
  CertificateProof,
  IssueCertificateData,
  IssueCertificateInput,
  RevokeCertificateInput,
  ServiceResult
} from "../types";
import { AppError, NotFoundError, ValidationError } from "../utils/errors";
import { env } from "../config/env";

const buildCertificatePayload = (input: IssueCertificateInput): CertificatePayload => {
  return {
    studentName: String(input.studentName || "").trim(),
    studentId: String(input.studentId || "").trim(),
    programName: String(input.programName || "").trim(),
    institutionName: String(input.institutionName || "").trim(),
    issuedAt: input.issuedAt?.trim() || new Date().toISOString()
  };
};

const assertRequiredPayloadFields = (payload: CertificatePayload): void => {
  if (!payload.studentName) {
    throw new Error("studentName is required.");
  }
  if (!payload.studentId) {
    throw new Error("studentId is required.");
  }
  if (!payload.programName) {
    throw new Error("programName is required.");
  }
  if (!payload.institutionName) {
    throw new Error("institutionName is required.");
  }
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashRecipientEmail = (recipientEmail: string, salt: string): string => {
  const normalizedEmail = String(recipientEmail || "").trim().toLowerCase();

  if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
    throw new Error("recipientEmail must be a valid email address.");
  }

  if (!salt) {
    throw new Error("recipient salt is required.");
  }

  const digest = createHash("sha256").update(`${normalizedEmail}:${salt}`, "utf8").digest("hex");
  return `0x${digest}`;
};

export const issueCertificate = async (
  input: IssueCertificateInput
): Promise<ServiceResult<IssueCertificateData>> => {
  const certificatePayload = buildCertificatePayload(input);
  assertRequiredPayloadFields(certificatePayload);

  const certificateId = input.certificateId?.trim() || `cert-${Date.now()}`;

  // Re-issuance: validate the certificate to be replaced before generating any data.
  const REPLACE_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
  let replacesCertificateHash: string | null = null;
  let oldCertificateIdForRevocation: string | null = null;

  if (input.replacesCertificateHash) {
    const prevHash = String(input.replacesCertificateHash || "").trim().toLowerCase();
    if (!REPLACE_HASH_REGEX.test(prevHash)) {
      throw new ValidationError("replacesCertificateHash format is invalid. Expected 0x-prefixed SHA-256 hex.");
    }
    const prevOnChainStatus = await verifyCertificateOnChain(prevHash);
    if (!prevOnChainStatus.exists) {
      throw new ValidationError("replacesCertificateHash: original certificate not found on-chain.");
    }
    if (prevOnChainStatus.status !== "Valid") {
      throw new ValidationError(`replacesCertificateHash: original certificate is ${prevOnChainStatus.status} and cannot be replaced.`);
    }
    const prevDbRecord = await getCertificateRecordByHash(prevHash);
    if (prevDbRecord?.replacedByHash) {
      throw new ValidationError(`replacesCertificateHash: certificate has already been replaced by ${prevDbRecord.replacedByHash}.`);
    }
    const prevOnChainRecord = await getCertificateByHash(prevHash);
    replacesCertificateHash = prevHash;
    oldCertificateIdForRevocation = prevOnChainRecord.id;
  }

  // GDPR Privacy: generate a cryptographically unique 256-bit salt per certificate.
  // This salt is stored ONLY inside the JSON-LD document given to the certificate holder.
  // It is never persisted in the database or the blockchain, making reversal of
  // recipientEmailHash impossible without the original credential file.
  const recipientSalt = randomBytes(32).toString("hex"); // 64 hex chars, 256-bit entropy
  const recipientIdentityHash = hashRecipientEmail(input.recipientEmail, recipientSalt);

  const frontendBase = env.frontendBaseUrl.replace(/\/$/, "");
  const documentId = `urn:uuid:${randomUUID()}`;
  const signerAddress = getConfiguredSignerAddress();

  const badge = {
    name: certificatePayload.programName,
    description:
      input.badgeDescription?.trim() ||
      `Academic certificate issued by ${certificatePayload.institutionName} for ${certificatePayload.programName}.`,
    issuer: {
      name: certificatePayload.institutionName,
      url: input.issuerUrl?.trim() || "https://example.edu"
    }
  };

  const recipient = {
    type: "email" as const,
    identity: recipientIdentityHash,
    salt: recipientSalt,
    hashed: true as const
  };

  const status = {
    current: "Valid" as const,
    revocationReason: null,
    revokedAt: null,
    revokedBy: null
  };

  // Build verification with Open Badges v2 compliant verificationMethod
  // Points to blockchain Smart Contract method capable of verifying proof
  const verification = {
    type: "BlockchainSignature" as const,
    publicKey: signerAddress,
    verificationMethod: buildVerificationMethodUrl("polygon", env.contractAddress, "verifyCertificate")
  };

  const provisionalHashAnchor = buildHashAnchorDocument({
    id: documentId,
    issuedOn: certificatePayload.issuedAt,
    badge,
    verification,
    recipient,
    status,
    normalizedPayload: certificatePayload,
    replacesCertificateHash: replacesCertificateHash || undefined
  });

  // Validate hash anchor against Open Badges v2 schema BEFORE hashing
  const schemaValidation = validateOpenBadgesV2Schema(provisionalHashAnchor);
  if (!schemaValidation.valid) {
    throw new Error(`Certificate document does not comply with Open Badges v2 schema: ${schemaValidation.errors.join("; ")}`);
  }

  const certificateHash = hashCertificateData(provisionalHashAnchor);

  const { signatureValue } = await signCertificateHash(certificateHash);
  const resolvedVerificationUrl = `${frontendBase}/verify?hash=${encodeURIComponent(certificateHash)}`;

  // Build proof with Open Badges v2 compliant verificationMethod
  const proof: CertificateProof = {
    certificateHash,
    hashAlgorithm: "SHA-256",
    signatureType: "EthereumPersonalSign",
    signatureValue,
    signerAddress,
    verificationMethod: buildVerificationMethodUrl("polygon", env.contractAddress, "verifyCertificate")
  };

  const provisionalDocument = {
    "@context": "https://w3id.org/openbadges/v2",
    id: documentId,
    type: "Assertion",
    issuedOn: certificatePayload.issuedAt,
    verificationUrl: resolvedVerificationUrl,
    badge,
    verification,
    recipient,
    proof: {
      ...proof,
      normalizedPayload: certificatePayload
    },
    blockchain: {
      network: `chain-${env.chainId}`,
      chainId: env.chainId,
      contractAddress: env.contractAddress,
      transactionHash: "pending",
      certificateId: "pending",
      metadataURI: "ipfs://pending"
    },
    status,
    ...(replacesCertificateHash ? { replacesCertificateHash } : {})
  };

  const { cid: ipfsCID, metadataURI } = await uploadJsonToIpfs(provisionalDocument, {
    name: `academic-certificate-${certificateHash.slice(2, 14)}`
  });

  const expiryDate = Number.isInteger(input.expiryDate) ? Number(input.expiryDate) : 0;
  const expirationDate = expiryDate > 0 ? new Date(expiryDate * 1000) : null;

  const blockchainResult = await issueCertificateOnChain({
    certificateId,
    certificateHash,
    recipient: input.recipient?.trim() || signerAddress,
    certType: Number.isInteger(input.certType) ? Number(input.certType) : 0,
    programName: certificatePayload.programName,
    expiryDate,
    metadataURI
  });

  await persistCertificateRecord({
    certificateHash,
    issuerAddress: signerAddress,
    recipientEmailHash: recipientIdentityHash,
    expirationDate,
    status: "Valid",
    ipfsCID,
    metadataURI,
    certificateId: blockchainResult.certificateId,
    txHash: blockchainResult.txHash,
    replacesCertificateHash: replacesCertificateHash || null
  });

  // Revoke the replaced certificate on-chain (backend-custodial for re-issuance).
  // Runs AFTER the new certificate is anchored so the new one is guaranteed to exist.
  let previousCertificateRevoked = false;
  if (replacesCertificateHash && oldCertificateIdForRevocation) {
    try {
      await revokeCertificateOnChain(oldCertificateIdForRevocation, "Reemisión: corrección de datos");
      await markCertificateAsReplaced(replacesCertificateHash, certificateHash);
      previousCertificateRevoked = true;
    } catch (revokeError) {
      // Log but do not abort — the new certificate is already anchored on-chain.
      // The issuer can manually revoke the old certificate from the Invalidar panel.
      console.error("[certificate.service] Auto-revocation of replaced certificate failed:", revokeError);
    }
  }

  const document: AcademicCertificateDocument = {
    "@context": "https://w3id.org/openbadges/v2",
    id: documentId,
    type: "Assertion",
    issuedOn: certificatePayload.issuedAt,
    verificationUrl: resolvedVerificationUrl,
    badge,
    verification,
    recipient,
    proof: {
      ...proof,
      normalizedPayload: certificatePayload
    },
    blockchain: {
      network: `chain-${blockchainResult.chainId}`,
      chainId: blockchainResult.chainId,
      contractAddress: blockchainResult.contractAddress,
      transactionHash: blockchainResult.txHash,
      certificateId: blockchainResult.certificateId,
      metadataURI
    },
    status: {
      current: "Valid",
      revocationReason: null,
      revokedAt: null,
      revokedBy: null
    },
    replacesCertificateHash: replacesCertificateHash || null
  };

  return {
    success: true,
    message: replacesCertificateHash
      ? "Certificate re-issued successfully. The previous certificate has been revoked."
      : "Certificate issued successfully.",
    data: {
      certificate: certificatePayload,
      document,
      certificateHash,
      verificationUrl: resolvedVerificationUrl,
      metadataURI,
      proof,
      blockchain: blockchainResult,
      replacesCertificateHash: replacesCertificateHash || null,
      previousCertificateRevoked
    }
  };
};

const normalizeCertificateId = (certificateIdInput: string): string => {
  const certificateId = String(certificateIdInput || "").trim();

  if (!/^\d+$/.test(certificateId) || certificateId === "0") {
    throw new ValidationError("certificateId must be a positive integer.");
  }

  return certificateId;
};

const mapRevocationDetails = async (certificateId: string) => {
  try {
    const revocation = await getRevocationByCertificateId(certificateId);

    return {
      certificateId,
      reason: revocation.reason,
      revokedAt: revocation.revocationDate
        ? new Date(Number(revocation.revocationDate) * 1000).toISOString()
        : null,
      revokedBy: revocation.revokedBy
    };
  } catch {
    return {
      certificateId,
      reason: null,
      revokedAt: null,
      revokedBy: null
    };
  }
};

export const revokeCertificate = async (
  input: RevokeCertificateInput
): Promise<ServiceResult<BlockchainRevokeResult>> => {
  const certificateId = normalizeCertificateId(input.certificateId);
  const reason = String(input.reason || "").trim();
  const issuerAddress = String(input.issuerAddress || "").trim().toLowerCase();

  if (!reason) {
    throw new ValidationError("reason is required.");
  }

  if (!issuerAddress) {
    throw new ValidationError("Authenticated issuer address is required.");
  }

  const signerAddress = getConfiguredSignerAddress();
  if (!signerAddress || issuerAddress !== signerAddress) {
    throw new AppError(
      "Authenticated issuer is not authorized to sign revocation transactions.",
      403,
      "FORBIDDEN"
    );
  }

  let certificate;
  try {
    certificate = await getCertificateById(certificateId);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Certificate not found")) {
      throw new NotFoundError("Certificate not found.");
    }

    throw error;
  }

  if (certificate.issuer.toLowerCase() !== issuerAddress) {
    throw new AppError("Authenticated issuer did not issue this certificate.", 403, "FORBIDDEN");
  }

  if (certificate.status === "Revoked") {
    const details = await mapRevocationDetails(certificateId);
    const reasonMessage = details.reason || "razon no disponible";

    throw new AppError(`Revocado por ${reasonMessage}.`, 409, "REVOKED", details);
  }

  const blockchainResult = await revokeCertificateOnChain(certificateId, reason);

  return {
    success: true,
    message: "Certificate revoked successfully.",
    data: blockchainResult
  };
};
