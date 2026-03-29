import { Router } from "express";

import { getIssuer } from "../controllers/issuer.controller";

const issuerRouter = Router();

issuerRouter.get("/status", getIssuer);

export default issuerRouter;
