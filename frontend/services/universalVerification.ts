"use client";

import { Contract, JsonRpcProvider, getBytes, isAddress, verifyMessage } from "ethers";

import {
  POLYGON_AMOY_CHAIN_ID,
  POLYGON_AMOY_RPC_URL,
  PUBLIC_CONTRACT_ADDRESS
} from "@/lib/constants";
import { validateVerifierUpload } from "@/services/verificationSchema";

export interface HashVerificationData {
  exists: boolean;
  isValid: boolean;
  certificateHash?: string;
  issuedAt?: string | null;
  studentId?: string | null;
  issuer: string;
  issuerName?: string | null;
  recipient: string;
  status: string;
}

export interface DocumentVerificationData {
  certificateHash: string;
  programName: string;
  institutionName: string;
  studentId: string;
  recipientIdentity: string | null;
  recipientSalt: string | null;
  recipientIdentityMatchesProvidedEmail: boolean | null;
  issuedAt: string;
  onChainIssuedAt: string | null;
  hashMatches: boolean;
  signatureValid: boolean;
  signerMatches: boolean;
  recoveredSigner: string | null;
  issuerMatchesOnChain: boolean;
  issuerName: string | null;
  issuerStatus: string | null;
  issuerVerified: boolean | null;
  issuerAuthorized: boolean;
  issuedAtConsistent: boolean;
  issuedAtSkewSeconds: number | null;
  onChainExists: boolean;
  onChainValid: boolean;
  issuer: string;
  recipient: string;
  status: string;
  revocationReason: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  validationErrorCode: string | null;
  validationErrorMessage: string | null;
  overallValid: boolean;
  replacesCertificateHash: string | null;
  replacedByHash: string | null;
}

interface CertificatePayload {
  studentName: string;
  studentId: string;
  programName: string;
  institutionName: string;
  issuedAt: string;
}

interface CertificateProof {
  certificateHash: string;
  hashAlgorithm: "SHA-256";
  signatureType: "EthereumPersonalSign";
  signatureValue: string;
  signerAddress: string;
  verificationMethod?: string;
}

interface HashAnchorableCertificateDocument {
  "@context": "https://w3id.org/openbadges/v2";
  id: string;
  type: "Assertion";
  issuedOn: string;
  badge: {
    name: string;
    description: string;
    issuer: {
      name: string;
      url: string;
    };
  };
  verification: {
    type: "BlockchainSignature";
    publicKey: string;
    verificationMethod?: string;
  };
  recipient: {
    type: "email";
    identity: string;
    salt: string;
    hashed: true;
  };
  status: {
    current: "Valid" | "Revoked" | "Expired";
    revocationReason: string | null;
    revokedAt: string | null;
    revokedBy: string | null;
  };
  normalizedPayload: CertificatePayload;
  replacesCertificateHash?: string | null;
}

interface OnChainVerificationTuple {
  exists: boolean;
  isValid: boolean;
  status: bigint | number;
  issuer: string;
  recipient: string;
}

interface OnChainCertificateTuple {
  id: bigint | number | string;
  certificateHash: string;
  issuer: string;
  recipient: string;
  certificateType: bigint | number;
  programName: string;
  issuedDate: bigint | number | string;
  expiryDate: bigint | number | string;
  status: bigint | number;
  metadataURI: string;
}

interface IssuerTuple {
  issuerAddress: string;
  name: string;
  country: string;
  website: string;
  registrationDate: bigint | number | string;
  status: bigint | number;
  isVerified: boolean;
}

interface RevocationTuple {
  certificateId: bigint | number | string;
  revocationDate: bigint | number | string;
  reason: string;
  revokedBy: string;
}

interface ClientChainConfig {
  rpcUrl: string;
  chainId: number;
  contractAddress: string;
}

interface ParsedDocumentVerificationInput {
  normalizedPayload: CertificatePayload;
  proof: CertificateProof;
  hashAnchorDocument?: HashAnchorableCertificateDocument | null;
  recipientIdentity?: string | null;
  recipientSalt?: string | null;
  recipientEmail?: string | null;
  replacesCertificateHash?: string | null;
  chainConfig: ClientChainConfig;
}

