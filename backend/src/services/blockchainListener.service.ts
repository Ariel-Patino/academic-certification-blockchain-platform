/**
 * Blockchain Event Listener Service
 *
 * Subscribes to Smart Contract events (CertificateRevoked) using ethers.js.
 * For every event received the service:
 *   1. Looks up the certificate hash via getCertificateById (on-chain ID → hash)
 *   2. Updates the certificate status to Revoked in MongoDB
 *   3. Writes an immutable audit-log entry with the block number and timestamp
 *
 * On startup it back-fills historical events from the last 10,000 blocks so no
 * revocation is missed after a server restart.
 */

import { EventLog } from "ethers";

import { getProvider, getAcademicCertificationContract } from "../config/blockchain";
import { updateCertificateStatusInDb } from "./certificatePersistence.service";
import { getCertificateById } from "./blockchain.service";
import { createAuditLog } from "./auditLog.service";

// Event signature: CertificateRevoked(uint256 indexed certificateId, string reason, address revokedBy)
interface RevocationEventData {
  certificateId: bigint;
  reason: string;
  revokedBy: string;
}

let isListenerActive = false;
let lastProcessedBlockForRevocation = 0;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Core handler called for both real-time and historical events.
 * Resolves the on-chain certificate, updates the DB and writes an audit log.
 */
const handleRevocationEvent = async (
  certificateId: bigint,
  reason: string,
  revokedBy: string,
  blockNumber: number,
  transactionHash: string
): Promise<void> => {
  const certIdStr = certificateId.toString();

  // Look up the full on-chain record (ID → hash + metadata)
  const onChainCert = await getCertificateById(certIdStr);

  if (!onChainCert?.certificateHash) {
    console.warn(`⚠️  Certificate ID ${certIdStr} not found on-chain – skipping`);
    return;
  }

  const normalizedRevokedBy = revokedBy.toLowerCase();

  // 1. Update certificate status in MongoDB
  await updateCertificateStatusInDb(
    onChainCert.certificateHash,
    "Revoked",
    reason,
    normalizedRevokedBy
  );

  // 2. Resolve block timestamp for the audit log
  let eventTimestamp = new Date();
  try {
    const provider = getProvider();
    const block = await provider.getBlock(blockNumber);
    if (block?.timestamp) {
      eventTimestamp = new Date(block.timestamp * 1000);
    }
  } catch {
    // Non-fatal: fall back to current time
  }

  // 3. Write audit log entry
  await createAuditLog({
    eventType: "CertificateRevoked",
    certificateId: certIdStr,
    certificateHash: onChainCert.certificateHash,
    revokedBy: normalizedRevokedBy,
    reason,
    blockNumber,
    transactionHash: transactionHash.toLowerCase(),
    eventTimestamp
  });

  console.log(
    `✅ Certificate ${certIdStr} (${onChainCert.certificateHash.slice(0, 10)}…) ` +
    `marked Revoked | block=${blockNumber} | tx=${transactionHash.slice(0, 12)}…`
  );
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start listening to CertificateRevoked events.
 * Back-fills the last 10,000 blocks on startup, then stays subscribed.
 */
export const startBlockchainRevocationListener = async (): Promise<void> => {
  if (isListenerActive) {
    console.log("🔄 Blockchain revocation listener already active");
    return;
  }

  const contract = getAcademicCertificationContract();
  const provider = getProvider();

  if (!provider || !contract) {
    throw new Error("Provider or contract not initialized");
  }

  const currentBlock = await provider.getBlockNumber();
  const fromBlock = lastProcessedBlockForRevocation
    ? lastProcessedBlockForRevocation + 1
    : Math.max(0, currentBlock - 10_000);

  console.log(`🔗 Blockchain revocation listener starting (back-fill from block ${fromBlock})`);
  isListenerActive = true;

  // ── 1. Back-fill historical events ──
  try {
    const filter = contract.filters.CertificateRevoked();
    const historical = await contract.queryFilter(filter, fromBlock, currentBlock);

    console.log(`📜 Back-fill: ${historical.length} historical CertificateRevoked event(s)`);

    for (const event of historical) {
      if (event instanceof EventLog) {
        try {
          const { certificateId, reason, revokedBy } =
            event.args as unknown as RevocationEventData;
          await handleRevocationEvent(
            certificateId,
            reason,
            revokedBy,
            event.blockNumber,
            event.transactionHash
          );
        } catch (err) {
          console.error("❌ Back-fill event error:", err);
        }
      }
    }

    lastProcessedBlockForRevocation = currentBlock;
  } catch (err) {
    console.warn("⚠️  Back-fill failed (non-fatal):", err);
  }

  // ── 2. Real-time subscription ──
  contract.on(
    "CertificateRevoked",
    async (certificateId: bigint, reason: string, revokedBy: string, eventPayload: EventLog) => {
      const blockNumber = eventPayload?.blockNumber ?? 0;
      const transactionHash = eventPayload?.transactionHash ?? "";

      console.log(
        `🔴 CertificateRevoked event | ID=${certificateId} | block=${blockNumber} | reason="${reason}"`
      );

      try {
        await handleRevocationEvent(certificateId, reason, revokedBy, blockNumber, transactionHash);
        lastProcessedBlockForRevocation = blockNumber;
      } catch (err) {
        console.error(`❌ Real-time revocation handler failed (ID=${certificateId}):`, err);
      }
    }
  );

  console.log("✅ Blockchain revocation listener active");
};

/** Stop the listener and free contract event subscriptions. */
export const stopBlockchainRevocationListener = (): void => {
  try {
    const contract = getAcademicCertificationContract();
    if (contract) {
      contract.removeAllListeners("CertificateRevoked");
    }
  } catch {
    // Ignore errors during shutdown
  }
  isListenerActive = false;
  console.log("🛑 Blockchain revocation listener stopped");
};

export const isBlockchainListenerActive = (): boolean => isListenerActive;

export const setLastProcessedBlock = (blockNumber: number): void => {
  lastProcessedBlockForRevocation = blockNumber;
};
