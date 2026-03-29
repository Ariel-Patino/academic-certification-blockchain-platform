import { Contract, isError, isHexString } from "ethers";

import { blockchainConfig, getAcademicCertificationContract, getWallet } from "../config/blockchain";
import {
  BlockchainIssueInput,
  BlockchainIssueResult,
  BlockchainRevokeResult,
  OnChainCertificateRecord,
  OnChainIssuerRecord,
  RevocationRecord,
  VerificationResult
} from "../types";

const ISSUE_METHOD_CANDIDATES = ["issueCertificate"] as const;
const REVOKE_METHOD_CANDIDATES = ["revokeCertificate"] as const;
const VERIFY_METHOD_CANDIDATES = ["verifyCertificate"] as const;
const GET_BY_ID_METHOD_CANDIDATES = ["getCertificate"] as const;
const GET_BY_HASH_METHOD_CANDIDATES = ["getCertificateByHash"] as const;
const GET_REVOCATION_METHOD_CANDIDATES = ["getRevocation"] as const;
const GET_ISSUER_METHOD_CANDIDATES = ["getIssuer", "issuers"] as const;
const IS_AUTHORIZED_ISSUER_METHOD_CANDIDATES = ["isAuthorizedIssuer"] as const;
const GET_ISSUER_CERTIFICATES_METHOD_CANDIDATES = ["getIssuerCertificates"] as const;

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

const normalizeBytes32Hash = (hash: string): string => {
  if (!isHexString(hash, 32)) {
    throw new Error("Invalid certificate hash. Expected a 32-byte 0x-prefixed hex string.");
  }

  return hash.toLowerCase();
};

const normalizeCertificateId = (certificateIdInput: string): bigint => {
  const certificateId = String(certificateIdInput || "").trim();

  if (!/^\d+$/.test(certificateId) || certificateId === "0") {
    throw new Error("Invalid certificateId. Expected a positive integer.");
  }

  return BigInt(certificateId);
};

const resolveMethodName = (contract: Contract, methodNames: readonly string[]): string => {
  const method = methodNames.find((name) => typeof (contract as Record<string, unknown>)[name] === "function");

  if (!method) {
    throw new Error(`No compatible contract method found. Tried: ${methodNames.join(", ")}`);
  }

  return method;
};

const toBlockchainError = (action: string, error: unknown): Error => {
  if (error instanceof Error) {
    return new Error(`Blockchain ${action} failed: ${error.message}`);
  }

  return new Error(`Blockchain ${action} failed due to an unknown error.`);
};

const readResultValue = <T>(result: unknown, key: string, index: number): T | undefined => {
  if (Array.isArray(result)) {
    return result[index] as T | undefined;
  }

  if (result && typeof result === "object" && key in result) {
    return (result as Record<string, T>)[key];
  }

  return undefined;
};

const mapStatus = (statusValue: unknown): string => {
  const numericStatus = Number(statusValue);
  return CERTIFICATE_STATUS[numericStatus] || "Unknown";
};

const mapOnChainCertificate = (raw: unknown): OnChainCertificateRecord => {
  const record = raw as Record<string, unknown>;

  return {
    id: String(record.id),
    certificateHash: String(record.certificateHash),
    issuer: String(record.issuer),
    recipient: String(record.recipient),
    certificateType: Number(record.certificateType),
    programName: String(record.programName),
    issuedDate: String(record.issuedDate),
    expiryDate: String(record.expiryDate),
    status: mapStatus(record.status),
    metadataURI: String(record.metadataURI)
  };
};

const mapRevocationRecord = (raw: unknown): RevocationRecord => {
  const record = raw as Record<string, unknown>;

  return {
    certificateId: String(record.certificateId),
    revocationDate: String(record.revocationDate),
    reason: String(record.reason),
    revokedBy: String(record.revokedBy)
  };
};

const mapIssuerRecord = (raw: unknown): OnChainIssuerRecord => {
  const record = raw as Record<string, unknown>;

  return {
    issuerAddress: String(record.issuerAddress),
    name: String(record.name),
    country: String(record.country),
    website: String(record.website),
    registrationDate: String(record.registrationDate),
    status: ISSUER_STATUS[Number(record.status)] || "Unknown",
    isVerified: Boolean(record.isVerified)
  };
};

