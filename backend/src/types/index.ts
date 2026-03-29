// Shared backend types used by controllers and services.

// Keeps a common envelope for service responses.
export interface ServiceResult<T> {
  success: boolean;
  message: string;
  data?: T;
}

// Canonical certificate data that is hashed and anchored on-chain.
export interface CertificatePayload {
  studentName: string;
  studentId: string;
  programName: string;
  institutionName: string;
  issuedAt: string;
}

// Input accepted by certificate issuance workflows.
export interface IssueCertificateInput {
  studentName: string;
  studentId: string;
  recipientEmail: string;
  programName: string;
  badgeDescription?: string;
  issuerUrl?: string;
  institutionName: string;
  issuedAt?: string;
  metadataURI?: string;
  recipient?: string;
  certType?: number;
  expiryDate?: number;
  certificateId?: string;
  replacesCertificateHash?: string;
}

// Result returned by verification endpoints and aligned with contract verification data.
export interface VerificationResult {
  exists: boolean;
  isValid: boolean;
  certificateHash?: string;
  issuedAt?: string | null;
  studentId?: string | null;
  issuer: string;
  recipient: string;
  status: string;
  issuerName?: string | null;
  replacedByHash?: string | null;
}

// Result expected after sending an issuance transaction to blockchain.
export interface BlockchainIssueResult {
  certificateId: string;
  certificateHash: string;
  txHash: string;
  chainId: number;
  contractAddress: string;
}

export interface BlockchainRevokeResult {
  certificateId: string;
  reason: string;
  txHash: string;
  revokedBy: string;
}

// Input passed from certificate service to blockchain issuance service.
export interface BlockchainIssueInput {
  certificateId: string;
  certificateHash: string;
  recipient: string;
  certType: number;
  programName: string;
  expiryDate: number;
  metadataURI: string;
}

export interface RevokeCertificateInput {
  certificateId: string;
  reason: string;
  issuerAddress: string;
}

// Cryptographic proof produced during certificate issuance.
// Must comply with Open Badges v2 proof structure with verificationMethod pointing to blockchain.
export interface CertificateProof {
  certificateHash: string;
  hashAlgorithm: "SHA-256";
  signatureType: "EthereumPersonalSign";
  // EIP-191 personal_sign over the raw 32-byte hash. Recoverable with ethers.verifyMessage(getBytes(certificateHash), signatureValue).
  signatureValue: string;
  signerAddress: string;
  // verificationMethod: Method to verify proof; points to Smart Contract method for on-chain verification.
  // Format: blockchain://<network>/<chainId>/<contractAddress>/<method> (e.g., 'blockchain://polygon/137/0x1234.../verifyCertificate')
  verificationMethod?: string;
}

export interface OpenBadgesRecipient {
  type: "email";
  identity: string;
  salt: string;
  hashed: true;
}

export interface OpenBadgesBadgeIssuer {
  name: string;
  url: string;
}

export interface OpenBadgesBadge {
  name: string;
  description: string;
  issuer: OpenBadgesBadgeIssuer;
}

export interface OpenBadgesVerification {
  type: "BlockchainSignature";
  publicKey: string;
  // verificationMethod compliant with Open Badges v2 & did-key spec
  // Format: blockchain://<network>/<chainId>/<contractAddress>/<methodName>
  // Example: 'blockchain://polygon/137/0x1234567890123456789012345678901234567890/verifyCertificate'
  verificationMethod?: string;
}

export interface HashAnchorableCertificateDocument {
  "@context": "https://w3id.org/openbadges/v2";
  id: string;
  type: "Assertion";
  issuedOn: string;
  badge: OpenBadgesBadge;
  verification: OpenBadgesVerification;
  recipient: OpenBadgesRecipient;
  status: CertificateStatusDocument;
  normalizedPayload: CertificatePayload;
  replacesCertificateHash?: string | null;
}

export interface CertificateStatusDocument {
  current: "Valid" | "Revoked" | "Expired";
  revocationReason: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
}

export interface AcademicCertificateDocument {
  "@context": "https://w3id.org/openbadges/v2";
  id: string;
  type: "Assertion";
  issuedOn: string;
  verificationUrl: string;
  badge: OpenBadgesBadge;
  verification: OpenBadgesVerification;
  recipient: OpenBadgesRecipient;
  proof: CertificateProof & { normalizedPayload: CertificatePayload };
  blockchain: {
    network: string;
    chainId: number;
    contractAddress: string;
    transactionHash: string;
    certificateId: string;
    metadataURI: string;
  };
  status: CertificateStatusDocument;
  replacesCertificateHash?: string | null;
}

// Input needed to verify the off-chain proof attached to a certificate JSON.
export interface CertificateProofVerificationInput {
  normalizedPayload: CertificatePayload;
  proof: CertificateProof;
  hashAnchorDocument?: HashAnchorableCertificateDocument | null;
  recipientIdentity?: string | null;
  recipientSalt?: string | null;
  recipientEmail?: string | null;
  replacesCertificateHash?: string | null;
}

// Result produced when checking payload integrity and signature authenticity.
export interface CertificateProofVerificationResult {
  hashMatches: boolean;
  hashMatchSource: "document" | "legacy-normalized-payload" | null;
  signatureValid: boolean;
  recoveredSigner: string | null;
  signerMatches: boolean;
}

// Combined result for uploaded certificate JSON verification.
export interface CertificateDocumentVerificationResult {
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
  recoveredSigner: string | null;
  signerMatches: boolean;
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

export interface RevocationRecord {
  certificateId: string;
  revocationDate: string;
  reason: string;
  revokedBy: string;
}

export interface OnChainIssuerRecord {
  issuerAddress: string;
  name: string;
  country: string;
  website: string;
  registrationDate: string;
  status: string;
  isVerified: boolean;
}

// Certificate issuance response payload used by controllers.
export interface IssueCertificateData {
  certificate: CertificatePayload;
  document: AcademicCertificateDocument;
  certificateHash: string;
  verificationUrl: string;
  metadataURI: string;
  proof: CertificateProof;
  blockchain: BlockchainIssueResult;
  replacesCertificateHash?: string | null;
  previousCertificateRevoked?: boolean;
}

// Optional typed record for direct on-chain lookup by hash.
export interface OnChainCertificateRecord {
  id: string;
  certificateHash: string;
  issuer: string;
  recipient: string;
  certificateType: number;
  programName: string;
  issuedDate: string;
  expiryDate: string;
  status: string;
  metadataURI: string;
}

// Batch certificate issuance input for a single certificate in the batch.
export interface BatchCertificateInput {
  studentName: string;
  studentId: string;
  recipientEmail: string;
  programName: string;
  institutionName: string;
  issuedAt?: string;
  expiryDate?: number;
  badgeDescription?: string;
  issuerUrl?: string;
}

// Batch certificate issuance request (multiple certificates in one transaction).
export interface BatchIssueCertificatesInput {
  certificates: BatchCertificateInput[];
}

// Result for a single certificate in the batch.
export interface BatchCertificateIssuanceResult {
  studentEmail: string;
  studentName: string;
  certificateHash: string;
  ipfsUri: string;
  verificationUrl: string;
  success: boolean;
  error?: string;
}

// Overall batch issuance result.
export interface BatchIssueCertificatesData {
  batchId: string;
  totalRequested: number;
  totalSuccessful: number;
  totalFailed: number;
  transactionHash: string;
  chainId: number;
  contractAddress: string;
  results: BatchCertificateIssuanceResult[];
  ipfsUploadProgress: { completed: number; total: number };
  blockchainAnchorProgress: { completed: number; total: number };
}
