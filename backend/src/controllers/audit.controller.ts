import { Request, Response, NextFunction } from "express";

import { getAuditLogs } from "../services/auditLog.service";
import { createSuccessResponse } from "../utils/apiResponse";
import { ValidationError } from "../utils/errors";

const parsePositiveIntQuery = (raw: unknown, fieldName: string): number | undefined => {
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new ValidationError(`${fieldName} must be a non-negative integer.`);
  }
  return n;
};

export const listAuditLogs = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const q = request.query;

    const limit = parsePositiveIntQuery(q.limit, "limit") ?? 50;
    const offset = parsePositiveIntQuery(q.offset, "offset") ?? 0;
    const fromBlock = parsePositiveIntQuery(q.fromBlock, "fromBlock");
    const toBlock = parsePositiveIntQuery(q.toBlock, "toBlock");

    if (limit > 200) {
      throw new ValidationError("limit cannot exceed 200.");
    }

    const certificateHash =
      typeof q.certificateHash === "string" ? q.certificateHash.trim().toLowerCase() : undefined;
    const revokedBy =
      typeof q.revokedBy === "string" ? q.revokedBy.trim().toLowerCase() : undefined;
    const eventType =
      typeof q.eventType === "string" ? q.eventType.trim() : undefined;

    const { logs, total } = await getAuditLogs({
      certificateHash,
      revokedBy,
      eventType,
      fromBlock,
      toBlock,
      limit,
      offset
    });

    response.status(200).json(
      createSuccessResponse("Audit logs retrieved.", {
        total,
        limit,
        offset,
        logs
      })
    );
  } catch (error) {
    next(error);
  }
};
