import "dotenv/config";
import pg from "pg";
import { readFile } from "node:fs/promises";
if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL is required; use an empty development PostgreSQL database.",
  );
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query(
    await readFile(
      new URL(
        "../artifacts/api-server/src/db/migrations/001_plans.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await c.query("COMMIT");
  console.log("Migration 001 applied.");
} catch {
  await c.query("ROLLBACK");
  console.error("Migration failed; transaction rolled back.");
  process.exitCode = 1;
} finally {
  c.release();
  await pool.end();
}
