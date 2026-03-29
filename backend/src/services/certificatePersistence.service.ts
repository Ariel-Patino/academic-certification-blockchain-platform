import { connectDatabase } from "../config/database";
import { env } from "../config/env";
import { CertificateModel } from "../models/certificate.model";

interface PersistCertificateInput {
  certificateHash: string;
  issuerAddress: string;
  recipientEmailHash: string;
  // recipientSalt is intentionally omitted: GDPR design. Salt only lives in the
  // JSON-LD credential delivered to the holder; never stored server-side.
  expirationDate: Date | null;
  status: "Valid" | "Revoked" | "Expired";
  ipfsCID: string;
  metadataURI: string;
  certificateId?: string | null;
  txHash?: string | null;
  replacesCertificateHash?: string | null;
}

/**
 * Extended certificate record with revocation metadata
 */
export interface CertificateRecord extends PersistCertificateInput {
  revocationReason?: string | null;
  revokedBy?: string | null;
  revokedAt?: Date | null;
  replacedByHash?: string | null;
}

/**
 * Abstraction for certificate persistence operations
 * Used by cron jobs and blockchain listeners
 */
export interface ICertificatePersistence {
  getAllCertificates: () => Promise<CertificateRecord[]>;
  updateCertificateStatus: (
    certificateHash: string,
    status: "Valid" | "Revoked" | "Expired",
    reason?: string | null,
    revokedBy?: string | null
  ) => Promise<void>;
}

const testPersistenceStore = new Map<string, CertificateRecord>();

export const persistCertificateRecord = async (input: PersistCertificateInput): Promise<void> => {
  if (env.nodeEnv === "test") {
    testPersistenceStore.set(input.certificateHash.toLowerCase(), { ...input });
    return;
  }

  await connectDatabase();

  await CertificateModel.create({
    certificateHash: input.certificateHash,
    issuerAddress: input.issuerAddress,
    recipientEmailHash: input.recipientEmailHash,
    expirationDate: input.expirationDate,
    status: input.status,
    ipfsCID: input.ipfsCID,
    metadataURI: input.metadataURI,
    certificateId: input.certificateId || null,
    txHash: input.txHash || null,
    replacesCertificateHash: input.replacesCertificateHash || null
  });
};

export const updateCertificatePersistenceOnChainMetadata = async (input: {
  certificateHash: string;
  certificateId: string;
  txHash: string;
}): Promise<void> => {
  if (env.nodeEnv === "test") {
    const key = input.certificateHash.toLowerCase();
    const existing = testPersistenceStore.get(key);

    if (existing) {
      testPersistenceStore.set(key, {
        ...existing,
        certificateId: input.certificateId,
        txHash: input.txHash
      });
    }

    return;
  }

  await connectDatabase();

  await CertificateModel.updateOne(
    { certificateHash: input.certificateHash.toLowerCase() },
    {
      $set: {
        certificateId: input.certificateId,
        txHash: input.txHash
      }
    }
  );
};

/**
 * Get all certificates from database.
 * Used by cron jobs for expiration checking.
 *
 * @returns All certificates from DB (or test store)
 */
export const getAllCertificates = async (): Promise<CertificateRecord[]> => {
  if (env.nodeEnv === "test") {
    return Array.from(testPersistenceStore.values());
  }

  await connectDatabase();

  const documents = await CertificateModel.find({}).lean();

  return documents.map((doc: any) => ({
    certificateHash: doc.certificateHash,
    issuerAddress: doc.issuerAddress,
    recipientEmailHash: doc.recipientEmailHash,
    expirationDate: doc.expirationDate,
    status: doc.status || "Valid",
    ipfsCID: doc.ipfsCID,
    metadataURI: doc.metadataURI,
    certificateId: doc.certificateId,
    txHash: doc.txHash,
    replacesCertificateHash: doc.replacesCertificateHash || null,
    replacedByHash: doc.replacedByHash || null,
    revocationReason: doc.revocationReason || null,
    revokedBy: doc.revokedBy || null,
    revokedAt: doc.revokedAt || null
  }));
};

