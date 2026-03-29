import { NextFunction, Request, Response } from "express";

import { verifyIssuerJwt } from "../services/auth.service";
import { AppError } from "../utils/errors";

export const requireAuthenticatedIssuer = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  const authorizationHeader = request.header("authorization")?.trim() || "";

  if (!authorizationHeader.startsWith("Bearer ")) {
    next(new AppError("Missing Bearer token.", 401, "UNAUTHORIZED"));
    return;
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();

  if (!token) {
    next(new AppError("Missing Bearer token.", 401, "UNAUTHORIZED"));
    return;
  }

  try {
    const payload = await verifyIssuerJwt(token);
    response.locals.authenticatedIssuerAddress = payload.issuerAddress;
    response.locals.authenticatedIssuerRole = payload.role;
    next();
  } catch (error) {
    next(
      new AppError(
        error instanceof Error ? error.message : "Invalid auth token.",
        401,
        "UNAUTHORIZED"
      )
    );
  }
};