const ACADEMIC_CERTIFICATION_READ_ABI = [
  "function verifyCertificate(bytes32 _certificateHash) view returns (bool exists, bool isValid, uint8 status, address issuer, address recipient)",
  "function getCertificateByHash(bytes32 _certificateHash) view returns ((uint256 id, bytes32 certificateHash, address issuer, address recipient, uint8 certificateType, string programName, uint256 issuedDate, uint256 expiryDate, uint8 status, string metadataURI))",
  "function getIssuer(address _issuerAddress) view returns ((address issuerAddress, string name, string country, string website, uint256 registrationDate, uint8 status, bool isVerified))",
  "function isAuthorizedIssuer(address _issuerAddress) view returns (bool)",
  "function getRevocation(uint256 _certificateId) view returns ((uint256 certificateId, uint256 revocationDate, string reason, address revokedBy))"
] as const;

const HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ISSUED_AT_SKEW_SECONDS = 300;

const CERTIFICATE_STATUS: Record<number, string> = {
  0: "Valid",
  1: "Revoked",
  2: "Expired"
};

const ISSUER_STATUS: Record<number, string> = {
  0: "Active",
  1: "Suspended",
  2: "Revoked"
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const assertRequiredString = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
};

const validateCertificateHash = (certificateHashInput: string): string => {
  const normalized = String(certificateHashInput || "").trim().toLowerCase();

  if (!HASH_REGEX.test(normalized)) {
    throw new Error("Invalid certificateHash format. Expected 0x-prefixed SHA-256 hex.");
  }

  return normalized;
};

const normalizeJson = (value: unknown): unknown => {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item));
  }

  if (isObjectRecord(value)) {
    const sortedEntries = Object.entries(value)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, nestedValue]) => [key, normalizeJson(nestedValue)]);

    return Object.fromEntries(sortedEntries);
  }

  throw new Error("Unsupported value in certificate payload for hashing.");
};

const deterministicStringify = (input: object): string => {
  if (!isObjectRecord(input)) {
    throw new Error("Certificate payload must be a plain JSON object.");
  }

  return JSON.stringify(normalizeJson(input));
};

const sha256Hex = async (value: string): Promise<string> => {
  if (!globalThis.crypto?.subtle) {
    throw new Error("This browser does not support Web Crypto API for client-side verification.");
  }

  const encoded = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(digest));
  const hex = hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");

  return `0x${hex}`;
};

const hashCertificateData = async <T extends object>(certificate: T): Promise<string> => {
  return sha256Hex(deterministicStringify(certificate));
};

const hashRecipientEmailWithSalt = async (recipientEmail: string, salt: string): Promise<string> => {
  const normalizedEmail = String(recipientEmail || "").trim().toLowerCase();
  const normalizedSalt = String(salt || "").trim();

  if (!EMAIL_PATTERN.test(normalizedEmail) || !normalizedSalt) {
    throw new Error("Invalid recipient email or salt for identity validation.");
  }

  return sha256Hex(`${normalizedEmail}:${normalizedSalt}`);
};

const computeRecipientIdentityMatch = async (
  recipientEmail?: string | null,
  recipientSalt?: string | null,
  recipientIdentity?: string | null
): Promise<boolean | null> => {
  if (!recipientEmail || !recipientSalt || !recipientIdentity) {
    return null;
  }

  try {
    const recomputedIdentity = (await hashRecipientEmailWithSalt(recipientEmail, recipientSalt)).toLowerCase();
    return recomputedIdentity === recipientIdentity.toLowerCase();
  } catch {
    return false;
  }
};

const parseVerificationMethod = (
  verificationMethod: string | null | undefined
): { chainId: number; contractAddress: string } | null => {
  if (!verificationMethod) {
    return null;
  }

  const match = verificationMethod.match(/^blockchain:\/\/[^/]+\/(\d+)\/(0x[a-fA-F0-9]{40})\/[^/]+$/);
  if (!match) {
    return null;
  }

  return {
    chainId: Number(match[1]),
    contractAddress: match[2]
  };
};