export const issueCertificateOnChain = async (
  input: BlockchainIssueInput
): Promise<BlockchainIssueResult> => {
  try {
    const contract = getAcademicCertificationContract();
    const methodName = resolveMethodName(contract, ISSUE_METHOD_CANDIDATES);
    const certificateHash = normalizeBytes32Hash(input.certificateHash);

    const nextCertificateId = await contract[methodName].staticCall(
      certificateHash,
      input.recipient,
      input.certType,
      input.programName,
      BigInt(input.expiryDate),
      input.metadataURI
    );

    const transaction = await contract[methodName](
      certificateHash,
      input.recipient,
      input.certType,
      input.programName,
      BigInt(input.expiryDate),
      input.metadataURI
    );

    await transaction.wait();

    return {
      certificateId: String(nextCertificateId),
      certificateHash,
      txHash: transaction.hash,
      chainId: blockchainConfig.chainId,
      contractAddress: blockchainConfig.contractAddress
    };
  } catch (error) {
    throw toBlockchainError("issuance", error);
  }
};

export const batchIssueCertificatesOnChain = async (input: {
  certificateHashes: string[];
  recipients: string[];
  certType: number;
  programName: string;
  metadataURIs: string[];
}): Promise<BlockchainIssueResult & { certificateIds: string[] }> => {
  try {
    const contract = getAcademicCertificationContract();
    const methodName = "batchIssueCertificates";

    const normalizedHashes = input.certificateHashes.map(normalizeBytes32Hash);

    if (normalizedHashes.length === 0) {
      throw new Error("Batch issuance requires at least one certificate hash.");
    }

    const certificateIds = await contract[methodName].staticCall(
      normalizedHashes,
      input.recipients,
      input.certType,
      input.programName,
      input.metadataURIs
    );

    const transaction = await contract[methodName](
      normalizedHashes,
      input.recipients,
      input.certType,
      input.programName,
      input.metadataURIs
    );

    await transaction.wait();

    return {
      certificateId: String(certificateIds[0]),
      certificateHash: normalizedHashes[0],
      txHash: transaction.hash,
      chainId: blockchainConfig.chainId,
      contractAddress: blockchainConfig.contractAddress,
      certificateIds: certificateIds.map((id: bigint) => String(id))
    };
  } catch (error) {
    throw toBlockchainError("batch issuance", error);
  }
};

export const revokeCertificateOnChain = async (
  certificateIdInput: string,
  reason: string
): Promise<BlockchainRevokeResult> => {
  try {
    const contract = getAcademicCertificationContract();
    const methodName = resolveMethodName(contract, REVOKE_METHOD_CANDIDATES);
    const certificateId = normalizeCertificateId(certificateIdInput);

    const transaction = await contract[methodName](certificateId, reason);
    await transaction.wait();

    return {
      certificateId: certificateId.toString(),
      reason,
      txHash: transaction.hash,
      revokedBy: getConfiguredSignerAddress()
    };
  } catch (error) {
    throw toBlockchainError("revocation", error);
  }
};

export const verifyCertificateOnChain = async (
  certificateHashInput: string
): Promise<VerificationResult> => {
  try {
    const contract = getAcademicCertificationContract();
    const methodName = resolveMethodName(contract, VERIFY_METHOD_CANDIDATES);
    const certificateHash = normalizeBytes32Hash(certificateHashInput);

    const verificationResult = await contract[methodName](certificateHash);
    const exists = Boolean(readResultValue<boolean>(verificationResult, "exists", 0));
    const isValid = Boolean(readResultValue<boolean>(verificationResult, "isValid", 1));
    const status = mapStatus(readResultValue<unknown>(verificationResult, "status", 2));
    const issuer = String(readResultValue<unknown>(verificationResult, "issuer", 3) || "");
    const recipient = String(readResultValue<unknown>(verificationResult, "recipient", 4) || "");

    return {
      exists,
      isValid,
      issuer,
      recipient,
      status
    };
  } catch (error) {
    throw toBlockchainError("verification", error);
  }
};

