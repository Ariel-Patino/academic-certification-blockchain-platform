import app from "./app";
import { connectDatabase } from "./config/database";
import { env } from "./config/env";
import { startBlockchainRevocationListener, stopBlockchainRevocationListener } from "./services/blockchainListener.service";
import { startCertificateExpirationCron, stopCertificateExpirationCron } from "./services/expirationCron.service";

const bootstrap = async (): Promise<void> => {
  await connectDatabase();

  // Start background services for state management
  try {
    // Event-driven: Listen to blockchain revocation events
    await startBlockchainRevocationListener();
  } catch (error) {
    console.warn("⚠️ Warning: Blockchain listener failed to start:", error);
    // Don't crash, but log the warning
  }

  try {
    // Scheduled: Run expiration check every midnight
    startCertificateExpirationCron();
  } catch (error) {
    console.warn("⚠️ Warning: Expiration cron failed to start:", error);
    // Don't crash, but log the warning
  }

  app.listen(env.port, () => {
    console.log(`✅ Backend server listening on port ${env.port}`);
    console.log("✅ Background services: blockchain listener + expiration cron active");
  });
};

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully...");
  stopBlockchainRevocationListener();
  stopCertificateExpirationCron();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully...");
  stopBlockchainRevocationListener();
  stopCertificateExpirationCron();
  process.exit(0);
});

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected bootstrap error.";
  console.error(`❌ Failed to start backend: ${message}`);
  stopBlockchainRevocationListener();
  stopCertificateExpirationCron();
  process.exit(1);
});