const resolveChainConfig = (documentCandidate: Record<string, unknown>): ClientChainConfig => {
  const verification = isObjectRecord(documentCandidate.verification) ? documentCandidate.verification : null;
  const proof = isObjectRecord(documentCandidate.proof) ? documentCandidate.proof : null;
  const blockchain = isObjectRecord(documentCandidate.blockchain) ? documentCandidate.blockchain : null;

  const verificationMethod =
    (verification && typeof verification.verificationMethod === "string" ? verification.verificationMethod : "") ||
    (proof && typeof proof.verificationMethod === "string" ? proof.verificationMethod : "");

  const parsedVerificationMethod = parseVerificationMethod(verificationMethod);
  const blockchainChainId = blockchain && typeof blockchain.chainId === "number" ? blockchain.chainId : null;
  const blockchainContractAddress =
    blockchain && typeof blockchain.contractAddress === "string" ? blockchain.contractAddress : null;

  const chainId = parsedVerificationMethod?.chainId || blockchainChainId || POLYGON_AMOY_CHAIN_ID;
  const contractAddress =
    parsedVerificationMethod?.contractAddress || blockchainContractAddress || PUBLIC_CONTRACT_ADDRESS;

  if (chainId !== POLYGON_AMOY_CHAIN_ID) {
    throw new Error(`Universal verifier is configured for Polygon Amoy only. Received chainId ${chainId}.`);
  }

  if (!contractAddress || !isAddress(contractAddress)) {
    throw new Error(
      "Contract address unavailable for client-side verification. Provide it in the JSON-LD document or set NEXT_PUBLIC_CONTRACT_ADDRESS."
    );
  }

  return {
    rpcUrl: POLYGON_AMOY_RPC_URL,
    chainId,
    contractAddress
  };
};

const mapCertificateStatus = (statusValue: bigint | number | string): string => {
  const numericStatus = Number(statusValue);
  return CERTIFICATE_STATUS[numericStatus] || "Unknown";
};

const mapIssuerStatus = (statusValue: bigint | number | string): string => {
  const numericStatus = Number(statusValue);
  return ISSUER_STATUS[numericStatus] || "Unknown";
};

const getContract = (config: ClientChainConfig): Contract => {
  const provider = new JsonRpcProvider(config.rpcUrl, config.chainId);
  return new Contract(config.contractAddress, ACADEMIC_CERTIFICATION_READ_ABI, provider);
};

const buildValidationError = (
  code: string | null,
  details?: { revokedAt?: string | null; hash?: string | null }
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
    case "MALFORMED_SIGNATURE":
      return {
        validationErrorCode: code,
        validationErrorMessage: "Firma malformada: el campo proof.signatureValue no tiene el formato de una firma Ethereum valida."
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
        validationErrorMessage: details?.revokedAt
          ? `Certificado revocado por el emisor el dia ${new Date(details.revokedAt).toLocaleString("es-ES")}.`
          : "Certificado revocado por el emisor."
      };
    case "EXPIRED":
      return {
        validationErrorCode: code,
        validationErrorMessage: "El certificado esta expirado."
      };
    case "NOT_FOUND":
      return {
        validationErrorCode: code,
        validationErrorMessage: details?.hash
          ? `Hash no encontrado en Polygon Amoy: ${details.hash}.`
          : "Hash no encontrado en Polygon Amoy."
      };
    default:
      return {
        validationErrorCode: null,
        validationErrorMessage: null
      };
  }
};

