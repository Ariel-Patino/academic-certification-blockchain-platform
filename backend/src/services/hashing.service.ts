import { createHash } from "crypto";
import { getBytes, verifyMessage } from "ethers";

import { getWallet } from "../config/blockchain";
import {
  CertificatePayload,
  CertificateProof,
  HashAnchorableCertificateDocument,
  CertificateProofVerificationResult
} from "../types";
import { env } from "../config/env";

const HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === "[object Object]";
};

// RFC 8785 JCS (JSON Canonicalization Scheme) style normalization
// Ensures deterministic JSON serialization for cryptographic operations
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

  if (isPlainObject(value)) {
    const sortedEntries = Object.entries(value)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, nestedValue]) => [key, normalizeJson(nestedValue)]);

    return Object.fromEntries(sortedEntries);
  }

  throw new Error("Unsupported value in certificate payload for hashing.");
};

// Deterministic JSON serialization following JCS principles
// All keys sorted lexicographically, no whitespace, guaranteed reproducibility
const deterministicStringify = (input: object): string => {
  if (!isPlainObject(input)) {
    throw new Error("Certificate payload must be a plain JSON object.");
  }

  return JSON.stringify(normalizeJson(input));
};

// Constructs blockchain:// protocol URL for verificationMethod
// Points to Smart Contract method capable of verifying proof
export const buildVerificationMethodUrl = (
  network: string = "polygon",
  contractAddress: string = env.contractAddress,
  methodName: string = "verifyCertificate"
): string => {
  const chainId = env.chainId;
  return `blockchain://${network}/${chainId}/${contractAddress}/${methodName}`;
};

// Validates that document complies with Open Badges v2 schema
// https://www.imsglobal.org/activity/openbadges
export const validateOpenBadgesV2Schema = (
  document: HashAnchorableCertificateDocument
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check required top-level fields
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

  // Validate badge
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

  // Validate recipient (hashed format)
  if (!document.recipient) {
    errors.push("recipient object is required");
  } else {
    if (document.recipient.type !== "email") errors.push("recipient.type must be 'email'");
    if (!document.recipient.identity || !document.recipient.identity.startsWith("0x")) {
      errors.push("recipient.identity must be hashed (0x...) when hashed: true");
    }
    // Accept 256-bit salts (64 hex chars) generated server-side per certificate.
    // Legacy 128-bit salts (32 hex chars) are also accepted for backward compatibility.
    if (!document.recipient.salt || !document.recipient.salt.match(/^[a-f0-9]{32,64}$/)) {
      errors.push("recipient.salt must be a 32 or 64-char lowercase hex string");
    }
    if (document.recipient.hashed !== true) {
      errors.push("recipient.hashed must be true for privacy-preserving certificates");
    }
  }

  // Validate verification with verificationMethod
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

  // Validate status
  if (!document.status) {
    errors.push("status object is required");
  } else {
    const validStatuses = ["Valid", "Revoked", "Expired"];
    if (!validStatuses.includes(document.status.current)) {
      errors.push(`status.current must be one of: ${validStatuses.join(", ")}`);
    }
  }

  // Validate normalizedPayload exists
  if (!document.normalizedPayload) {
    errors.push("normalizedPayload is required for hash verification");
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

export const hashCertificateData = <T extends object>(certificate: T): string => {
  const serialized = deterministicStringify(certificate);
  const digest = createHash("sha256").update(serialized, "utf8").digest("hex");
  return `0x${digest}`;
};

export const buildHashAnchorDocument = (input: {
  id: string;
  issuedOn: string;
  badge: HashAnchorableCertificateDocument["badge"];
  verification: HashAnchorableCertificateDocument["verification"];
  recipient: HashAnchorableCertificateDocument["recipient"];
  status: HashAnchorableCertificateDocument["status"];
  normalizedPayload: CertificatePayload;
  // When this certificate replaces a previous one, the old hash is committed
  // inside the hashable document so the replacement relationship is cryptographically attested.
  replacesCertificateHash?: string | null;
}): HashAnchorableCertificateDocument => {
  return {
    "@context": "https://w3id.org/openbadges/v2",
    id: input.id,
    type: "Assertion",
    issuedOn: input.issuedOn,
    badge: input.badge,
    verification: input.verification,
    recipient: input.recipient,
    status: input.status,
    normalizedPayload: input.normalizedPayload,
    ...(input.replacesCertificateHash ? { replacesCertificateHash: input.replacesCertificateHash } : {})
  };
};

// Signs a 0x-prefixed 32-byte certificate hash using EIP-191 personal_sign.
// Prepends "\x19Ethereum Signed Message:\n32" before signing so the signature
// is non-malleable and constrained to this use case.
// To recover the signer later: ethers.verifyMessage(getBytes(certificateHash), signatureValue)
export const signCertificateHash = async (
  certificateHash: string
): Promise<{ signatureValue: string; signerAddress: string }> => {
  const wallet = getWallet();
  // Sign the raw bytes so the EIP-191 prefix covers 32 bytes, not a hex string.
  const signatureValue = await wallet.signMessage(getBytes(certificateHash));
  return { signatureValue, signerAddress: wallet.address };
};

// Verifies certificate proof by checking payload integrity and signature authenticity.
export const verifyCertificateProof = (
  normalizedPayload: CertificatePayload,
  proof: CertificateProof,
  hashAnchorDocument?: HashAnchorableCertificateDocument | null
): CertificateProofVerificationResult => {
  const legacyPayloadHash = hashCertificateData(normalizedPayload).toLowerCase();
  const documentHash = hashAnchorDocument
    ? hashCertificateData(hashAnchorDocument).toLowerCase()
    : null;
  const proofHash = String(proof.certificateHash || "").trim().toLowerCase();
  const hashMatches = legacyPayloadHash === proofHash || documentHash === proofHash;
  const hashMatchSource = documentHash === proofHash
    ? "document"
    : legacyPayloadHash === proofHash
      ? "legacy-normalized-payload"
      : null;

  const normalizedSigner = String(proof.signerAddress || "").trim().toLowerCase();
  const normalizedSignature = String(proof.signatureValue || "").trim();

  if (proof.signatureType !== "EthereumPersonalSign" || !HASH_REGEX.test(proofHash) || !normalizedSignature) {
    return {
      hashMatches,
      hashMatchSource,
      signatureValid: false,
      recoveredSigner: null,
      signerMatches: false
    };
  }

  try {
    const recoveredSigner = verifyMessage(getBytes(proofHash), normalizedSignature).toLowerCase();

    return {
      hashMatches,
      hashMatchSource,
      signatureValid: true,
      recoveredSigner,
      signerMatches: Boolean(normalizedSigner) && recoveredSigner === normalizedSigner
    };
  } catch {
    return {
      hashMatches,
      hashMatchSource,
      signatureValid: false,
      recoveredSigner: null,
      signerMatches: false
    };
  }
};
