import { NextFunction, Request, Response } from "express";

import {
  createIssuerJwt,
  createIssuerSiweChallenge,
  verifyIssuerSiweSignature
} from "../services/auth.service";
import { createSuccessResponse } from "../utils/apiResponse";
import { AppError, ValidationError } from "../utils/errors";

const assertString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${field} is required.`);
  }

  return value.trim();
};

export const requestSiweNonce = (request: Request, response: Response, next: NextFunction): void => {
  try {
    const address = assertString(request.body?.address, "address");
    const challenge = createIssuerSiweChallenge(address);

    response.status(200).json(createSuccessResponse("SIWE nonce generated.", {
      address: challenge.address,
      nonce: challenge.nonce,
      message: challenge.message,
      expiresAt: new Date(challenge.expiresAt).toISOString()
    }));
  } catch (error) {
    next(error);
  }
};

export const verifySiweLogin = async (request: Request, response: Response, next: NextFunction) => {
  try {
    const address = assertString(request.body?.address, "address");
    const nonce = assertString(request.body?.nonce, "nonce");
    const signature = assertString(request.body?.signature, "signature");

    let verified;

    try {
      verified = await verifyIssuerSiweSignature({ address, nonce, signature });
    } catch (error) {
      throw new AppError(
        error instanceof Error ? error.message : "SIWE verification failed.",
        401,
        "UNAUTHORIZED"
      );
    }

    const jwtResult = createIssuerJwt(verified.address);

    response.status(200).json(createSuccessResponse("SIWE login successful.", {
      token: jwtResult.token,
      role: "Issuer",
      issuerAddress: verified.address,
      expiresIn: jwtResult.expiresIn
    }));
  } catch (error) {
    next(error);
  }
};
