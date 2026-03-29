import { Router } from "express";

import { getArchitectureStatus } from "../controllers/architecture.controller";

const architectureRouter = Router();

architectureRouter.get("/", getArchitectureStatus);

export default architectureRouter;
