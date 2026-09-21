import { Router } from "express";

const router = Router();

router.get("/healthz", (_request, response) => {
  response.json({ status: "ok" });
});

export default router;
