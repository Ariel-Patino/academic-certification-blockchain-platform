import { createHash } from "crypto";

import { env } from "../config/env";

interface PinataPinJsonResponse {
  IpfsHash: string;
}

const buildPinataHeaders = (): Record<string, string> => {
  if (env.pinataJwt) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.pinataJwt}`
    };
  }

  if (env.pinataApiKey && env.pinataApiSecret) {
    return {
      "Content-Type": "application/json",
      pinata_api_key: env.pinataApiKey,
      pinata_secret_api_key: env.pinataApiSecret
    };
  }

  throw new Error(
    "Missing Pinata credentials. Configure PINATA_JWT or PINATA_API_KEY + PINATA_API_SECRET."
  );
};

const buildDeterministicTestCid = (payload: unknown): string => {
  const digest = createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
  return `bafytest${digest.slice(0, 52)}`;
};

export const uploadJsonToIpfs = async (
  jsonDocument: Record<string, unknown>,
  options?: { name?: string }
): Promise<{ cid: string; metadataURI: string }> => {
  if (env.nodeEnv === "test") {
    const cid = buildDeterministicTestCid(jsonDocument);
    return {
      cid,
      metadataURI: `ipfs://${cid}`
    };
  }

  const response = await fetch(`${env.pinataBaseUrl.replace(/\/$/, "")}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: buildPinataHeaders(),
    body: JSON.stringify({
      pinataContent: jsonDocument,
      pinataMetadata: {
        name: options?.name || "academic-certificate-jsonld"
      }
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Pinata upload failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as Partial<PinataPinJsonResponse>;

  if (!payload.IpfsHash) {
    throw new Error("Pinata upload succeeded but no CID was returned.");
  }

  return {
    cid: payload.IpfsHash,
    metadataURI: `ipfs://${payload.IpfsHash}`
  };
};
