import { fork, spawn } from "node:child_process";
const server = fork("tests/helpers/server.mjs", {
  stdio: ["ignore", "inherit", "inherit", "ipc"],
  windowsHide: true,
});
let ready = false;
const startup = new Promise((resolve, reject) => {
  server.once("message", (m) => {
    if (m === "ready") {
      ready = true;
      resolve();
    }
  });
  server.once("exit", () => {
    if (!ready)
      reject(new Error("E2E server failed to start. Check port 4173."));
  });
});
try {
  await startup;
  const child = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
    {
      stdio: "inherit",
      env: { ...process.env, E2E_EXTERNAL_SERVER: "1" },
      windowsHide: true,
    },
  );
  process.exitCode = await new Promise((resolve) =>
    child.once("exit", (code) => resolve(code ?? 1)),
  );
} finally {
  if (server.connected) server.send("shutdown");
  const timer = setTimeout(() => server.kill(), 10000);
  timer.unref();
  await new Promise((resolve) =>
    server.exitCode !== null ? resolve() : server.once("exit", resolve),
  );
  clearTimeout(timer);
}
