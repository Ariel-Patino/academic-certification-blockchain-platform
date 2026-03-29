import fs from "fs";
import net from "net";
import path from "path";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";

import { ContractFactory, HDNodeWallet, InterfaceAbi, JsonRpcProvider, Wallet } from "ethers";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

const CHAIN_ID = 1337;
const TEST_MNEMONIC = "test test test test test test test test test test test junk";

let ganacheProcess: ChildProcessWithoutNullStreams | null = null;

const findFundedWallet = async (provider: JsonRpcProvider): Promise<Wallet> => {
  const pathPrefixes = ["m/44'/60'/0'/0", "m/44'/60'/0'"];

  for (const prefix of pathPrefixes) {
    for (let i = 0; i < 20; i += 1) {
      const candidate = HDNodeWallet.fromPhrase(TEST_MNEMONIC, undefined, `${prefix}/${i}`);
      const balance = await provider.getBalance(candidate.address);

      if (balance > 0n) {
        return new Wallet(candidate.privateKey, provider);
      }
    }
  }

  throw new Error("No funded wallet derived from configured mnemonic.");
};

const findAvailablePort = async (): Promise<number> => {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.once("listening", () => {
      const address = server.address();
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        if (address && typeof address === "object") {
          resolve(address.port);
          return;
        }

        reject(new Error("Failed to get a free local port."));
      });
    });

    server.listen(0, "127.0.0.1");
  });
};

const waitForRpc = async (rpcUrl: string, timeoutMs: number): Promise<void> => {
  const provider = new JsonRpcProvider(rpcUrl, CHAIN_ID);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await provider.getBlockNumber();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error("Timed out waiting for local RPC node.");
};

