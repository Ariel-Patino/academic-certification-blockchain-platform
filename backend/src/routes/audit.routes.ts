import { Router } from "express";

import { listAuditLogs } from "../controllers/audit.controller";

const auditRouter = Router();

/**
 * GET /api/audit-logs
 *
 * Query params (all optional):
 *   certificateHash  – filter by certificate hash (0x…)
 *   revokedBy        – filter by revoker address
 *   eventType        – filter by event type (default: CertificateRevoked)
 *   fromBlock        – inclusive lower bound on blockNumber
 *   toBlock          – inclusive upper bound on blockNumber
 *   limit            – page size (default: 50, max: 200)
 *   offset           – pagination offset (default: 0)
 */
auditRouter.get("/", listAuditLogs);

export default auditRouter;
