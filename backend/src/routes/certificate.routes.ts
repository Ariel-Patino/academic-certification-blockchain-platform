import { Router } from "express";

import { createCertificate, listCertificates } from "../controllers/certificate.controller";
import { requireAuthenticatedIssuer } from "../middlewares/authIssuer";
import { createBatchCertificates } from "../controllers/certificate.controller";

const certificateRouter = Router();

certificateRouter.get("/", listCertificates);
certificateRouter.post("/", requireAuthenticatedIssuer, createCertificate);
certificateRouter.post("/batch", requireAuthenticatedIssuer, createBatchCertificates);

// NOTE: Revocation is now Non-Custodial (no-custodial)
// Issuers call smartContract.revokeCertificate() directly
// Backend listens to CertificateRevoked event and updates DB automatically

export default certificateRouter;
