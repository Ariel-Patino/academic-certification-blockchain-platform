// Registers certificate verification endpoints.
import { Router } from "express";

import { verifyCertificateByDocument, verifyCertificateByHash } from "../controllers/verify.controller";

const verifyRouter = Router();

// GET /api/verify?certificateHash=0x...
verifyRouter.get("/", verifyCertificateByHash);

// POST /api/verify { certificateHash: "0x..." }
verifyRouter.post("/", verifyCertificateByHash);

// POST /api/verify/document { ...certificateJson }
verifyRouter.post("/document", verifyCertificateByDocument);

export default verifyRouter;