/**
 * Update certificate status with optional revocation metadata.
 * Called by blockchain listener when CertificateRevoked event is detected.
 * Also called by expiration cron when expirationDate passes.
 *
 * @param certificateHash - Hash of the certificate
 * @param status - New status: Valid, Revoked, or Expired
 * @param reason - Optional revocation reason
 * @param revokedBy - Optional address that revoked it
 */
export const updateCertificateStatus = async (
  certificateHash: string,
  status: "Valid" | "Revoked" | "Expired",
  reason?: string | null,
  revokedBy?: string | null
): Promise<void> => {
  const hashLower = certificateHash.toLowerCase();

  if (env.nodeEnv === "test") {
    const existing = testPersistenceStore.get(hashLower);

    if (existing) {
      testPersistenceStore.set(hashLower, {
        ...existing,
        status,
        revocationReason: reason || null,
        revokedBy: revokedBy || null,
        revokedAt: status === "Revoked" || status === "Expired" ? new Date() : null
      });
    }

    return;
  }

  await connectDatabase();

  const updateData: any = {
    status,
    revocationReason: reason || null,
    revokedBy: revokedBy || null
  };

  if (status === "Revoked" || status === "Expired") {
    updateData.revokedAt = new Date();
  }

  await CertificateModel.updateOne(
    { certificateHash: hashLower },
    { $set: updateData }
  );
};

/**
 * Backward compatibility alias for updateCertificateStatus
 * Called from blockchain listener
 */
export const updateCertificateStatusInDb = updateCertificateStatus;

/**
 * Get certificate persistence instance with encapsulated methods.
 * Useful for dependency injection and testing.
 *
 * @returns ICertificatePersistence interface
 */
export const getCertificatePersistence = (): ICertificatePersistence => {
  return {
    getAllCertificates,
    updateCertificateStatus
  };
};

/**
 * Mark a certificate as replaced by a newer re-issued certificate.
 * Called after successful re-issuance to enable reverse lookup.
 */
export const markCertificateAsReplaced = async (
  oldHash: string,
  newHash: string
): Promise<void> => {
  const oldHashLower = oldHash.toLowerCase();
  const newHashLower = newHash.toLowerCase();

  if (env.nodeEnv === "test") {
    const existing = testPersistenceStore.get(oldHashLower);
    if (existing) {
      testPersistenceStore.set(oldHashLower, { ...existing, replacedByHash: newHashLower });
    }
    return;
  }

  await connectDatabase();
  await CertificateModel.updateOne(
    { certificateHash: oldHashLower },
    { $set: { replacedByHash: newHashLower } }
  );
};

/**
 * Retrieve a single certificate persistence record by its hash.
 * Returns null when the record is not tracked in DB (e.g. pre-DB certificates).
 */
export const getCertificateRecordByHash = async (
  certificateHash: string
): Promise<CertificateRecord | null> => {
  const hashLower = certificateHash.toLowerCase();

  if (env.nodeEnv === "test") {
    return testPersistenceStore.get(hashLower) || null;
  }

  await connectDatabase();
  const doc = await CertificateModel.findOne({ certificateHash: hashLower }).lean();

  if (!doc) {
    return null;
  }

  return {
    certificateHash: doc.certificateHash,
    issuerAddress: doc.issuerAddress,
    recipientEmailHash: doc.recipientEmailHash,
    expirationDate: doc.expirationDate ?? null,
    status: (doc.status as "Valid" | "Revoked" | "Expired") || "Valid",
    ipfsCID: doc.ipfsCID,
    metadataURI: doc.metadataURI,
    certificateId: doc.certificateId ?? null,
    txHash: doc.txHash ?? null,
    replacesCertificateHash: (doc as any).replacesCertificateHash || null,
    replacedByHash: (doc as any).replacedByHash || null
  };
};
