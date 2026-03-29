import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";

import issuerRouter from "./routes/issuer.routes";
import certificateRouter from "./routes/certificate.routes";
import verifyRouter from "./routes/verify.routes";
import authRouter from "./routes/auth.routes";
import auditRouter from "./routes/audit.routes";
import architectureRouter from "./routes/architecture.routes";
import { swaggerSpec } from "./docs/swagger";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/health", (_request, response) => {
  response.status(200).json({
    success: true,
    message: "Backend API is running."
  });
});

app.use("/api/auth", authRouter);
app.use("/api/issuer", issuerRouter);
app.use("/api/certificates", certificateRouter);
app.use("/api/verify", verifyRouter);
app.use("/api/audit-logs", auditRouter);
app.use("/api/architecture", architectureRouter);

app.use(errorHandler);

export default app;
