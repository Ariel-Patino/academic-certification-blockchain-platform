import { Request, Response, NextFunction } from "express";

import { verifyCertificate, verifyCertificateDocument } from "../services/verification.service";
import { createSuccessResponse } from "../utils/apiResponse";
import { ValidationError } from "../utils/errors";
import {
  CertificatePayload,
  CertificateProof,
  HashAnchorableCertificateDocument
} from "../types";

const HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const extractCertificateHash = (request: Request): string => {
  const queryHash = typeof request.query.certificateHash === "string" ? request.query.certificateHash : "";
  const bodyHash = typeof request.body?.certificateHash === "string" ? request.body.certificateHash : "";
  const certificateHash = (queryHash || bodyHash).trim();

  if (!certificateHash) {
    throw new ValidationError("certificateHash is required.");
  }

  if (!HASH_REGEX.test(certificateHash)) {
    throw new ValidationError("Invalid certificateHash format. Expected 0x-prefixed SHA-256 hex.");
  }

  return certificateHash.toLowerCase();
};

export const verifyCertificateByHash = async (request: Request, response: Response, next: NextFunction) => {
  try {
    const certificateHash = extractCertificateHash(request);
    const result = await verifyCertificate(certificateHash);
    response.status(200).json(createSuccessResponse(result.message, result.data));
  } catch (error) {
    next(error);
  }
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const assertRequiredString = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${fieldName} is required.`);
  }

  return value.trim();
};

const toHashAnchorDocumentOrNull = (
  documentCandidate: Record<string, unknown>,
  normalizedPayload: CertificatePayload
): HashAnchorableCertificateDocument | null => {
  const context = typeof documentCandidate["@context"] === "string"
    ? documentCandidate["@context"].trim()
    : "";
  const id = typeof documentCandidate.id === "string" ? documentCandidate.id.trim() : "";
  const type = typeof documentCandidate.type === "string" ? documentCandidate.type.trim() : "";
  const issuedOn = typeof documentCandidate.issuedOn === "string" ? documentCandidate.issuedOn.trim() : "";

  const badge = isObjectRecord(documentCandidate.badge) ? documentCandidate.badge : null;
  const verification = isObjectRecord(documentCandidate.verification) ? documentCandidate.verification : null;
  const recipient = isObjectRecord(documentCandidate.recipient) ? documentCandidate.recipient : null;
  const status = isObjectRecord(documentCandidate.status) ? documentCandidate.status : null;

  if (
    context !== "https://w3id.org/openbadges/v2" ||
    type !== "Assertion" ||
    !id ||
    !issuedOn ||
    !badge ||
    !verification ||
    !recipient ||
    !status
  ) {
    return null;
  }

  const badgeIssuer = isObjectRecord(badge.issuer) ? badge.issuer : null;
  const badgeName = typeof badge.name === "string" ? badge.name.trim() : "";
  const badgeDescription = typeof badge.description === "string" ? badge.description.trim() : "";
  const badgeIssuerName = badgeIssuer && typeof badgeIssuer.name === "string" ? badgeIssuer.name.trim() : "";
  const badgeIssuerUrl = badgeIssuer && typeof badgeIssuer.url === "string" ? badgeIssuer.url.trim() : "";

  const verificationType =
    typeof verification.type === "string" ? verification.type.trim() : "";
  const verificationPublicKey =
    typeof verification.publicKey === "string" ? verification.publicKey.trim() : "";
  const verificationMethod =
    typeof verification.verificationMethod === "string" ? verification.verificationMethod.trim() : undefined;

  const recipientType = typeof recipient.type === "string" ? recipient.type.trim() : "";
  const recipientIdentity = typeof recipient.identity === "string" ? recipient.identity.trim() : "";
  const recipientSalt = typeof recipient.salt === "string" ? recipient.salt.trim() : "";
  const recipientHashed = recipient.hashed === true;

  const statusCurrent = typeof status.current === "string" ? status.current.trim() : "";
  const statusRevocationReason =
    status.revocationReason === null || typeof status.revocationReason === "string"
      ? status.revocationReason
      : null;
  const statusRevokedAt =
    status.revokedAt === null || typeof status.revokedAt === "string"
      ? status.revokedAt
      : null;
  const statusRevokedBy =
    status.revokedBy === null || typeof status.revokedBy === "string"
      ? status.revokedBy
      : null;

  if (
    !badgeName ||
    !badgeDescription ||
    !badgeIssuerName ||
    !badgeIssuerUrl ||
    verificationType !== "BlockchainSignature" ||
    !verificationPublicKey ||
    recipientType !== "email" ||
    !recipientIdentity ||
    !recipientSalt ||
    !recipientHashed ||
    (statusCurrent !== "Valid" && statusCurrent !== "Revoked" && statusCurrent !== "Expired")
  ) {
    return null;
  }

  return {
    "@context": "https://w3id.org/openbadges/v2",
    id,
    type: "Assertion",
    issuedOn,
    badge: {
      name: badgeName,
      description: badgeDescription,
      issuer: {
        name: badgeIssuerName,
        url: badgeIssuerUrl
      }
    },
    verification: {
      type: "BlockchainSignature",
      publicKey: verificationPublicKey,
      ...(verificationMethod ? { verificationMethod } : {})
    },
    recipient: {
      type: "email",
      identity: recipientIdentity,
      salt: recipientSalt,
      hashed: true
    },
    status: {
      current: statusCurrent as "Valid" | "Revoked" | "Expired",
      revocationReason: statusRevocationReason,
      revokedAt: statusRevokedAt,
      revokedBy: statusRevokedBy
    },
    normalizedPayload,
    ...(typeof documentCandidate.replacesCertificateHash === "string" && documentCandidate.replacesCertificateHash.trim()
      ? { replacesCertificateHash: documentCandidate.replacesCertificateHash.trim().toLowerCase() }
      : {})
  };
};

const extractDocumentVerificationInput = (request: Request): {
  normalizedPayload: CertificatePayload;
  proof: CertificateProof;
  hashAnchorDocument?: HashAnchorableCertificateDocument | null;
  recipientIdentity?: string | null;
  recipientSalt?: string | null;
  recipientEmail?: string | null;
  replacesCertificateHash?: string | null;
} => {
  const rawBody = request.body;
  const bodyRecord = isObjectRecord(rawBody) ? rawBody : null;
  const documentEnvelope = bodyRecord && isObjectRecord(bodyRecord.document) ? bodyRecord.document : null;
  const certificateEnvelope = bodyRecord && isObjectRecord(bodyRecord.certificate) ? bodyRecord.certificate : null;
  const topLevelProof = bodyRecord && isObjectRecord(bodyRecord.proof) ? bodyRecord.proof : null;

  const documentCandidate =
    documentEnvelope && topLevelProof
      ? { ...documentEnvelope, proof: documentEnvelope.proof || topLevelProof }
      : documentEnvelope
        ? documentEnvelope
        : certificateEnvelope && topLevelProof
          ? { ...certificateEnvelope, proof: topLevelProof }
      : certificateEnvelope || rawBody;

  if (!isObjectRecord(documentCandidate)) {
    throw new ValidationError("Certificate document JSON body is required.");
  }

  const proofRaw = documentCandidate.proof;
  const verificationRaw = isObjectRecord(documentCandidate.verification) ? documentCandidate.verification : null;
  const recipientRaw = isObjectRecord(documentCandidate.recipient) ? documentCandidate.recipient : null;
  if (!isObjectRecord(proofRaw)) {
    throw new ValidationError("proof object is required in certificate document.");
  }

  const normalizedPayloadRaw = proofRaw.normalizedPayload;

  const certificateRaw = isObjectRecord(documentCandidate.certificate)
    ? documentCandidate.certificate
    : isObjectRecord(bodyRecord?.certificate)
      ? bodyRecord.certificate
      : null;

  const effectiveNormalizedPayloadRaw = isObjectRecord(normalizedPayloadRaw)
    ? normalizedPayloadRaw
    : certificateRaw;

  if (!isObjectRecord(effectiveNormalizedPayloadRaw)) {
    throw new ValidationError("proof.normalizedPayload is required.");
  }

  const normalizedPayload: CertificatePayload = {
    studentName: assertRequiredString(effectiveNormalizedPayloadRaw.studentName, "proof.normalizedPayload.studentName"),
    studentId: assertRequiredString(effectiveNormalizedPayloadRaw.studentId, "proof.normalizedPayload.studentId"),
    programName: assertRequiredString(effectiveNormalizedPayloadRaw.programName, "proof.normalizedPayload.programName"),
    institutionName: assertRequiredString(effectiveNormalizedPayloadRaw.institutionName, "proof.normalizedPayload.institutionName"),
    issuedAt: assertRequiredString(effectiveNormalizedPayloadRaw.issuedAt, "proof.normalizedPayload.issuedAt")
  };

  const certificateHash = assertRequiredString(proofRaw.certificateHash, "proof.certificateHash").toLowerCase();
  if (!HASH_REGEX.test(certificateHash)) {
    throw new ValidationError("Invalid proof.certificateHash format. Expected 0x-prefixed SHA-256 hex.");
  }

  const hashAlgorithm = assertRequiredString(proofRaw.hashAlgorithm, "proof.hashAlgorithm");
  if (hashAlgorithm !== "SHA-256") {
    throw new ValidationError("Unsupported proof.hashAlgorithm. Expected SHA-256.");
  }

  const signatureType = assertRequiredString(proofRaw.signatureType, "proof.signatureType");
  if (signatureType !== "EthereumPersonalSign") {
    throw new ValidationError("Unsupported proof.signatureType. Expected EthereumPersonalSign.");
  }

  const signerAddressFromProof = typeof proofRaw.signerAddress === "string" ? proofRaw.signerAddress : "";
  const signerAddressFromVerification =
    verificationRaw && typeof verificationRaw.publicKey === "string" ? verificationRaw.publicKey : "";
  const signerAddress = assertRequiredString(
    signerAddressFromProof || signerAddressFromVerification,
    "proof.signerAddress or verification.publicKey"
  );

  const proofVerificationMethod =
    typeof proofRaw.verificationMethod === "string" ? proofRaw.verificationMethod.trim() : undefined;

  const proof: CertificateProof = {
    certificateHash,
    hashAlgorithm: "SHA-256",
    signatureType: "EthereumPersonalSign",
    signatureValue: assertRequiredString(proofRaw.signatureValue, "proof.signatureValue"),
    signerAddress,
    ...(proofVerificationMethod ? { verificationMethod: proofVerificationMethod } : {})
  };

  const recipientIdentity =
    recipientRaw && typeof recipientRaw.identity === "string" ? recipientRaw.identity.trim() : null;

  const recipientSalt =
    recipientRaw && typeof recipientRaw.salt === "string" ? recipientRaw.salt.trim() : null;

  const recipientEmail =
    bodyRecord && typeof bodyRecord.recipientEmail === "string" ? bodyRecord.recipientEmail.trim() : null;

  if (recipientEmail && !EMAIL_REGEX.test(recipientEmail)) {
    throw new ValidationError("recipientEmail must be a valid email address.");
  }

  const hashAnchorDocument = toHashAnchorDocumentOrNull(documentCandidate, normalizedPayload);

  const replacesCertificateHash =
    hashAnchorDocument?.replacesCertificateHash ||
    (typeof documentCandidate.replacesCertificateHash === "string"
      ? documentCandidate.replacesCertificateHash.trim().toLowerCase() || null
      : null);

  return { normalizedPayload, proof, hashAnchorDocument, recipientIdentity, recipientSalt, recipientEmail, replacesCertificateHash };
};

export const verifyCertificateByDocument = async (request: Request, response: Response, next: NextFunction) => {
  try {
    const input = extractDocumentVerificationInput(request);
    const result = await verifyCertificateDocument(input);
    response.status(200).json(createSuccessResponse(result.message, result.data));
  } catch (error) {
    next(error);
  }
};