const validateOpenBadgesV2Schema = (
  document: HashAnchorableCertificateDocument
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (document["@context"] !== "https://w3id.org/openbadges/v2") {
    errors.push("@context must be 'https://w3id.org/openbadges/v2'");
  }
  if (document.type !== "Assertion") {
    errors.push("type must be 'Assertion'");
  }
  if (!document.id || !document.id.match(/^urn:uuid:/i)) {
    errors.push("id must be URN UUID format (e.g., urn:uuid:...)");
  }
  if (!document.issuedOn) {
    errors.push("issuedOn is required and must be ISO 8601 timestamp");
  }
  if (!document.badge) {
    errors.push("badge object is required");
  } else {
    if (!document.badge.name) errors.push("badge.name is required");
    if (!document.badge.description) errors.push("badge.description is required");
    if (!document.badge.issuer) {
      errors.push("badge.issuer is required");
    } else {
      if (!document.badge.issuer.name) errors.push("badge.issuer.name is required");
      if (!document.badge.issuer.url) errors.push("badge.issuer.url is required");
    }
  }
  if (!document.recipient) {
    errors.push("recipient object is required");
  } else {
    if (document.recipient.type !== "email") errors.push("recipient.type must be 'email'");
    if (!document.recipient.identity || !document.recipient.identity.startsWith("0x")) {
      errors.push("recipient.identity must be hashed (0x...) when hashed: true");
    }
    if (!document.recipient.salt || !document.recipient.salt.match(/^[a-f0-9]{32,64}$/)) {
      errors.push("recipient.salt must be a 32 or 64-char lowercase hex string");
    }
    if (document.recipient.hashed !== true) {
      errors.push("recipient.hashed must be true for privacy-preserving certificates");
    }
  }
  if (!document.verification) {
    errors.push("verification object is required");
  } else {
    if (document.verification.type !== "BlockchainSignature") {
      errors.push("verification.type must be 'BlockchainSignature'");
    }
    if (!document.verification.publicKey || !document.verification.publicKey.match(/^0x[a-f0-9]{40}$/i)) {
      errors.push("verification.publicKey must be a valid Ethereum address (0x...)");
    }
    if (!document.verification.verificationMethod) {
      errors.push("verification.verificationMethod is required (blockchain:// URI)");
    } else if (!document.verification.verificationMethod.startsWith("blockchain://")) {
      errors.push("verification.verificationMethod must start with blockchain://");
    }
  }
  if (!document.status) {
    errors.push("status object is required");
  } else if (!["Valid", "Revoked", "Expired"].includes(document.status.current)) {
    errors.push("status.current must be one of: Valid, Revoked, Expired");
  }
  if (!document.normalizedPayload) {
    errors.push("normalizedPayload is required for hash verification");
  }

  return {
    valid: errors.length === 0,
    errors
  };
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

  const verificationType = typeof verification.type === "string" ? verification.type.trim() : "";
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
    status.revokedAt === null || typeof status.revokedAt === "string" ? status.revokedAt : null;
  const statusRevokedBy =
    status.revokedBy === null || typeof status.revokedBy === "string" ? status.revokedBy : null;

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

const extractDocumentVerificationInput = (
  rawBody: unknown,
  recipientEmailForCheck?: string
): ParsedDocumentVerificationInput => {
  validateVerifierUpload(rawBody);

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
    throw new Error("Certificate document JSON body is required.");
  }

  const proofRaw = isObjectRecord(documentCandidate.proof) ? documentCandidate.proof : null;
  const verificationRaw = isObjectRecord(documentCandidate.verification) ? documentCandidate.verification : null;
  const recipientRaw = isObjectRecord(documentCandidate.recipient) ? documentCandidate.recipient : null;

  if (!proofRaw) {
    throw new Error("proof object is required in certificate document.");
  }

  const normalizedPayloadRaw = isObjectRecord(proofRaw.normalizedPayload)
    ? proofRaw.normalizedPayload
    : certificateEnvelope;

  if (!isObjectRecord(normalizedPayloadRaw)) {
    throw new Error("proof.normalizedPayload is required.");
  }

  const normalizedPayload: CertificatePayload = {
    studentName: assertRequiredString(normalizedPayloadRaw.studentName, "proof.normalizedPayload.studentName"),
    studentId: assertRequiredString(normalizedPayloadRaw.studentId, "proof.normalizedPayload.studentId"),
    programName: assertRequiredString(normalizedPayloadRaw.programName, "proof.normalizedPayload.programName"),
    institutionName: assertRequiredString(normalizedPayloadRaw.institutionName, "proof.normalizedPayload.institutionName"),
    issuedAt: assertRequiredString(normalizedPayloadRaw.issuedAt, "proof.normalizedPayload.issuedAt")
  };

  const certificateHash = validateCertificateHash(
    assertRequiredString(proofRaw.certificateHash, "proof.certificateHash")
  );

  const hashAlgorithm = assertRequiredString(proofRaw.hashAlgorithm, "proof.hashAlgorithm");
  if (hashAlgorithm !== "SHA-256") {
    throw new Error("Unsupported proof.hashAlgorithm. Expected SHA-256.");
  }

  const signatureType = assertRequiredString(proofRaw.signatureType, "proof.signatureType");
  if (signatureType !== "EthereumPersonalSign") {
    throw new Error("Unsupported proof.signatureType. Expected EthereumPersonalSign.");
  }

  const signerAddress = assertRequiredString(
    (typeof proofRaw.signerAddress === "string" ? proofRaw.signerAddress : "") ||
      (verificationRaw && typeof verificationRaw.publicKey === "string" ? verificationRaw.publicKey : ""),
    "proof.signerAddress or verification.publicKey"
  );

  const proof: CertificateProof = {
    certificateHash,
    hashAlgorithm: "SHA-256",
    signatureType: "EthereumPersonalSign",
    signatureValue: assertRequiredString(proofRaw.signatureValue, "proof.signatureValue"),
    signerAddress,
    ...(typeof proofRaw.verificationMethod === "string" && proofRaw.verificationMethod.trim()
      ? { verificationMethod: proofRaw.verificationMethod.trim() }
      : {})
  };

  const recipientIdentity =
    recipientRaw && typeof recipientRaw.identity === "string" ? recipientRaw.identity.trim() : null;
  const recipientSalt =
    recipientRaw && typeof recipientRaw.salt === "string" ? recipientRaw.salt.trim() : null;

  const providedRecipientEmail = recipientEmailForCheck?.trim() ||
    (bodyRecord && typeof bodyRecord.recipientEmail === "string" ? bodyRecord.recipientEmail.trim() : "");

  if (providedRecipientEmail && !EMAIL_PATTERN.test(providedRecipientEmail)) {
    throw new Error("recipientEmail must be a valid email address.");
  }

  const hashAnchorDocument = toHashAnchorDocumentOrNull(documentCandidate, normalizedPayload);
  const schemaValidation = hashAnchorDocument ? validateOpenBadgesV2Schema(hashAnchorDocument) : null;

  if (schemaValidation && !schemaValidation.valid) {
    throw new Error(
      `Certificate document does not comply with Open Badges v2 schema: ${schemaValidation.errors.join("; ")}`
    );
  }

  return {
    normalizedPayload,
    proof,
    hashAnchorDocument,
    recipientIdentity,
    recipientSalt,
    recipientEmail: providedRecipientEmail || null,
    replacesCertificateHash:
      typeof documentCandidate.replacesCertificateHash === "string"
        ? documentCandidate.replacesCertificateHash.trim().toLowerCase() || null
        : null,
    chainConfig: resolveChainConfig(documentCandidate)
  };
};

