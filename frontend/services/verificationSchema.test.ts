import { describe, expect, it } from "vitest";
import { validateVerifierUpload } from "./verificationSchema";

const baseDocument = {
  "@context": "https://w3id.org/openbadges/v2",
  id: "urn:uuid:cert-1",
  type: "Assertion",
  issuedOn: "2025-01-01T00:00:00.000Z",
  badge: {
    name: "Blockchain Diploma",
    description: "Programa avanzado",
    issuer: {
      name: "Universidad X",
      url: "https://example.edu"
    }
  },
  verification: {
    type: "BlockchainSignature",
    publicKey: "0x1111111111111111111111111111111111111111",
    verificationMethod: "blockchain://polygon-amoy/80002/0x1111111111111111111111111111111111111111/verifyCertificate"
  },
  recipient: {
    type: "email",
    identity: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    salt: "abcdefabcdefabcdefabcdefabcdefab",
    hashed: true
  },
  proof: {
    certificateHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    hashAlgorithm: "SHA-256",
    signatureType: "EthereumPersonalSign",
    signatureValue:
      "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    signerAddress: "0x1111111111111111111111111111111111111111",
    verificationMethod: "blockchain://polygon-amoy/80002/0x1111111111111111111111111111111111111111/verifyCertificate",
    normalizedPayload: {
      studentName: "Ana",
      studentId: "A001",
      programName: "Blockchain",
      institutionName: "Universidad X",
      issuedAt: "2025-01-01T00:00:00.000Z"
    }
  },
  status: {
    current: "Valid",
    revocationReason: null,
    revokedAt: null,
    revokedBy: null
  }
};

describe("validateVerifierUpload", () => {
  it("accepts plain document", () => {
    expect(() => validateVerifierUpload(baseDocument)).not.toThrow();
  });

  it("accepts document envelope", () => {
    expect(() => validateVerifierUpload({ document: baseDocument, recipientEmail: "ana@example.edu" })).not.toThrow();
  });

  it("accepts certificate envelope", () => {
    const { proof, ...certificate } = baseDocument;
    expect(() =>
      validateVerifierUpload({
        certificate,
        proof,
        recipientEmail: "ana@example.edu"
      })
    ).not.toThrow();
  });

  it("rejects invalid verification method", () => {
    const invalid = {
      ...baseDocument,
      verification: {
        ...baseDocument.verification,
        verificationMethod: "bad-method"
      }
    };

    expect(() => validateVerifierUpload(invalid)).toThrow("Esquema JSON-LD/Open Badges invalido");
  });

  it("rejects invalid proof signature length", () => {
    const invalid = {
      ...baseDocument,
      proof: {
        ...baseDocument.proof,
        signatureValue: "0x1234"
      }
    };

    expect(() => validateVerifierUpload(invalid)).toThrow("Esquema JSON-LD/Open Badges invalido");
  });

  it("rejects missing required field with path in message", () => {
    const invalid: Record<string, unknown> = { ...baseDocument };
    delete invalid.id;

    try {
      validateVerifierUpload(invalid);
      throw new Error("should have failed");
    } catch (error) {
      expect((error as Error).message).toContain("documento");
    }
  });
});
