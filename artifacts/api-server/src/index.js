import "dotenv/config";
import pg from "pg";
import { createApp } from "./app.js";
import { readConfig } from "./config/env.js";
import { PlanRepository } from "./repositories/plan-repository.js";
const config = readConfig();
const pool = config.databaseUrl
  ? new pg.Pool({
      connectionString: config.databaseUrl,
      connectionTimeoutMillis: 5000,
    })
  : null;
if (pool) {
  try {
    const result = await pool.query(
      "SELECT version FROM schema_migrations WHERE version=1",
    );
    if (!result.rows.length) throw new Error();
  } catch {
    console.error(
      "Database unavailable or migration missing. Run npm run db:migrate with a development DATABASE_URL.",
    );
    await pool.end();
    process.exit(1);
  }
}
const server = createApp({
  config,
  repo: new PlanRepository(pool),
  log: (entry) => console.info(JSON.stringify(entry)),
}).listen(config.port, "127.0.0.1", () =>
  console.info(
    `SIGNAL API on ${config.port}; persistence ${pool ? "PostgreSQL" : "unconfigured"}.`,
  ),
);
for (const event of ["SIGINT", "SIGTERM"])
  process.on(event, () =>
    server.close(async () => {
      await pool?.end();
      process.exit(0);
    }),
  );