describe("POST /api/verify/document (e2e local chain)", () => {
  let app: Awaited<typeof import("../app")>["default"];
  let contractHandle: Record<string, (...args: unknown[]) => Promise<unknown>>;
  let ganacheUrl = "";
  let ganachePort = 0;
  let issuerAddress = "";
  let issuerWallet: Wallet;
  let issuerJwt = "";
  let contractAddress = "";

  beforeAll(async () => {
    ganachePort = await findAvailablePort();
    ganacheUrl = `http://127.0.0.1:${ganachePort}`;

    ganacheProcess = spawn(
      "npx",
      [
        "ganache",
        "--quiet",
        "--wallet.totalAccounts",
        "20",
        "--wallet.mnemonic",
        TEST_MNEMONIC,
        "--chain.chainId",
        String(CHAIN_ID),
        "--server.host",
        "127.0.0.1",
        "--server.port",
        String(ganachePort)
      ],
      {
        cwd: path.resolve(process.cwd(), "../contracts"),
        stdio: "pipe"
      }
    );

    await waitForRpc(ganacheUrl, 15000);

    const provider = new JsonRpcProvider(ganacheUrl, CHAIN_ID);
    const adminWallet = await findFundedWallet(provider);
    issuerWallet = adminWallet;
    const adminPrivateKey = adminWallet.privateKey;
    const artifactPath = path.resolve(process.cwd(), "../contracts/build/contracts/AcademicCertification.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as {
      abi: InterfaceAbi;
      bytecode: string;
    };

    const factory = new ContractFactory(artifact.abi, artifact.bytecode, adminWallet);
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();
    const contractAny = contract as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
    contractHandle = contractAny;
    issuerAddress = (await adminWallet.getAddress()).toLowerCase();

    const registerTx = await contractAny.registerIssuer("Universidad E2E", "ES", "https://e2e.example") as {
      wait: () => Promise<unknown>;
    };
    await registerTx.wait();

    const verifyTx = await contractAny.verifyIssuer(issuerAddress) as {
      wait: () => Promise<unknown>;
    };
    await verifyTx.wait();

    process.env.NODE_ENV = "test";
    process.env.RPC_URL = ganacheUrl;
    process.env.PRIVATE_KEY = adminPrivateKey;
    process.env.CONTRACT_ADDRESS = contractAddress;
    process.env.CHAIN_ID = String(CHAIN_ID);

    process.env.JWT_SECRET = "test-jwt-secret";

    vi.resetModules();
    ({ default: app } = await import("../app"));

    const nonceResponse = await request(app)
      .post("/api/auth/nonce")
      .send({ address: issuerAddress })
      .expect(200);

    const nonce = nonceResponse.body?.data?.nonce as string;
    const message = nonceResponse.body?.data?.message as string;
    const signature = await issuerWallet.signMessage(message);

    const verifyResponse = await request(app)
      .post("/api/auth/verify")
      .send({
        address: issuerAddress,
        nonce,
        signature
      })
      .expect(200);

    issuerJwt = verifyResponse.body?.data?.token;
    expect(issuerJwt).toBeTruthy();
  }, 30000);

  afterAll(async () => {
    if (ganacheProcess && !ganacheProcess.killed) {
      ganacheProcess.kill("SIGTERM");
    }
  });

  it("returns RECIPIENT_IDENTITY_MISMATCH when provided email does not match salted identity", async () => {
    const issueResponse = await request(app)
      .post("/api/certificates")
      .set("Authorization", `Bearer ${issuerJwt}`)
      .send({
        studentName: "Alice Example",
        studentId: "E2E-001",
        recipientEmail: "alice@example.edu",
        programName: "Master Blockchain",
        institutionName: "Universidad E2E"
      })
      .expect(201);

    const document = issueResponse.body?.data?.document;
    expect(document).toBeTruthy();

    const verifyResponse = await request(app)
      .post("/api/verify/document")
      .send({
        ...document,
        verification: {
          ...document.verification,
          verificationMethod:
            document?.verification?.verificationMethod ||
            `blockchain://polygon/${CHAIN_ID}/${contractAddress}/verifyCertificate`
        },
        proof: {
          ...document.proof,
          verificationMethod:
            document?.proof?.verificationMethod ||
            `blockchain://polygon/${CHAIN_ID}/${contractAddress}/verifyCertificate`
        },
        recipientEmail: "wrong@example.edu"
      });

    expect(verifyResponse.status, JSON.stringify(verifyResponse.body)).toBe(200);

    expect(verifyResponse.body.success).toBe(true);
    expect(verifyResponse.body.data.validationErrorCode).toBe("RECIPIENT_IDENTITY_MISMATCH");
    expect(verifyResponse.body.data.validationErrorMessage).toContain("email proporcionado");
    expect(verifyResponse.body.data.recipientIdentityMatchesProvidedEmail).toBe(false);
    expect(verifyResponse.body.data.overallValid).toBe(false);
  });

  it("issues, revokes on-chain, and then returns REVOKED with the on-chain reason", async () => {
    const issueResponse = await request(app)
      .post("/api/certificates")
      .set("Authorization", `Bearer ${issuerJwt}`)
      .send({
        studentName: "Lucia Example",
        studentId: "E2E-REVOKE-001",
        recipientEmail: "lucia@example.edu",
        programName: "Master Web3",
        institutionName: "Universidad E2E"
      })
      .expect(201);

    const certificateHash = issueResponse.body?.data?.certificateHash;
    const certificateId = issueResponse.body?.data?.blockchain?.certificateId;

    expect(certificateHash).toBeTruthy();
    expect(certificateId).toMatch(/^\d+$/);

    // Add delay to ensure blockchain state is updated between transactions
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const revokeTx = await contractHandle.revokeCertificate(BigInt(certificateId), "Academic misconduct") as {
      wait: () => Promise<unknown>;
    };
    await revokeTx.wait();

    // Add delay to ensure transaction is fully processed
    await new Promise((resolve) => setTimeout(resolve, 500));

    const verifyResponse = await request(app)
      .get("/api/verify")
      .query({ certificateHash })
      .expect(409);

    expect(verifyResponse.body.success).toBe(false);
    expect(verifyResponse.body.message).toContain("Revocado por Academic misconduct");
    expect(verifyResponse.body.error.code).toBe("REVOKED");
    expect(verifyResponse.body.error.details.reason).toBe("Academic misconduct");
    expect(verifyResponse.body.error.details.certificateId).toBe(certificateId);
  }, 15000);
});
