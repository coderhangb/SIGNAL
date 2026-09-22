import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import pg from "pg";
// Real PostgreSQL SQL engine in WASM for tests only. Production always uses pg/ PostgreSQL.
export async function testPool(dataDir) {
  if (process.env.TEST_DATABASE_URL) {
    if (
      !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("/signal_test")
    )
      throw new Error("Use a dedicated signal_test database.");
    const pool = new pg.Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      max: 8,
    });
    await pool.query(
      await readFile(
        new URL(
          "../../artifacts/api-server/src/db/migrations/001_plans.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    return pool;
  }
  const db = new PGlite(dataDir);
  await db.waitReady;
  await db.exec(
    await readFile(
      new URL(
        "../../artifacts/api-server/src/db/migrations/001_plans.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  let tail = Promise.resolve();
  const pool = {
    connect: async () => {
      let release;
      const before = tail;
      tail = new Promise((r) => (release = r));
      await before;
      return { query: (...args) => db.query(...args), release };
    },
    query: (...args) => db.query(...args),
    end: () => db.close(),
    db,
  };
  return pool;
}
