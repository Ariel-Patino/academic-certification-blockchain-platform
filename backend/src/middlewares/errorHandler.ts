import { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/errors";
import { createErrorResponse } from "../utils/apiResponse";

export const errorHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
): void => {
  if (error instanceof AppError) {
    response
      .status(error.statusCode)
      .json(createErrorResponse(error.message, { code: error.code, details: error.details }));
    return;
  }

  if (error instanceof Error) {
    response.status(500).json(createErrorResponse(error.message, { code: "INTERNAL_ERROR" }));
    return;
  }

  response.status(500).json(createErrorResponse("Unexpected server error.", { code: "INTERNAL_ERROR" }));
};
