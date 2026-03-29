import dotenv from "dotenv";

dotenv.config();

type NodeEnv = "development" | "test" | "production";

export interface AppEnv {
  nodeEnv: NodeEnv;
  port: number;
  rpcUrl: string;
  privateKey: string;
  contractAddress: string;
  chainId: number;
  frontendBaseUrl: string;
  mongoUri: string;
  mongoDatabaseName: string;
  pinataJwt: string | null;
  pinataApiKey: string | null;
  pinataApiSecret: string | null;
  pinataBaseUrl: string;
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtExpiresIn: string;
  siweNonceTtlSeconds: number;
  alertWebhookUrl: string | null;
}

const readRequired = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const readPort = (key: string, fallback: number): number => {
  const raw = process.env[key]?.trim();
  if (!raw) {
    return fallback;
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${key}. Expected an integer between 1 and 65535.`);
  }

  return port;
};

const readPositiveInteger = (key: string): number => {
  const value = Number(readRequired(key));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${key}. Expected a positive integer.`);
  }
  return value;
};

const readNodeEnv = (): NodeEnv => {
  const raw = process.env.NODE_ENV?.trim() || "development";
  if (raw === "development" || raw === "test" || raw === "production") {
    return raw;
  }
  throw new Error("Invalid NODE_ENV. Allowed values: development, test, production.");
};

const readFrontendBaseUrl = (): string => {
  const raw = process.env.FRONTEND_BASE_URL?.trim();

  if (!raw) {
    const nodeEnv = process.env.NODE_ENV?.trim() || "development";
    return nodeEnv === "production" ? "https://chaincertifications.com" : "http://localhost:3000";
  }

  return raw;
};

const readOptional = (key: string): string | null => {
  const value = process.env[key]?.trim();
  return value || null;
};

const readMongoUri = (): string => {
  const raw = process.env.MONGO_URI?.trim();

  if (raw) {
    return raw;
  }

  return "mongodb://127.0.0.1:27017";
};

const readMongoDatabaseName = (): string => {
  const raw = process.env.MONGO_DATABASE_NAME?.trim();

  if (raw) {
    return raw;
  }

  return "tfm_certificacion_blockchain";
};

const readJwtSecret = (): string => {
  const value = process.env.JWT_SECRET?.trim();

  if (value) {
    return value;
  }

  if ((process.env.NODE_ENV?.trim() || "development") !== "production") {
    return "change-this-dev-secret";
  }

  throw new Error("Missing required environment variable: JWT_SECRET");
};

const readSiweNonceTtlSeconds = (): number => {
  const raw = process.env.SIWE_NONCE_TTL_SECONDS?.trim();

  if (!raw) {
    return 300;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 30) {
    throw new Error("Invalid SIWE_NONCE_TTL_SECONDS. Expected integer >= 30.");
  }

  return value;
};

export const env: AppEnv = {
  nodeEnv: readNodeEnv(),
  port: readPort("PORT", 3001),
  rpcUrl: readRequired("RPC_URL"),
  privateKey: readRequired("PRIVATE_KEY"),
  contractAddress: readRequired("CONTRACT_ADDRESS"),
  chainId: readPositiveInteger("CHAIN_ID"),
  frontendBaseUrl: readFrontendBaseUrl(),
  mongoUri: readMongoUri(),
  mongoDatabaseName: readMongoDatabaseName(),
  pinataJwt: readOptional("PINATA_JWT"),
  pinataApiKey: readOptional("PINATA_API_KEY"),
  pinataApiSecret: readOptional("PINATA_API_SECRET"),
  pinataBaseUrl: process.env.PINATA_BASE_URL?.trim() || "https://api.pinata.cloud",
  jwtSecret: readJwtSecret(),
  jwtIssuer: process.env.JWT_ISSUER?.trim() || "tfm-certificacion-backend",
  jwtAudience: process.env.JWT_AUDIENCE?.trim() || "tfm-certificacion-frontend",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || "2h",
  siweNonceTtlSeconds: readSiweNonceTtlSeconds(),
  alertWebhookUrl: readOptional("ALERT_WEBHOOK_URL")
};
