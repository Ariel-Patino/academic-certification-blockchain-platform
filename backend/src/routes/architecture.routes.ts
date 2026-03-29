import { Router } from "express";

import { getArchitectureStatus, streamArchitectureStatus } from "../controllers/architecture.controller";

const architectureRouter = Router();

architectureRouter.get("/", getArchitectureStatus);
architectureRouter.get("/stream", streamArchitectureStatus);

export default architectureRouter;
