import { Request, Response, NextFunction } from "express";

import { issueCertificate } from "../services/certificate.service";
import { getConfiguredSignerAddress, getIssuerCertificateList } from "../services/blockchain.service";
import { getCertificateRecordByHash } from "../services/certificatePersistence.service";
import { createSuccessResponse } from "../utils/apiResponse";
import { AppError, ValidationError } from "../utils/errors";
import { batchIssueCertificates } from "../services/batchCertificate.service";
import { BatchIssueCertificatesInput } from "../types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const assertRequiredStringField = (value: unknown, fieldName: string): void => {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${fieldName} is required.`);
  }
};

const assertEmailField = (value: unknown, fieldName: string): void => {
  assertRequiredStringField(value, fieldName);
  const normalized = String(value).trim();

  if (!EMAIL_REGEX.test(normalized)) {
    throw new ValidationError(`${fieldName} must be a valid email address.`);
  }
};

export const listCertificates = async (request: Request, response: Response, next: NextFunction) => {
  try {
    const issuer = String(request.query.issuer || "").trim();

    if (!issuer || !/^0x[0-9a-fA-F]{40}$/.test(issuer)) {
      throw new ValidationError("issuer query parameter must be a valid Ethereum address (0x + 40 hex chars).");
    }

    const records = await getIssuerCertificateList(issuer);

    // Historial should reflect persisted operational status when available (e.g., cron-marked Expired).
    const recordsWithDbStatus = await Promise.all(
      records.map(async (record) => {
        const dbRecord = await getCertificateRecordByHash(record.certificateHash);
        return dbRecord?.status
          ? { ...record, status: dbRecord.status }
          : record;
      })
    );

    response.status(200).json(createSuccessResponse("Certificates retrieved.", recordsWithDbStatus));
  } catch (error) {
    next(error);
  }
};

export const createCertificate = async (request: Request, response: Response, next: NextFunction) => {
  try {
    const body = request.body || {};

    assertRequiredStringField(body.studentName, "studentName");
    assertRequiredStringField(body.studentId, "studentId");
    assertEmailField(body.recipientEmail, "recipientEmail");
    assertRequiredStringField(body.programName, "programName");
    assertRequiredStringField(body.institutionName, "institutionName");

    const authenticatedIssuerAddress = String(response.locals.authenticatedIssuerAddress || "").toLowerCase();
    const backendSignerAddress = getConfiguredSignerAddress();

    if (!authenticatedIssuerAddress || authenticatedIssuerAddress !== backendSignerAddress) {
      throw new AppError(
        "Authenticated issuer is not allowed to trigger backend issuance signer.",
        403,
        "FORBIDDEN"
      );
    }

    const result = await issueCertificate(request.body || {});
    response.status(201).json(createSuccessResponse(result.message, result.data));
  } catch (error) {
    next(error);
  }
};

// NOTE: revokeCertificate() has been removed from this controller.
// Revocation is now Non-Custodial (no-custodial):
// - Issuers call smartContract.revokeCertificate() directly from frontend
// - Backend listens to CertificateRevoked event and updates DB status automatically
// - No custodial backend intermediary needed for revocation

export const createBatchCertificates = async (request: Request, response: Response, next: NextFunction) => {
  try {
    const body = request.body || {};

    if (!body.certificates || !Array.isArray(body.certificates)) {
      throw new ValidationError("certificates array is required.");
    }

    if (body.certificates.length === 0) {
      throw new ValidationError("certificates array cannot be empty.");
    }

    const authenticatedIssuerAddress = String(response.locals.authenticatedIssuerAddress || "").toLowerCase();
    const backendSignerAddress = getConfiguredSignerAddress();

    if (!authenticatedIssuerAddress || authenticatedIssuerAddress !== backendSignerAddress) {
      throw new AppError(
        "Authenticated issuer is not allowed to trigger backend issuance signer.",
        403,
        "FORBIDDEN"
      );
    }

    const batchInput: BatchIssueCertificatesInput = {
      certificates: body.certificates
    };

    // Call service with optional progress callback
    const result = await batchIssueCertificates(batchInput, authenticatedIssuerAddress, (step) => {
      // Log progress for debugging; in production, could emit SSE or WebSocket events
      console.log(
        `[Batch Progress] IPFS: ${step.ipfsUploaded}/${step.totalCertificates}, Blockchain: ${step.blockchainAnchored}/${step.totalCertificates}`
      );
    });

    response.status(201).json(createSuccessResponse(result.message, result.data));
  } catch (error) {
    next(error);
  }
};
