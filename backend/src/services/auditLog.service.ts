import { connectDatabase } from "../config/database";
import { env } from "../config/env";
import { AuditLogModel } from "../models/auditLog.model";

export interface CreateAuditLogInput {
  eventType: "CertificateRevoked";
  certificateId: string;
  certificateHash: string;
  revokedBy: string;
  reason: string;
  blockNumber: number;
  transactionHash: string;
  eventTimestamp: Date;
}

export interface AuditLogFilters {
  certificateHash?: string;
  revokedBy?: string;
  eventType?: string;
  fromBlock?: number;
  toBlock?: number;
  limit?: number;
  offset?: number;
}

// In-memory store for test mode
const testStore: (CreateAuditLogInput & { processedAt: Date })[] = [];

/**
 * Persist an audit log entry.
 * Idempotent on (transactionHash + eventType): duplicate events are silently ignored.
 */
export const createAuditLog = async (input: CreateAuditLogInput): Promise<void> => {
  if (env.nodeEnv === "test") {
    testStore.push({ ...input, processedAt: new Date() });
    return;
  }

  await connectDatabase();

  // Upsert so replaying events doesn't create duplicates
  await AuditLogModel.updateOne(
    { transactionHash: input.transactionHash.toLowerCase(), eventType: input.eventType },
    { $setOnInsert: { ...input, processedAt: new Date() } },
    { upsert: true }
  );
};

/**
 * Query audit logs with flexible filters.
 * Returns entries sorted by blockNumber descending (most recent first).
 */
export const getAuditLogs = async (
  filters: AuditLogFilters = {}
): Promise<{ logs: CreateAuditLogInput[]; total: number }> => {
  const { certificateHash, revokedBy, eventType, fromBlock, toBlock, limit = 50, offset = 0 } =
    filters;

  if (env.nodeEnv === "test") {
    let results = [...testStore];
    if (certificateHash) results = results.filter((l) => l.certificateHash === certificateHash.toLowerCase());
    if (revokedBy) results = results.filter((l) => l.revokedBy === revokedBy.toLowerCase());
    if (eventType) results = results.filter((l) => l.eventType === eventType);
    if (fromBlock !== undefined) results = results.filter((l) => l.blockNumber >= fromBlock);
    if (toBlock !== undefined) results = results.filter((l) => l.blockNumber <= toBlock);
    const total = results.length;
    const logs = results.sort((a, b) => b.blockNumber - a.blockNumber).slice(offset, offset + limit);
    return { logs, total };
  }

  await connectDatabase();

  // Build dynamic MongoDB query
  const query: Record<string, unknown> = {};
  if (certificateHash) query.certificateHash = certificateHash.toLowerCase();
  if (revokedBy) query.revokedBy = revokedBy.toLowerCase();
  if (eventType) query.eventType = eventType;
  if (fromBlock !== undefined || toBlock !== undefined) {
    query.blockNumber = {
      ...(fromBlock !== undefined ? { $gte: fromBlock } : {}),
      ...(toBlock !== undefined ? { $lte: toBlock } : {})
    };
  }

  const [total, docs] = await Promise.all([
    AuditLogModel.countDocuments(query),
    AuditLogModel.find(query)
      .sort({ blockNumber: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
  ]);

  const logs = docs.map((d) => ({
    eventType: d.eventType as "CertificateRevoked",
    certificateId: d.certificateId,
    certificateHash: d.certificateHash,
    revokedBy: d.revokedBy,
    reason: d.reason,
    blockNumber: d.blockNumber,
    transactionHash: d.transactionHash,
    eventTimestamp: d.eventTimestamp
  }));

  return { logs, total };
};
