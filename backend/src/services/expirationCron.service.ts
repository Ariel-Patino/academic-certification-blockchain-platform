/**
 * Certificate Expiration Cron Job Service
 *
 * Runs every midnight (00:00 UTC) to check for expired certificates
 * and update their status in the local database.
 *
 * Architecture:
 * - Scheduled: Uses node-cron for midnight UTC execution
 * - Deterministic: Only processes certificates with expirationDate < now
 * - Non-blocking: Runs in background, doesn't interrupt main application
 * - Idempotent: Safe to run multiple times (status updates are idempotent)
 */

import cron from "node-cron";
import { getCertificatePersistence } from "./certificatePersistence.service";
import { env } from "../config/env";

/**
 * Type for batch expiration job result
 */
interface ExpirationJobResult {
  expiredCount: number;
  totalChecked: number;
  errors: string[];
  lastRunAt: Date;
}

/**
 * Track cron job state
 */
let expirationCronJob: cron.ScheduledTask | null = null;
let lastExpirationJobResult: ExpirationJobResult | null = null;

/**
 * Starts a cron job that runs every day at midnight UTC.
 *
 * Execution:
 * 1. Query all certificates with expirationDate <= now
 * 2. Update their status to 'Expired' in the database
 * 3. Log results (count of expired, errors)
 * 4. Continue running every 24 hours
 *
 * Cron expression: "0 0 * * *" means:
 * - 0 minute
 * - 0 hour (midnight UTC)
 * - * every day
 * - * every month
 * - * every day of week
 *
 * @returns void - Job runs in background
 *
 * @throws Error if cron setup fails
 */
export const startCertificateExpirationCron = (): void => {
  if (expirationCronJob !== null) {
    console.log("⏰ Certificate expiration cron job already running");
    return;
  }

  try {
    // Production: every day at midnight UTC
    // Test: every 5 minutes
    // Development (npm run dev): every 2 minutes for easier local validation
    const cronExpression =
      env.nodeEnv === "test"
        ? "*/5 * * * *"
        : env.nodeEnv === "development"
          ? "*/2 * * * *"
          : "0 0 * * *";

    expirationCronJob = cron.schedule(cronExpression, async () => {
      await runExpirationCheck();
    });

    console.log(`⏰ Certificate expiration cron job started (${cronExpression})`);
  } catch (error) {
    console.error("❌ Failed to start certificate expiration cron:", error);
    throw error;
  }
};

/**
 * Execute the expiration check (can be called manually or by cron)
 *
 * Process:
 * 1. Get all certificates from DB
 * 2. Filter those with expirationDate <= now
 * 3. Update status to 'Expired'
 * 4. Log and track results
 *
 * @returns Promise<ExpirationJobResult>
 */
const runExpirationCheck = async (): Promise<ExpirationJobResult> => {
  const startTime = Date.now();
  const result: ExpirationJobResult = {
    expiredCount: 0,
    totalChecked: 0,
    errors: [],
    lastRunAt: new Date()
  };

  try {
    console.log(`📅 Running certificate expiration check at ${new Date().toISOString()}`);

    const persistence = getCertificatePersistence();

    // Get all certificates from DB
    const allCertificates = await persistence.getAllCertificates();
    result.totalChecked = allCertificates.length;

    if (result.totalChecked === 0) {
      console.log("✅ No certificates in database");
      lastExpirationJobResult = result;
      return result;
    }

    // Check each certificate for expiration
    const now = new Date();
    for (const cert of allCertificates) {
      try {
        // Skip if no expiration date or already expired
        if (!cert.expirationDate) {
          continue;
        }

        const expirationDate = new Date(cert.expirationDate);

        // If expiration date has passed AND status is still Valid, mark as Expired
        if (expirationDate <= now && cert.status === "Valid") {
          await persistence.updateCertificateStatus(
            cert.certificateHash,
            "Expired",
            null,
            null
          );

          result.expiredCount++;
          console.log(`🔴 Certificate ${cert.certificateHash.slice(0, 10)}... marked as Expired`);
        }
      } catch (error) {
        const errorMessage = `Error processing certificate ${cert.certificateHash}: ${error}`;
        result.errors.push(errorMessage);
        console.error(`⚠️ ${errorMessage}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `✅ Expiration check completed: ${result.expiredCount}/${result.totalChecked} certificates expired (${duration}ms)`
    );

    lastExpirationJobResult = result;
    return result;
  } catch (error) {
    const errorMessage = `Fatal error in expiration check: ${error}`;
    result.errors.push(errorMessage);
    console.error(`❌ ${errorMessage}`);
    lastExpirationJobResult = result;
    throw error;
  }
};

/**
 * Stops the expiration cron job
 * Useful for graceful shutdown
 */
export const stopCertificateExpirationCron = (): void => {
  if (expirationCronJob !== null) {
    expirationCronJob.stop();
    expirationCronJob = null;
    console.log("🛑 Certificate expiration cron job stopped");
  }
};

/**
 * Check if expiration cron job is currently running
 */
export const isExpirationCronActive = (): boolean => {
  return expirationCronJob !== null;
};

/**
 * Get last expiration job result for monitoring/debugging
 */
export const getLastExpirationJobResult = (): ExpirationJobResult | null => {
  return lastExpirationJobResult;
};

/**
 * Manually trigger expiration check (for testing or admin endpoints)
 * Can be called via: POST /api/admin/trigger-expiration-check
 */
export const manuallyTriggerExpirationCheck = async (): Promise<ExpirationJobResult> => {
  console.log("🔧 Manual expiration check triggered");
  return runExpirationCheck();
};
