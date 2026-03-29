import { randomBytes } from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { isAddress, verifyMessage } from "ethers";

import { env } from "../config/env";
import { isIssuerAuthorizedOnChain } from "./blockchain.service";

interface SiweChallenge {
  address: string;
  nonce: string;
  message: string;
  expiresAt: number;
}

interface IssuerJwtPayload {
  role: "Issuer";
}

const challengeStore = new Map<string, SiweChallenge>();

const normalizeAddress = (address: string): string => address.toLowerCase();

const getChallengeStoreKey = (address: string): string => normalizeAddress(address);

const buildSiweMessage = (address: string, nonce: string): string => {
  const domain = env.jwtAudience;
  const issuedAt = new Date().toISOString();
  const uri = env.frontendBaseUrl;

  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    normalizeAddress(address),
    "",
    "Sign in as Authorized Issuer for the academic certification dashboard.",
    "",
    `URI: ${uri}`,
    "Version: 1",
    `Chain ID: ${env.chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`
  ].join("\n");
};

export const createIssuerSiweChallenge = (address: string): SiweChallenge => {
  if (!isAddress(address)) {
    throw new Error("Invalid issuer address.");
  }

  const normalizedAddress = normalizeAddress(address);
  const nonce = randomBytes(16).toString("hex");
  const message = buildSiweMessage(normalizedAddress, nonce);
  const expiresAt = Date.now() + env.siweNonceTtlSeconds * 1000;

  const challenge: SiweChallenge = {
    address: normalizedAddress,
    nonce,
    message,
    expiresAt
  };

  challengeStore.set(getChallengeStoreKey(normalizedAddress), challenge);

  return challenge;
};

export const verifyIssuerSiweSignature = async (input: {
  address: string;
  nonce: string;
  signature: string;
}): Promise<{ address: string }> => {
  if (!isAddress(input.address)) {
    throw new Error("Invalid issuer address.");
  }

  const normalizedAddress = normalizeAddress(input.address);
  const key = getChallengeStoreKey(normalizedAddress);
  const challenge = challengeStore.get(key);

  if (!challenge) {
    throw new Error("SIWE challenge not found. Request a new nonce.");
  }

  if (challenge.expiresAt < Date.now()) {
    challengeStore.delete(key);
    throw new Error("SIWE challenge expired. Request a new nonce.");
  }

  if (challenge.nonce !== input.nonce) {
    throw new Error("Invalid SIWE nonce.");
  }

  const recovered = verifyMessage(challenge.message, input.signature).toLowerCase();
  challengeStore.delete(key);

  if (recovered !== normalizedAddress) {
    throw new Error("SIWE signature does not match the provided issuer address.");
  }

  const isAuthorized = await isIssuerAuthorizedOnChain(normalizedAddress);

  if (!isAuthorized) {
    throw new Error("Issuer is not authorized on-chain.");
  }

  return { address: normalizedAddress };
};

export const createIssuerJwt = (issuerAddress: string): { token: string; expiresIn: string } => {
  const normalizedAddress = normalizeAddress(issuerAddress);
  const payload: IssuerJwtPayload = { role: "Issuer" };

  const signOptions: SignOptions = {
    algorithm: "HS256",
    issuer: env.jwtIssuer,
    audience: env.jwtAudience,
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
    subject: normalizedAddress
  };

  const token = jwt.sign(payload, env.jwtSecret, signOptions);

  return {
    token,
    expiresIn: env.jwtExpiresIn
  };
};

export const verifyIssuerJwt = async (token: string): Promise<{ issuerAddress: string; role: "Issuer" }> => {
  const decoded = jwt.verify(token, env.jwtSecret, {
    algorithms: ["HS256"],
    issuer: env.jwtIssuer,
    audience: env.jwtAudience
  }) as jwt.JwtPayload & IssuerJwtPayload;

  const issuerAddress = typeof decoded.sub === "string" ? decoded.sub.toLowerCase() : "";

  if (!issuerAddress || decoded.role !== "Issuer") {
    throw new Error("Invalid issuer JWT payload.");
  }

  const isAuthorized = await isIssuerAuthorizedOnChain(issuerAddress);
  if (!isAuthorized) {
    throw new Error("Issuer is no longer authorized on-chain.");
  }

  return {
    issuerAddress,
    role: "Issuer"
  };
};
