// Minimal API client used by frontend forms and pages.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
const ISSUER_TOKEN_STORAGE_KEY = "issuer_jwt_token";

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface IssueCertificatePayload {
  studentName: string;
  studentId: string;
  recipientEmail: string;
  programName: string;
  badgeDescription?: string;
  issuerUrl?: string;
  institutionName: string;
  issuedAt?: string;
  metadataURI?: string;
  recipient?: string;
  certType?: number;
  expiryDate?: number;
  certificateId?: string;
  replacesCertificateHash?: string;
}

export interface RevokeCertificatePayload {
  certificateId: string;
  reason: string;
}

export interface BatchCertificateItem {
  email: string;
  studentName: string;
  studentId: string;
  programName: string;
  institutionName: string;
  grade?: string;
  expiryDate?: number;
  badgeDescription?: string;
  issuerUrl?: string;
}

export interface BatchIssueCertificatesPayload {
  certificates: Array<Omit<BatchCertificateItem, "email"> & { recipientEmail: string }>;
}

export interface BatchCertificateResult {
  studentEmail: string;
  studentName: string;
  certificateHash: string;
  ipfsUri: string;
  verificationUrl: string;
  success: boolean;
  error?: string;
}

export interface BatchIssuancResponse {
  success: boolean;
  message: string;
  data?: {
    batchId: string;
    totalRequested: number;
    totalSuccessful: number;
    totalFailed: number;
    transactionHash: string;
    chainId: number;
    contractAddress: string;
    results: BatchCertificateResult[];
    ipfsUploadProgress: { completed: number; total: number };
    blockchainAnchorProgress: { completed: number; total: number };
  };
}

export interface IssuerStatusData {
  active: boolean;
  issuerAddress: string;
  chainId: number;
  contractAddress: string;
}

export interface SiweNoncePayload {
  address: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface SiweVerifyPayload {
  token: string;
  role: "Issuer";
  issuerAddress: string;
  expiresIn: string;
}

const parseErrorPayload = async (
  response: Response
): Promise<{ message: string; code?: string; details?: unknown }> => {
  try {
    const payload = (await response.json()) as {
      message?: string;
      error?: { code?: string; details?: unknown };
    };

    if (payload?.message) {
      return {
        message: payload.message,
        code: payload.error?.code,
        details: payload.error?.details
      };
    }
  } catch {
    // Ignore invalid JSON and fall back to status text.
  }

  return {
    message: `Request failed with status ${response.status} ${response.statusText}`.trim()
  };
};

const getIssuerToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ISSUER_TOKEN_STORAGE_KEY);
};

const requestJson = async <T>(
  url: string,
  init?: RequestInit,
  options?: { requiresAuth?: boolean }
): Promise<T> => {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options?.requiresAuth) {
    const token = getIssuerToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers
  });

  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);
    throw new ApiRequestError(
      errorPayload.message,
      response.status,
      errorPayload.code,
      errorPayload.details
    );
  }

  return (await response.json()) as T;
};

export const issuerSession = {
  getToken: getIssuerToken,
  setToken(token: string) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ISSUER_TOKEN_STORAGE_KEY, token);
    }
  },
  clear() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ISSUER_TOKEN_STORAGE_KEY);
    }
  }
};

export const api = {
  async getHealth<T>() {
    const healthUrl = `${API_BASE_URL.replace(/\/api$/, "")}/health`;
    return requestJson<T>(healthUrl);
  },

  async getIssuerStatus<T>() {
    return requestJson<T>(`${API_BASE_URL}/issuer/status`);
  },

  async requestSiweNonce<T>(address: string) {
    return requestJson<T>(`${API_BASE_URL}/auth/nonce`, {
      method: "POST",
      body: JSON.stringify({ address })
    });
  },

  async verifySiweLogin<T>(input: { address: string; nonce: string; signature: string }) {
    return requestJson<T>(`${API_BASE_URL}/auth/verify`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  async issueCertificate<T>(payload: IssueCertificatePayload) {
    return requestJson<T>(
      `${API_BASE_URL}/certificates`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      { requiresAuth: true }
    );
  },

  async verifyCertificate<T>(certificateHash: string) {
    const params = new URLSearchParams({ certificateHash });
    return requestJson<T>(`${API_BASE_URL}/verify?${params.toString()}`);
  },

  async verifyCertificateDocument<T>(document: unknown) {
    return requestJson<T>(`${API_BASE_URL}/verify/document`, {
      method: "POST",
      body: JSON.stringify(document)
    });
  },

  async revokeCertificate<T>(payload: RevokeCertificatePayload) {
    return requestJson<T>(
      `${API_BASE_URL}/certificates/revoke`,
      {
        method: "POST",
        body: JSON.stringify({
          certificateId: payload.certificateId,
          reason: payload.reason
        })
      },
      { requiresAuth: true }
    );
  },

  async getIssuerCertificates<T>(issuerAddress: string) {
    const params = new URLSearchParams({ issuer: issuerAddress });
    return requestJson<T>(`${API_BASE_URL}/certificates?${params.toString()}`);
  },

  // Batch certificate issuance from CSV or list
  async batchIssueCertificates<T>(payload: BatchIssueCertificatesPayload) {
    return requestJson<T>(
      `${API_BASE_URL}/certificates/batch`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      { requiresAuth: true }
    );
  }
};
