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

export const streamArchitectureStatus = async (_request: Request, response: Response) => {
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders();

  const writeReport = async () => {
    try {
      const report = await getArchitectureHealthReport();
      response.write(`event: architecture\n`);
      response.write(`data: ${JSON.stringify(report)}\n\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Architecture stream error.";
      response.write("event: error\n");
      response.write(`data: ${JSON.stringify({ message })}\n\n`);
    }
  };

  // Emit immediately and then keep pushing updates for dashboards.
  await writeReport();
  const interval = setInterval(() => {
    void writeReport();
  }, 15_000);

  response.on("close", () => {
    clearInterval(interval);
    response.end();
  });
};