const verifyCertificateProof = async (
  normalizedPayload: CertificatePayload,
  proof: CertificateProof,
  hashAnchorDocument?: HashAnchorableCertificateDocument | null
): Promise<{
  hashMatches: boolean;
  signatureValid: boolean;
  recoveredSigner: string | null;
  signerMatches: boolean;
  signatureMalformed: boolean;
}> => {
  const legacyPayloadHash = (await hashCertificateData(normalizedPayload)).toLowerCase();
  const documentHash = hashAnchorDocument
    ? (await hashCertificateData(hashAnchorDocument)).toLowerCase()
    : null;
  const proofHash = String(proof.certificateHash || "").trim().toLowerCase();
  const hashMatches = legacyPayloadHash === proofHash || documentHash === proofHash;

  const normalizedSigner = String(proof.signerAddress || "").trim().toLowerCase();
  const normalizedSignature = String(proof.signatureValue || "").trim();
  const signatureMalformed = !/^0x[a-fA-F0-9]{130}$/.test(normalizedSignature);

  if (proof.signatureType !== "EthereumPersonalSign" || !HASH_REGEX.test(proofHash) || !normalizedSignature) {
    return {
      hashMatches,
      signatureValid: false,
      recoveredSigner: null,
      signerMatches: false,
      signatureMalformed
    };
  }

  if (signatureMalformed) {
    return {
      hashMatches,
      signatureValid: false,
      recoveredSigner: null,
      signerMatches: false,
      signatureMalformed: true
    };
  }

  try {
    const recoveredSigner = verifyMessage(getBytes(proofHash), normalizedSignature).toLowerCase();

    return {
      hashMatches,
      signatureValid: true,
      recoveredSigner,
      signerMatches: Boolean(normalizedSigner) && recoveredSigner === normalizedSigner,
      signatureMalformed: false
    };
  } catch {
    return {
      hashMatches,
      signatureValid: false,
      recoveredSigner: null,
      signerMatches: false,
      signatureMalformed: true
    };
  }
};

