import { createApp } from "../../artifacts/api-server/src/app.js";
import { PlanRepository } from "../../artifacts/api-server/src/repositories/plan-repository.js";
import { readConfig } from "../../artifacts/api-server/src/config/env.js";
import { testPool } from "./pglite.mjs";
const pool = await testPool(process.env.TEST_DATA_DIR);
const config = {
  ...readConfig({}),
  origin: "http://127.0.0.1:4173",
  rateLimit: 10000,
};
const server = createApp({ config, repo: new PlanRepository(pool) }).listen(
  4173,
  "127.0.0.1",
  () => {
    console.log("E2E app ready; isolated test database only.");
    process.send?.("ready");
  },
);
const stop = () => {
  server.closeIdleConnections();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};
for (const event of ["SIGINT", "SIGTERM"]) process.on(event, stop);
process.on("message", (message) => {
  if (message === "shutdown") stop();
});
