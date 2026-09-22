import { check } from "../domain/validation.js";
export function readConfig(env = process.env) {
  const number = (key, fallback, max) => {
    const value = Number(env[key] || fallback);
    check(
      Number.isInteger(value) && value > 0 && value <= max,
      `Invalid ${key}.`,
    );
    return value;
  };
  const production = env.NODE_ENV === "production";
  const origin = env.APP_ORIGIN || "http://localhost:5173";
  const url = new URL(origin);
  check(
    !production || url.protocol === "https:",
    "Production APP_ORIGIN requires HTTPS.",
  );
  const config = {
    port: number("API_PORT", env.PORT || 3000, 65535),
    origin: url.origin,
    production,
    databaseUrl: env.DATABASE_URL || null,
    aiProvider: env.AI_PROVIDER || "none",
    aiBaseUrl: env.AI_BASE_URL || "https://api.openai.com/v1",
    aiKey: env.AI_API_KEY,
    aiModel: env.AI_MODEL,
    aiTimeout: number("AI_TIMEOUT_MS", 15000, 60000),
    invitationLimit: number("INVITATION_LIMIT", 20000, 100000),
    rateLimit: number("RATE_LIMIT", 60, 10000),
    sessionHours: number("SESSION_HOURS", 168, 8760),
    grantHours: number("GRANT_HOURS", 72, 720),
  };
  check(
    ["none", "openai-compatible"].includes(config.aiProvider),
    "Unknown AI_PROVIDER.",
  );
  if (config.aiProvider !== "none")
    check(
      !!config.aiKey && !!config.aiModel,
      "Configure AI_API_KEY and AI_MODEL on the server.",
    );
  return config;
}
