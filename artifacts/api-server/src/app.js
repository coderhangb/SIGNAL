import express from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import { readConfig } from "./config/env.js";
import { AppError, check, object } from "./domain/validation.js";
import { PlanRepository } from "./repositories/plan-repository.js";
import { createAiProvider } from "./services/ai-provider.js";
import { signalRoutes } from "./routes/signal-v2.js";
import { candidateRoutes } from "./routes/plans.js";
import { hrRoutes } from "./routes/hr.js";
export function createApp({
  config = readConfig(),
  repo = new PlanRepository(null),
  provider = createAiProvider(config),
  analyses = new Map(),
  log = () => {},
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use((q, r, next) => {
    q.requestId = randomUUID();
    r.set({
      "X-Request-ID": q.requestId,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'",
    });
    r.on("finish", () =>
      log({ requestId: q.requestId, method: q.method, status: r.statusCode }),
    );
    next();
  });
  app.use(express.json({ limit: "128kb" }));
  app.use(cookieParser());
  app.use("/api", (q, _r, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(q.method)) {
      check(
        q.headers.origin === config.origin,
        "Origin không được phép.",
        403,
        "FORBIDDEN",
      );
      check(q.is("application/json"), "Use application/json.", 400);
    }
    next();
  });
  const buckets = new Map();
  app.use("/api/v2", (q, r, next) => {
    const key = q.ip,
      now = Date.now();
    if (buckets.size > 10000)
      for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
    let bucket = buckets.get(key);
    if (!bucket || bucket.until < now) {
      bucket = { until: now + 60000, count: 0 };
      buckets.set(key, bucket);
    }
    if (++bucket.count > config.rateLimit) {
      r.set("Retry-After", "60");
      throw new AppError(
        429,
        "RATE_LIMITED",
        "Quá nhiều yêu cầu. Thử lại sau một phút.",
        true,
      );
    }
    next();
  });
  app.get("/api/healthz", (_q, r) =>
    r.json({
      status: "ok",
      persistence: repo.pool ? "configured" : "unconfigured",
    }),
  );
  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict",
    secure: config.production,
    path: "/api/v2",
    maxAge: config.sessionHours * 3600000,
  };
  app.post("/api/v2/session", async (q, r) => {
    object(q.body ?? {}, []);
    const session = await repo.session(
      q.cookies.candidate,
      config.sessionHours,
    );
    r.cookie("candidate", session.token, cookieOptions).json({
      csrf: session.csrf,
    });
  });
  app.get("/api/v2/session", async (q, r) => {
    const actor = await repo.authenticate(q.cookies.candidate, "candidate");
    r.json({ csrf: actor.csrf });
  });
  app.use("/api/v2", signalRoutes({ config, provider, analyses }));
  app.use("/api/v2/plans", candidateRoutes({ repo, config, analyses }));
  app.use("/api/v2/hr", hrRoutes({ repo, cookieOptions }));
  app.use("/api", (_q, _r, next) =>
    next(new AppError(404, "NOT_FOUND", "API endpoint not found.")),
  );
  const staticRoot = path.resolve(
    process.cwd(),
    "artifacts/signal/dist/public",
  );
  if (existsSync(path.join(staticRoot, "index.html"))) {
    app.use(express.static(staticRoot));
    app.get(["/", "/hr", "/plan/:id"], (_q, r) =>
      r.sendFile(path.join(staticRoot, "index.html")),
    );
  }
  app.use((error, q, r, _next) => {
    const known = error instanceof AppError;
    const status = known
      ? error.status
      : error.type === "entity.too.large"
        ? 413
        : error.type === "entity.parse.failed"
          ? 400
          : 500;
    r.status(status).json({
      error: {
        code: known
          ? error.code
          : status === 413
            ? "BODY_TOO_LARGE"
            : status === 400
              ? "INVALID_JSON"
              : "INTERNAL_ERROR",
        message: known ? error.message : "Không xử lý được yêu cầu.",
        retryable: known ? error.retryable : status >= 500,
        requestId: q.requestId,
      },
    });
  });
  return app;
}
export default createApp();
