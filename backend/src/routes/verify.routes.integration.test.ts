import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../services/verification.service", () => {
  return {
    verifyCertificate: vi.fn(),
    verifyCertificateDocument: vi.fn(async () => ({
      success: true,
      message: "Certificate document verification failed.",
      data: {
        certificateHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        studentId: "STU-001",
        recipientIdentity: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        recipientSalt: "a3f1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
        recipientIdentityMatchesProvidedEmail: false,
        issuedAt: "2024-01-01T12:00:00.000Z",
        onChainIssuedAt: "2024-01-01T12:00:05.000Z",
        hashMatches: true,
        signatureValid: true,
        recoveredSigner: "0x1111111111111111111111111111111111111111",
        signerMatches: true,
        issuerMatchesOnChain: true,
        issuerName: "Universidad Demo",
        issuerStatus: "Active",
        issuerVerified: true,
        issuerAuthorized: true,
        issuedAtConsistent: true,
        issuedAtSkewSeconds: 5,
        onChainExists: true,
        onChainValid: true,
        issuer: "0x1111111111111111111111111111111111111111",
        recipient: "0x2222222222222222222222222222222222222222",
        status: "Valid",
        revocationReason: null,
        revokedAt: null,
        revokedBy: null,
        validationErrorCode: "RECIPIENT_IDENTITY_MISMATCH",
        validationErrorMessage: "El email proporcionado no corresponde con la identidad hasheada del certificado.",
        overallValid: false
      }
    }))
  };
});

import app from "../app";

describe("POST /api/verify/document", () => {
  it("returns RECIPIENT_IDENTITY_MISMATCH for recipient identity mismatch", async () => {
    const payload = {
      recipientEmail: "other@example.edu",
      recipient: {
        type: "email",
        identity: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        salt: "a3f1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
        hashed: true
      },
      proof: {
        certificateHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        hashAlgorithm: "SHA-256",
        signatureType: "EthereumPersonalSign",
        signatureValue: "0xsignature",
        signerAddress: "0x1111111111111111111111111111111111111111",
        normalizedPayload: {
          studentName: "Student Name",
          studentId: "STU-001",
          programName: "Program",
          institutionName: "Universidad Demo",
          issuedAt: "2024-01-01T12:00:00.000Z"
        }
      }
    };

    const response = await request(app)
      .post("/api/verify/document")
      .send(payload)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.validationErrorCode).toBe("RECIPIENT_IDENTITY_MISMATCH");
    expect(response.body.data.validationErrorMessage).toContain("email proporcionado");
    expect(response.body.data.overallValid).toBe(false);
  });
});