const queryCertificateState = async (
  certificateHash: string,
  chainConfig: ClientChainConfig
): Promise<{
  verification: HashVerificationData;
  issuerStatus: string | null;
  issuerVerified: boolean | null;
  issuerAuthorized: boolean;
  certificateId: string | null;
  revocationReason: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
}> => {
  const contract = getContract(chainConfig);
  const verificationResult = (await contract.verifyCertificate(certificateHash)) as OnChainVerificationTuple;

  const exists = Boolean(verificationResult.exists);
  const status = mapCertificateStatus(verificationResult.status);

  if (!exists) {
    return {
      verification: {
        exists: false,
        isValid: false,
        certificateHash,
        issuedAt: null,
        studentId: null,
        issuer: "",
        issuerName: null,
        recipient: "",
        status: "NotFound"
      },
      issuerStatus: null,
      issuerVerified: null,
      issuerAuthorized: false,
      certificateId: null,
      revocationReason: null,
      revokedAt: null,
      revokedBy: null
    };
  }

  const onChainCertificate = (await contract.getCertificateByHash(certificateHash)) as OnChainCertificateTuple;
  const issuerAddress = String(verificationResult.issuer || "").toLowerCase();
  const issuerProfile = issuerAddress
    ? ((await contract.getIssuer(issuerAddress)) as IssuerTuple)
    : null;
  const issuerAuthorized = issuerAddress ? Boolean(await contract.isAuthorizedIssuer(issuerAddress)) : false;

  let revocationReason: string | null = null;
  let revokedAt: string | null = null;
  let revokedBy: string | null = null;

  if (status === "Revoked") {
    const revocation = (await contract.getRevocation(onChainCertificate.id)) as RevocationTuple;
    revocationReason = revocation.reason || "Revoked";
    revokedAt = Number(revocation.revocationDate)
      ? new Date(Number(revocation.revocationDate) * 1000).toISOString()
      : null;
    revokedBy = String(revocation.revokedBy || "").toLowerCase() || null;
  }

  return {
    verification: {
      exists: true,
      isValid: Boolean(verificationResult.isValid),
      certificateHash,
      issuedAt: Number(onChainCertificate.issuedDate)
        ? new Date(Number(onChainCertificate.issuedDate) * 1000).toISOString()
        : null,
      studentId: null,
      issuer: issuerAddress,
      issuerName: issuerProfile?.name || null,
      recipient: String(verificationResult.recipient || "").toLowerCase(),
      status
    },
    issuerStatus: issuerProfile ? mapIssuerStatus(issuerProfile.status) : null,
    issuerVerified: issuerProfile?.isVerified ?? null,
    issuerAuthorized,
    certificateId: String(onChainCertificate.id || "") || null,
    revocationReason,
    revokedAt,
    revokedBy
  };
};

export const verifyCertificateHashClientSide = async (
  certificateHashInput: string,
  contractAddressInput?: string
): Promise<HashVerificationData> => {
  const certificateHash = validateCertificateHash(certificateHashInput);
  const contractAddress = contractAddressInput?.trim() || PUBLIC_CONTRACT_ADDRESS;

  if (!contractAddress || !isAddress(contractAddress)) {
    throw new Error(
      "Client-side hash verification requires NEXT_PUBLIC_CONTRACT_ADDRESS or a contract address embedded in the certificate JSON-LD."
    );
  }

  const result = await queryCertificateState(certificateHash, {
    rpcUrl: POLYGON_AMOY_RPC_URL,
    chainId: POLYGON_AMOY_CHAIN_ID,
    contractAddress
  });

  return result.verification;
};

