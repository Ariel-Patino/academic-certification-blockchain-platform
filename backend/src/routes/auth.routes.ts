import { Router } from "express";

import { requestSiweNonce, verifySiweLogin } from "../controllers/auth.controller";

const authRouter = Router();

authRouter.post("/nonce", requestSiweNonce);
authRouter.post("/verify", verifySiweLogin);

export default authRouter;
