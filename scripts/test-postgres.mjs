import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
// Optional local TEST database helper, never used by production startup.
const dir = path.resolve(process.env.TEST_PG_DIR || "test-data/postgres");
const instance = new EmbeddedPostgres({
  databaseDir: dir,
  user: "signal_test",
  password: "local-test-only",
  port: 55432,
  persistent: true,
  createPostgresUser: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
if (!existsSync(path.join(dir, "PG_VERSION"))) await instance.initialise();
await instance.start();
const admin = new pg.Pool({
  connectionString:
    "postgresql://signal_test:local-test-only@127.0.0.1:55432/postgres",
});
if (
  !(await admin.query("SELECT 1 FROM pg_database WHERE datname='signal_test'"))
    .rows.length
)
  await admin.query("CREATE DATABASE signal_test");
await admin.end();
const pool = new pg.Pool({
  connectionString:
    "postgresql://signal_test:local-test-only@127.0.0.1:55432/signal_test",
});
await pool.query(
  await readFile(
    "artifacts/api-server/src/db/migrations/001_plans.sql",
    "utf8",
  ),
);
console.log(
  "Isolated PostgreSQL signal_test running on 127.0.0.1:55432. Migration applied.",
);
await pool.end();
for (const event of ["SIGINT", "SIGTERM"])
  process.on(event, async () => {
    await instance.stop();
    process.exit(0);
  });
setInterval(() => {}, 60000);