export const verifyCertificateDocumentClientSide = async (
  rawDocument: unknown,
  recipientEmailForCheck?: string
): Promise<DocumentVerificationData> => {
  const input = extractDocumentVerificationInput(rawDocument, recipientEmailForCheck);
  const proofVerification = await verifyCertificateProof(
    input.normalizedPayload,
    input.proof,
    input.hashAnchorDocument || null
  );

  const onChainState = await queryCertificateState(input.proof.certificateHash, input.chainConfig);

  const recoveredSigner = proofVerification.recoveredSigner?.toLowerCase() || null;
  const issuerAddress = onChainState.verification.issuer.toLowerCase();
  const issuerMatchesOnChain = Boolean(recoveredSigner) && Boolean(issuerAddress) && recoveredSigner === issuerAddress;

  const issuedAtUnixSeconds = Math.floor(Date.parse(input.normalizedPayload.issuedAt) / 1000);
  const onChainIssuedAt = onChainState.verification.issuedAt || null;
  const onChainIssuedDate = onChainIssuedAt ? Math.floor(Date.parse(onChainIssuedAt) / 1000) : NaN;
  const issuedAtSkewSeconds =
    Number.isFinite(issuedAtUnixSeconds) && Number.isFinite(onChainIssuedDate)
      ? Math.abs(issuedAtUnixSeconds - onChainIssuedDate)
      : null;
  const issuedAtConsistent = issuedAtSkewSeconds !== null && issuedAtSkewSeconds <= MAX_ISSUED_AT_SKEW_SECONDS;

  const recipientIdentityMatchesProvidedEmail = await computeRecipientIdentityMatch(
    input.recipientEmail,
    input.recipientSalt,
    input.recipientIdentity
  );

  const issuerOperationallyAuthorized = Boolean(
    onChainState.issuerAuthorized &&
      onChainState.issuerStatus === "Active" &&
      onChainState.issuerVerified === true
  );

  let validationErrorCode: string | null = null;
  if (!onChainState.verification.exists) {
    validationErrorCode = "NOT_FOUND";
  } else if (onChainState.verification.status === "Revoked") {
    validationErrorCode = "REVOKED";
  } else if (onChainState.verification.status === "Expired") {
    validationErrorCode = "EXPIRED";
  } else if (!proofVerification.hashMatches) {
    validationErrorCode = "INTEGRITY_MISMATCH";
  } else if (proofVerification.signatureMalformed) {
    validationErrorCode = "MALFORMED_SIGNATURE";
  } else if (!proofVerification.signatureValid || !issuerMatchesOnChain) {
    validationErrorCode = "AUTHENTICITY_ERROR";
  } else if (!issuerOperationallyAuthorized) {
    validationErrorCode = "ISSUER_NOT_AUTHORIZED";
  } else if (!issuedAtConsistent) {
    validationErrorCode = "TIMESTAMP_MISMATCH";
  } else if (recipientIdentityMatchesProvidedEmail === false) {
    validationErrorCode = "RECIPIENT_IDENTITY_MISMATCH";
  }

  const validationError = buildValidationError(validationErrorCode, {
    revokedAt: onChainState.revokedAt,
    hash: input.proof.certificateHash
  });

  const overallValid =
    proofVerification.hashMatches &&
    proofVerification.signatureValid &&
    issuerMatchesOnChain &&
    issuerOperationallyAuthorized &&
    issuedAtConsistent &&
    recipientIdentityMatchesProvidedEmail !== false &&
    onChainState.verification.exists &&
    onChainState.verification.isValid;

  return {
    certificateHash: input.proof.certificateHash,
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
    issuerName: onChainState.verification.issuerName || null,
    issuerStatus: onChainState.issuerStatus,
    issuerVerified: onChainState.issuerVerified,
    issuerAuthorized: onChainState.issuerAuthorized,
    issuedAtConsistent,
    issuedAtSkewSeconds,
    onChainExists: onChainState.verification.exists,
    onChainValid: onChainState.verification.isValid,
    issuer: onChainState.verification.issuer,
    recipient: onChainState.verification.recipient,
    status: onChainState.verification.status,
    revocationReason: onChainState.revocationReason,
    revokedAt: onChainState.revokedAt,
    revokedBy: onChainState.revokedBy,
    validationErrorCode: validationError.validationErrorCode,
    validationErrorMessage: validationError.validationErrorMessage,
    overallValid,
    replacesCertificateHash: input.replacesCertificateHash || null,
    replacedByHash: null
  };
};
