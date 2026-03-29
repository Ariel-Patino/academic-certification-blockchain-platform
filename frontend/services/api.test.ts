// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const makeResponse = (ok: boolean, status: number, statusText: string, payload: unknown) => {
  return {
    ok,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(payload)
  } as unknown as Response;
};

describe("api service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds health url without /api suffix", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(true, 200, "OK", { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("./api");
    await api.getHealth<{ ok: boolean }>();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:3001/health");
  });

  it("adds auth header for protected endpoint when token exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(true, 200, "OK", { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { api, issuerSession } = await import("./api");
    issuerSession.setToken("jwt-token");

    await api.issueCertificate({
      studentName: "Ana",
      studentId: "A-1",
      recipientEmail: "ana@example.edu",
      programName: "Blockchain",
      institutionName: "Uni"
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer jwt-token");
  });

  it("throws ApiRequestError with backend message and details", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse(false, 400, "Bad Request", {
        message: "Payload invalido",
        error: { code: "VALIDATION_ERROR", details: { field: "studentId" } }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { api, ApiRequestError } = await import("./api");

    await expect(api.verifyCertificate("0xabc")).rejects.toBeInstanceOf(ApiRequestError);
    await expect(api.verifyCertificate("0xabc")).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR"
    });
  });

  it("falls back to status text when error payload is not json", async () => {
    const badResponse = {
      ok: false,
      status: 500,
      statusText: "Server Error",
      json: vi.fn().mockRejectedValue(new Error("invalid json"))
    } as unknown as Response;

    const fetchMock = vi.fn().mockResolvedValue(badResponse);
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("./api");

    await expect(api.getIssuerStatus()).rejects.toMatchObject({
      message: "Request failed with status 500 Server Error"
    });
  });

  it("sends query params for verifyCertificate and getIssuerCertificates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(true, 200, "OK", { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("./api");

    await api.verifyCertificate("0xhash");
    await api.getIssuerCertificates("0xissuer");

    expect(fetchMock.mock.calls[0][0]).toContain("certificateHash=0xhash");
    expect(fetchMock.mock.calls[1][0]).toContain("issuer=0xissuer");
  });

  it("calls remaining endpoints with expected method and payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(true, 200, "OK", { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { api, issuerSession } = await import("./api");
    issuerSession.setToken("jwt-token");

    await api.requestSiweNonce("0x1111111111111111111111111111111111111111");
    await api.verifySiweLogin({
      address: "0x1111111111111111111111111111111111111111",
      nonce: "abc",
      signature: "0xsig"
    });
    await api.verifyCertificateDocument({ a: 1 });
    await api.revokeCertificate({ certificateId: "1", reason: "test" });
    await api.batchIssueCertificates({
      certificates: [
        {
          recipientEmail: "ana@example.edu",
          studentName: "Ana",
          studentId: "A1",
          programName: "Blockchain",
          institutionName: "Uni"
        }
      ]
    });

    expect(fetchMock).toHaveBeenCalledTimes(5);

    const nonceInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(nonceInit.method).toBe("POST");
    expect(fetchMock.mock.calls[0][0]).toContain("/auth/nonce");

    const verifyInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(verifyInit.method).toBe("POST");
    expect(fetchMock.mock.calls[1][0]).toContain("/auth/verify");

    const docInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect(docInit.method).toBe("POST");
    expect(fetchMock.mock.calls[2][0]).toContain("/verify/document");

    const revokeInit = fetchMock.mock.calls[3][1] as RequestInit;
    const revokeHeaders = revokeInit.headers as Headers;
    expect(revokeInit.method).toBe("POST");
    expect(revokeHeaders.get("Authorization")).toBe("Bearer jwt-token");
    expect(fetchMock.mock.calls[3][0]).toContain("/certificates/revoke");

    const batchInit = fetchMock.mock.calls[4][1] as RequestInit;
    const batchHeaders = batchInit.headers as Headers;
    expect(batchInit.method).toBe("POST");
    expect(batchHeaders.get("Authorization")).toBe("Bearer jwt-token");
    expect(fetchMock.mock.calls[4][0]).toContain("/certificates/batch");
  });

  it("manages session token in localStorage", async () => {
    const { issuerSession } = await import("./api");

    expect(issuerSession.getToken()).toBeNull();
    issuerSession.setToken("abc");
    expect(issuerSession.getToken()).toBe("abc");
    issuerSession.clear();
    expect(issuerSession.getToken()).toBeNull();
  });
});
