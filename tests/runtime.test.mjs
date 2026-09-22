import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../artifacts/api-server/src/app.js";
import { PlanRepository } from "../artifacts/api-server/src/repositories/plan-repository.js";
import { testPool } from "./helpers/pglite.mjs";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { fork } from "node:child_process";
import path from "node:path";
import { createServer } from "vite";
test("X07 production SPA routes never swallow missing APIs", async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((r) => server.on("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of ["/", "/hr", "/plan/123"]) {
      const r = await fetch(base + route);
      assert.equal(r.status, 200);
      assert.match(r.headers.get("content-type"), /html/);
    }
    const r = await fetch(base + "/api/missing");
    assert.equal(r.status, 404);
    assert.match(r.headers.get("content-type"), /json/);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
test("X06 local Vite 5173 -> Express 3000 proxy returns real JSON", async () => {
  const backend = createApp().listen(3000, "127.0.0.1");
  await new Promise((r) => backend.on("listening", r));
  let vite;
  try {
    vite = await createServer({
      configFile: path.resolve("artifacts/signal/vite.config.js"),
    });
    await vite.listen();
    const health = await fetch("http://localhost:5173/api/healthz");
    assert.equal((await health.json()).status, "ok");
    const r = await fetch("http://localhost:5173/api/v2/analyze-invitation", {
      method: "POST",
      headers: {
        Origin: "http://localhost:5173",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "Live captions will not be available.",
        inputRevision: 1,
      }),
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).observations[0].status, "not_available");
  } finally {
    await vite?.close();
    await new Promise((r) => backend.close(r));
  }
});
test("X08 backend process restart preserves owner, snapshot, HR grant/response and approval on disk", async () => {
  await mkdir("test-results", { recursive: true });
  const dir = await mkdtemp(path.resolve("test-results/restart-"));
  const pool = await testPool(dir),
    repo = new PlanRepository(pool);
  const session = await repo.session(null, 1);
  const snapshot = {
    profile: {
      communicationMethods: [],
      supports: [],
      shareCommunicationMethods: false,
    },
    interview: {
      date: "2026-10-08",
      time: "09:00",
      timezone: "Asia/Ho_Chi_Minh",
      format: "Online",
      locationOrLink: "https://example.com/test",
    },
    observations: [],
    requirements: [],
    draft: { subject: "test", body: "persistent fixture" },
  };
  const p = await repo.create(session.id, snapshot, "restart-test");
  await pool.end();
  const start = async () => {
    const child = fork("tests/helpers/server.mjs", {
      env: { ...process.env, TEST_DATA_DIR: dir },
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      windowsHide: true,
    });
    await new Promise((resolve, reject) => {
      child.once("message", resolve);
      child.once("exit", () => reject(new Error("server start failed")));
    });
    return child;
  };
  const stop = async (child) => {
    child.send("shutdown");
    await new Promise((r) => child.once("exit", r));
  };
  const call = async (
    url,
    method = "GET",
    data,
    cookie = `candidate=${session.token}`,
    csrf = session.csrf,
  ) => {
    const response = await fetch(`http://127.0.0.1:4173/api/v2${url}`, {
      method,
      headers: {
        Origin: "http://127.0.0.1:4173",
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrf,
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    assert.equal(response.ok, true, `HTTP ${response.status}`);
    return { headers: response.headers, body: await response.json() };
  };
  let child = await start();
  try {
    const share = await call(`/plans/${p.id}/share`, "POST", {
      expectedRevision: 1,
      sharedFields: ["supports"],
      consentAccepted: true,
    });
    const hr = await call(
      "/hr/exchange",
      "POST",
      { token: new URL(share.body.shareUrl).hash.split("=")[1] },
      "",
      "",
    );
    const hrCookie = hr.headers.get("set-cookie").split(";")[0];
    await call(
      "/hr/response",
      "POST",
      {
        expectedResponseRevision: 0,
        answers: [],
        responderLabel: "Restart fixture",
      },
      hrCookie,
      hr.body.csrf,
    );
    await call(`/plans/${p.id}/approve`, "POST", {
      expectedRevision: 1,
      responseRevision: 1,
      reviewed: true,
      decisions: { acceptedAlternatives: {}, acknowledgedPreferred: [] },
    });
    await stop(child);
    child = await start();
    const restored = (await call(`/plans/${p.id}`)).body;
    assert.equal(restored.snapshot.draft.body, "persistent fixture");
    assert.equal(restored.readiness.status, "ready");
    assert.equal(restored.response.revision, 1);
    assert.equal(restored.grants.length, 1);
    assert.equal(
      (await call("/hr/plan", "GET", null, hrCookie, hr.body.csrf)).body
        .response.responderLabel,
      "Restart fixture",
    );
  } finally {
    await stop(child);
  }
});
test("S09 frontend bundles exclude server AI/DB secrets and adapters", async () => {
  const html = await readFile(
    "artifacts/signal/dist/public/index.html",
    "utf8",
  );
  const js = html.match(/src="([^"]+\.js)"/)[1];
  const text = await readFile(`artifacts/signal/dist/public${js}`, "utf8");
  assert.doesNotMatch(
    text,
    /AI_API_KEY|DATABASE_URL|Bearer.*aiKey|postgresql:\/\//,
  );
});
