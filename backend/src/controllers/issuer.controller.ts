import { Request, Response, NextFunction } from "express";

import { createApiResponse } from "../utils/apiResponse";
import { getIssuerStatus } from "../services/issuer.service";

export const getIssuer = async (_request: Request, response: Response, next: NextFunction) => {
  try {
    const result = await getIssuerStatus();
    response.status(200).json(createApiResponse(result.message, result.data));
  } catch (error) {
    next(error);
  }
};
