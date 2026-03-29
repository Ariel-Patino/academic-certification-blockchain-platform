import { createHash, randomBytes, randomUUID } from "crypto";

import { env } from "../config/env";
import {
  BatchIssueCertificatesData,
  BatchIssueCertificatesInput,
  CertificatePayload,
  CertificateProof,
  ServiceResult
} from "../types";
import { AppError, ValidationError } from "../utils/errors";
import { batchIssueCertificatesOnChain, getConfiguredSignerAddress } from "./blockchain.service";
import { persistCertificateRecord } from "./certificatePersistence.service";
import {
  buildHashAnchorDocument,
  buildVerificationMethodUrl,
  hashCertificateData,
  signCertificateHash,
  validateOpenBadgesV2Schema
} from "./hashing.service";
import { uploadJsonToIpfs } from "./ipfs.service";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ProgressStep = {
  totalCertificates: number;
  ipfsUploaded: number;
  blockchainAnchored: number;
};

type PreparedCertificate = {
  recipientEmail: string;
  studentName: string;
  certificateHash: string;
  recipientIdentityHash: string;
  expirationDate: Date | null;
  hashAnchorDocument: Record<string, unknown>;
  documentForIpfs: Record<string, unknown>;
};

const validateBatchInput = (input: BatchIssueCertificatesInput): void => {
  if (!Array.isArray(input.certificates) || input.certificates.length === 0) {
    throw new ValidationError("certificates array is required and cannot be empty.");
  }

  if (input.certificates.length > 500) {
    throw new ValidationError("Batch size cannot exceed 500 certificates.");
  }

  input.certificates.forEach((cert, index) => {
    if (!String(cert.studentName || "").trim()) {
      throw new ValidationError(`certificates[${index}].studentName is required.`);
    }
    if (!String(cert.studentId || "").trim()) {
      throw new ValidationError(`certificates[${index}].studentId is required.`);
    }
    const email = String(cert.recipientEmail || "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      throw new ValidationError(`certificates[${index}].recipientEmail must be a valid email address.`);
    }
    if (!String(cert.programName || "").trim()) {
      throw new ValidationError(`certificates[${index}].programName is required.`);
    }
    if (!String(cert.institutionName || "").trim()) {
      throw new ValidationError(`certificates[${index}].institutionName is required.`);
    }
  });
};

const prepareCertificate = async (
  cert: BatchIssueCertificatesInput["certificates"][number],
  signerAddress: string
): Promise<PreparedCertificate> => {
  const certificatePayload: CertificatePayload = {
    studentName: cert.studentName.trim(),
    studentId: cert.studentId.trim(),
    programName: cert.programName.trim(),
    institutionName: cert.institutionName.trim(),
    issuedAt: cert.issuedAt?.trim() || new Date().toISOString()
  };

  const recipientSalt = randomBytes(32).toString("hex");
  const recipientEmail = cert.recipientEmail.trim().toLowerCase();
  const recipientIdentityHash = `0x${createHash("sha256")
    .update(`${recipientEmail}:${recipientSalt}`, "utf8")
    .digest("hex")}`;

  const badge = {
    name: certificatePayload.programName,
    description:
      cert.badgeDescription?.trim() ||
      `Academic certificate issued by ${certificatePayload.institutionName} for ${certificatePayload.programName}.`,
    issuer: {
      name: certificatePayload.institutionName,
      url: cert.issuerUrl?.trim() || "https://example.edu"
    }
  };

  const verification = {
    type: "BlockchainSignature" as const,
    publicKey: signerAddress,
    verificationMethod: buildVerificationMethodUrl("polygon", env.contractAddress, "verifyCertificate")
  };

  const status = {
    current: "Valid" as const,
    revocationReason: null,
    revokedAt: null,
    revokedBy: null
  };

  const hashAnchorDocument = buildHashAnchorDocument({
    id: `urn:uuid:${randomUUID()}`,
    issuedOn: certificatePayload.issuedAt,
    badge,
    verification,
    recipient: {
      type: "email",
      identity: recipientIdentityHash,
      salt: recipientSalt,
      hashed: true
    },
    status,
    normalizedPayload: certificatePayload
  });

  const schemaValidation = validateOpenBadgesV2Schema(hashAnchorDocument);
  if (!schemaValidation.valid) {
    throw new Error(`Open Badges schema invalid: ${schemaValidation.errors.join("; ")}`);
  }

  const certificateHash = hashCertificateData(hashAnchorDocument);
  const { signatureValue } = await signCertificateHash(certificateHash);

  const proof: CertificateProof = {
    certificateHash,
    hashAlgorithm: "SHA-256",
    signatureType: "EthereumPersonalSign",
    signatureValue,
    signerAddress,
    verificationMethod: buildVerificationMethodUrl("polygon", env.contractAddress, "verifyCertificate")
  };

  const documentForIpfs: Record<string, unknown> = {
    ...hashAnchorDocument,
    proof: {
      ...proof,
      normalizedPayload: certificatePayload
    },
    verificationUrl: `${env.frontendBaseUrl.replace(/\/$/, "")}/verify?hash=${encodeURIComponent(certificateHash)}`,
    blockchain: {
      network: `chain-${env.chainId}`,
      chainId: env.chainId,
      contractAddress: env.contractAddress,
      transactionHash: "pending",
      certificateId: "pending",
      metadataURI: "ipfs://pending"
    }
  };

  const expiryDate = Number.isInteger(cert.expiryDate) ? Number(cert.expiryDate) : 0;
  const expirationDate = expiryDate > 0 ? new Date(expiryDate * 1000) : null;

  return {
    recipientEmail,
    studentName: certificatePayload.studentName,
    certificateHash,
    recipientIdentityHash,
    expirationDate,
    hashAnchorDocument: hashAnchorDocument as unknown as Record<string, unknown>,
    documentForIpfs
  };
};

