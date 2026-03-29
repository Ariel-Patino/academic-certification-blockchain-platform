import mongoose from "mongoose";

import { blockchainConfig, getProvider } from "../config/blockchain";
import { env } from "../config/env";

interface ServiceHealth {
  status: "healthy" | "degraded" | "down";
  latencyMs: number | null;
  details: Record<string, unknown>;
}

export interface ArchitectureHealthReport {
  checkedAt: string;
  environment: string;
  polygon: ServiceHealth;
  ipfs: ServiceHealth;
  database: ServiceHealth;
  overallStatus: "healthy" | "degraded" | "down";
}

const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
let lastAlertAt = 0;
let lastAlertStatus: "healthy" | "degraded" | "down" | null = null;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]);
};

const mapErrorToHealth = (error: unknown): ServiceHealth => ({
  status: "down",
  latencyMs: null,
  details: {
    error: error instanceof Error ? error.message : "Unknown error"
  }
});

const checkPolygonHealth = async (): Promise<ServiceHealth> => {
  const startedAt = Date.now();

  try {
    const provider = getProvider();

    const [network, latestBlock, contractCode] = await withTimeout(
      Promise.all([
        provider.getNetwork(),
        provider.getBlockNumber(),
        provider.getCode(blockchainConfig.contractAddress)
      ]),
      4000
    );

    const latencyMs = Date.now() - startedAt;
    const isExpectedNetwork = Number(network.chainId) === Number(blockchainConfig.chainId);
    const hasContractCode = contractCode !== "0x";

    return {
      status: isExpectedNetwork && hasContractCode ? "healthy" : "degraded",
      latencyMs,
      details: {
        chainId: Number(network.chainId),
        expectedChainId: blockchainConfig.chainId,
        latestBlock,
        contractAddress: blockchainConfig.contractAddress,
        contractDeployed: hasContractCode
      }
    };
  } catch (error) {
    return mapErrorToHealth(error);
  }
};

const buildPinataHeaders = (): Record<string, string> => {
  if (env.pinataJwt) {
    return { Authorization: `Bearer ${env.pinataJwt}` };
  }

  if (env.pinataApiKey && env.pinataApiSecret) {
    return {
      pinata_api_key: env.pinataApiKey,
      pinata_secret_api_key: env.pinataApiSecret
    };
  }

  throw new Error("Pinata credentials not configured");
};

const checkIpfsHealth = async (): Promise<ServiceHealth> => {
  const startedAt = Date.now();

  try {
    const response = await withTimeout(
      fetch(`${env.pinataBaseUrl.replace(/\/$/, "")}/data/testAuthentication`, {
        method: "GET",
        headers: buildPinataHeaders()
      }),
      5000
    );

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const body = await response.text();
      return {
        status: "down",
        latencyMs,
        details: {
          statusCode: response.status,
          statusText: response.statusText,
          body
        }
      };
    }

    const payload = (await response.json()) as Record<string, unknown>;

    return {
      status: "healthy",
      latencyMs,
      details: {
        pinataBaseUrl: env.pinataBaseUrl,
        message: payload.message || "Authentication successful"
      }
    };
  } catch (error) {
    return mapErrorToHealth(error);
  }
};

const checkDatabaseHealth = async (): Promise<ServiceHealth> => {
  const startedAt = Date.now();

  try {
    const state = mongoose.connection.readyState;

    if (state !== 1 || !mongoose.connection.db) {
      return {
        status: "down",
        latencyMs: Date.now() - startedAt,
        details: {
          connectionState: state,
          database: env.mongoDatabaseName,
          message: "MongoDB is not connected"
        }
      };
    }

    await withTimeout(mongoose.connection.db.admin().ping(), 4000);

    return {
      status: "healthy",
      latencyMs: Date.now() - startedAt,
      details: {
        connectionState: state,
        database: mongoose.connection.name,
        host: mongoose.connection.host
      }
    };
  } catch (error) {
    return mapErrorToHealth(error);
  }
};

const computeOverallStatus = (services: ServiceHealth[]): "healthy" | "degraded" | "down" => {
  if (services.some((service) => service.status === "down")) {
    return "down";
  }

  if (services.some((service) => service.status === "degraded")) {
    return "degraded";
  }

  return "healthy";
};

export const getArchitectureHealthReport = async (): Promise<ArchitectureHealthReport> => {
  const [polygon, ipfs, database] = await Promise.all([
    checkPolygonHealth(),
    checkIpfsHealth(),
    checkDatabaseHealth()
  ]);

  const report: ArchitectureHealthReport = {
    checkedAt: new Date().toISOString(),
    environment: env.nodeEnv,
    polygon,
    ipfs,
    database,
    overallStatus: computeOverallStatus([polygon, ipfs, database])
  };

  if (env.alertWebhookUrl && report.overallStatus !== "healthy") {
    const now = Date.now();
    const shouldSendAlert =
      lastAlertStatus !== report.overallStatus || now - lastAlertAt > ALERT_COOLDOWN_MS;

    if (shouldSendAlert) {
      void fetch(env.alertWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "architecture-health-alert",
          severity: report.overallStatus,
          report
        })
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unknown alert webhook error";
        console.warn(`[architecture.service] Failed to send alert webhook: ${message}`);
      });

      lastAlertAt = now;
      lastAlertStatus = report.overallStatus;
    }
  }

  if (report.overallStatus === "healthy") {
    lastAlertStatus = "healthy";
  }

  return report;
};