export const getCertificateByHash = async (certificateHashInput: string): Promise<OnChainCertificateRecord> => {
  try {
    const contract = getAcademicCertificationContract();
    const methodName = resolveMethodName(contract, GET_BY_HASH_METHOD_CANDIDATES);
    const certificateHash = normalizeBytes32Hash(certificateHashInput);

    const raw = await contract[methodName](certificateHash);
    return mapOnChainCertificate(raw);
  } catch (error) {
    throw toBlockchainError("certificate lookup", error);
  }
};

export const getCertificateById = async (certificateIdInput: string): Promise<OnChainCertificateRecord> => {
  try {
    const contract = getAcademicCertificationContract();
    const methodName = resolveMethodName(contract, GET_BY_ID_METHOD_CANDIDATES);
    const raw = await contract[methodName](normalizeCertificateId(certificateIdInput));

    return mapOnChainCertificate(raw);
  } catch (error) {
    throw toBlockchainError("certificate lookup", error);
  }
};

export const getRevocationByCertificateId = async (certificateIdInput: string): Promise<RevocationRecord> => {
  try {
    const contract = getAcademicCertificationContract();
    const methodName = resolveMethodName(contract, GET_REVOCATION_METHOD_CANDIDATES);

    const raw = await contract[methodName](BigInt(certificateIdInput));
    return mapRevocationRecord(raw);
  } catch (error) {
    throw toBlockchainError("revocation lookup", error);
  }
};

export const getIssuerByAddress = async (issuerAddressInput: string): Promise<OnChainIssuerRecord | null> => {
  try {
    const contract = getAcademicCertificationContract();
    const methodName = resolveMethodName(contract, GET_ISSUER_METHOD_CANDIDATES);
    const raw = await contract[methodName](issuerAddressInput);

    return mapIssuerRecord(raw);
  } catch (error) {
    if (isError(error, "CALL_EXCEPTION")) {
      return null;
    }

    throw toBlockchainError("issuer lookup", error);
  }
};

export const isIssuerAuthorizedOnChain = async (issuerAddressInput: string): Promise<boolean> => {
  try {
    const contract = getAcademicCertificationContract();
    const methodName = resolveMethodName(contract, IS_AUTHORIZED_ISSUER_METHOD_CANDIDATES);
    const authorized = await contract[methodName](issuerAddressInput);
    return Boolean(authorized);
  } catch (error) {
    throw toBlockchainError("issuer authorization lookup", error);
  }
};

export const getIssuerCertificateList = async (issuerAddress: string): Promise<OnChainCertificateRecord[]> => {
  try {
    const contract = getAcademicCertificationContract();
    const getMethod = resolveMethodName(contract, GET_BY_ID_METHOD_CANDIDATES);

    let ids: bigint[] = [];

    try {
      const listMethod = resolveMethodName(contract, GET_ISSUER_CERTIFICATES_METHOD_CANDIDATES);
      ids = await contract[listMethod](issuerAddress);
    } catch {
      // Backward-compatible fallback: rebuild issuer history from CertificateIssued events.
      const hasEventFilter =
        typeof (contract as { queryFilter?: unknown }).queryFilter === "function" &&
        Boolean((contract as { filters?: Record<string, unknown> }).filters?.CertificateIssued);

      if (!hasEventFilter) {
        throw new Error("No compatible contract method found. Tried: getIssuerCertificates");
      }

      const logs = await contract.queryFilter(contract.filters.CertificateIssued(), 0, "latest");
      const normalizedIssuer = issuerAddress.toLowerCase();

      ids = logs
        .map((log) => (log as { args?: { certificateId?: bigint; issuer?: string } }).args)
        .filter((args): args is { certificateId: bigint; issuer: string } => {
          if (!args || typeof args.issuer !== "string" || typeof args.certificateId === "undefined") {
            return false;
          }

          return args.issuer.toLowerCase() === normalizedIssuer;
        })
        .map((args) => args.certificateId);
    }

    const uniqueIds = Array.from(new Set(ids.map((id) => id.toString())))
      .map((id) => BigInt(id))
      .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

    const records = await Promise.all(
      uniqueIds.map(async (id) => {
        const raw = await contract[getMethod](id);
        return mapOnChainCertificate(raw);
      })
    );

    return records;
  } catch (error) {
    throw toBlockchainError("issuer certificate list", error);
  }
};

export const getConfiguredSignerAddress = (): string => {
  return getWallet().address.toLowerCase();
};
