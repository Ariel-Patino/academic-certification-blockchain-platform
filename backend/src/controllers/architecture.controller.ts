import { NextFunction, Request, Response } from "express";

import { getArchitectureHealthReport } from "../services/architecture.service";
import { createSuccessResponse } from "../utils/apiResponse";

export const getArchitectureStatus = async (_request: Request, response: Response, next: NextFunction) => {
  try {
    const report = await getArchitectureHealthReport();
    response.status(200).json(createSuccessResponse("Architecture health report generated.", report));
  } catch (error) {
    next(error);
  }
};