export const batchIssueCertificates = async (
  input: BatchIssueCertificatesInput,
  issuerAddress: string,
  onProgress?: (step: ProgressStep) => void
): Promise<ServiceResult<BatchIssueCertificatesData>> => {
  validateBatchInput(input);

  const batchId = randomUUID();
  const total = input.certificates.length;
  const progress: ProgressStep = { totalCertificates: total, ipfsUploaded: 0, blockchainAnchored: 0 };
  const signerAddress = getConfiguredSignerAddress();

  const prepared: PreparedCertificate[] = [];
  const results: BatchIssueCertificatesData["results"] = [];
  const metadataURIs: string[] = [];

  try {
    for (const cert of input.certificates) {
      const preparedCert = await prepareCertificate(cert, signerAddress);
      prepared.push(preparedCert);
    }

    for (let i = 0; i < prepared.length; i++) {
      const item = prepared[i];
      try {
        const uploaded = await uploadJsonToIpfs(item.documentForIpfs, {
          name: `academic-batch-certificate-${item.certificateHash.slice(2, 14)}`
        });
        metadataURIs.push(uploaded.metadataURI);
        progress.ipfsUploaded += 1;
        results.push({
          studentEmail: item.recipientEmail,
          studentName: item.studentName,
          certificateHash: item.certificateHash,
          ipfsUri: uploaded.metadataURI,
          verificationUrl: `${env.frontendBaseUrl.replace(/\/$/, "")}/verify?hash=${encodeURIComponent(item.certificateHash)}`,
          success: true
        });
      } catch (error) {
        metadataURIs.push("");
        results.push({
          studentEmail: item.recipientEmail,
          studentName: item.studentName,
          certificateHash: item.certificateHash,
          ipfsUri: "",
          verificationUrl: "",
          success: false,
          error: error instanceof Error ? error.message : "IPFS upload failed"
        });
      }

      if (onProgress) {
        onProgress({ ...progress });
      }
    }

    const successfulIndexes = results.map((r, i) => (r.success ? i : -1)).filter((i) => i >= 0);
    if (successfulIndexes.length === 0) {
      throw new AppError("All certificate uploads failed; batch aborted.", 500, "BATCH_IPFS_FAILURE");
    }

    const chainInput = {
      certificateHashes: successfulIndexes.map((i) => prepared[i].certificateHash),
      recipients: successfulIndexes.map(() => signerAddress),
      certType: 0,
      programName: prepared[successfulIndexes[0]].documentForIpfs?.normalizedPayload
        ? String((prepared[successfulIndexes[0]].documentForIpfs.normalizedPayload as Record<string, unknown>).programName || "Certificate")
        : "Certificate",
      metadataURIs: successfulIndexes.map((i) => metadataURIs[i])
    };

    const blockchainResult = await batchIssueCertificatesOnChain(chainInput);
    progress.blockchainAnchored = successfulIndexes.length;
    if (onProgress) {
      onProgress({ ...progress });
    }

    for (let i = 0; i < successfulIndexes.length; i++) {
      const idx = successfulIndexes[i];
      const item = prepared[idx];
      const certificateId = blockchainResult.certificateIds[i];

      await persistCertificateRecord({
        certificateHash: item.certificateHash,
        issuerAddress,
        recipientEmailHash: item.recipientIdentityHash,
        expirationDate: item.expirationDate,
        status: "Valid",
        ipfsCID: metadataURIs[idx].replace(/^ipfs:\/\//, ""),
        metadataURI: metadataURIs[idx],
        certificateId,
        txHash: blockchainResult.txHash
      });
    }

    const totalSuccessful = results.filter((r) => r.success).length;

    return {
      success: true,
      message: `Batch issuance completed: ${totalSuccessful}/${total} certificates prepared and anchored.`,
      data: {
        batchId,
        totalRequested: total,
        totalSuccessful,
        totalFailed: total - totalSuccessful,
        transactionHash: blockchainResult.txHash,
        chainId: blockchainResult.chainId,
        contractAddress: blockchainResult.contractAddress,
        results,
        ipfsUploadProgress: { completed: progress.ipfsUploaded, total },
        blockchainAnchorProgress: { completed: progress.blockchainAnchored, total }
      }
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      error instanceof Error ? error.message : "Batch issuance failed",
      500,
      "BATCH_ISSUANCE_FAILED",
      { batchId }
    );
  }
};
