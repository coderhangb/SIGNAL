import { Router } from "express";
import healthRouter from "./health.js";
import signalRouter from "./signal.js";

const router = Router();
router.use(healthRouter);
router.use(signalRouter);

export default router;
