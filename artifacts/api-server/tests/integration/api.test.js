import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../src/app.js";
import { readConfig } from "../../src/config/env.js";
import {
  PlanRepository,
  hash,
} from "../../src/repositories/plan-repository.js";
import { testPool } from "../../../../tests/helpers/pglite.mjs";
import { invitations, profile, details } from "../fixtures/invitations.js";
import { emptyInterview } from "../../src/services/invitation-service.js";
let pool, server, base, repo;
const logs = [];
const config = { ...readConfig({}), rateLimit: 10000 };
let providerCalls = 0,
  providerResult = { interview: emptyInterview(), observations: [] };
before(async () => {
  pool = await testPool();
  repo = new PlanRepository(pool);
  server = createApp({
    config,
    repo,
    provider: async () => {
      providerCalls++;
      return providerResult;
    },
    log: (e) => logs.push(e),
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.on("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api/v2`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await pool.end();
});
function browser() {
  let cookie = "",
    csrf = "";
  return {
    get cookie() {
      return cookie;
    },
    async call(path, method = "GET", data, extra = {}) {
      const r = await fetch(base + path, {
        method,
        headers: {
          Origin: config.origin,
          "Content-Type": "application/json",
          Cookie: cookie,
          "X-CSRF-Token": csrf,
          ...extra,
        },
        ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
      });
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      const body =
        r.status === 204
          ? null
          : r.headers.get("content-type")?.includes("application/json")
            ? await r.json()
            : await r.text();
      if (body?.csrf) csrf = body.csrf;
      return { status: r.status, body, headers: r.headers };
    },
  };
}
async function setup(p = profile()) {
  const a = browser();
  assert.equal((await a.call("/session", "POST", {})).status, 200);
  const analyzed = (
    await a.call("/analyze-invitation", "POST", {
      text: invitations.INV04,
      inputRevision: 1,
      mode: "rules",
    })
  ).body;
  const snapshot = {
    profile: p,
    invitation: invitations.INV04,
    analysisId: analyzed.analysisId,
    mode: "rules",
    interview: details,
    draft: { subject: "Interview", body: "Please confirm selected support." },
    manualObservations: [],
  };
  const created = await a.call("/plans", "POST", {
    snapshot,
    idempotencyKey: crypto.randomUUID(),
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return { a, plan: created.body, snapshot };
}
async function share(a, plan, fields = ["supports"]) {
  const r = await a.call(`/plans/${plan.id}/share`, "POST", {
    expectedRevision: plan.revision,
    sharedFields: fields,
    consentAccepted: true,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const hr = browser();
  assert.equal(
    (
      await hr.call("/hr/exchange", "POST", {
        token: new URL(r.body.shareUrl).hash.split("=")[1],
      })
    ).status,
    200,
  );
  return { hr, grant: r.body };
}
test("A01 A02 A03 A04 A05 A09 A10 input/schema, safe text and mode", async () => {
  const a = browser();
  for (const text of ["", 2, {}, "x".repeat(20001)])
    assert.equal(
      (await a.call("/analyze-invitation", "POST", { text, inputRevision: 1 }))
        .status,
      400,
    );
  assert.equal(
    (
      await a.call("/analyze-invitation", "POST", {
        text: "x".repeat(140000),
        inputRevision: 1,
      })
    ).status,
    413,
  );
  assert.equal(providerCalls, 0);
  const html = "Company: <script>alert(1)</script>";
  let r = await a.call("/analyze-invitation", "POST", {
    text: html,
    inputRevision: 2,
  });
  assert.equal(r.body.interview.company, "<script>alert(1)</script>");
  assert.equal(r.body.extractionMode, "rules");
  r = await a.call("/analyze-invitation", "POST", {
    text: invitations.INV04,
    inputRevision: 3,
    mode: "ai",
    aiConsent: true,
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.extractionMode, "ai");
  assert.equal(r.body.inputRevision, 3);
  providerResult = {
    interview: emptyInterview(),
    observations: [
      { key: "live_captions", status: "probably_ready", quote: null },
    ],
  };
  assert.equal(
    (
      await a.call("/analyze-invitation", "POST", {
        text: "hello",
        inputRevision: 4,
        mode: "ai",
        aiConsent: true,
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await a.call("/analyze-invitation", "POST", {
        text: "hello",
        inputRevision: 4,
        ownerId: "fake",
      })
    ).status,
    400,
  );
});
test("I01 I02 I03 I04 I06 I14 ownership, idempotency, conflict, rollback", async () => {
  const { a, plan, snapshot } = await setup();
  assert.equal(plan.revision, 1);
  const b = browser();
  await b.call("/session", "POST", {});
  assert.equal((await b.call(`/plans/${plan.id}`)).status, 404);
  const key = crypto.randomUUID();
  const one = await a.call("/plans", "POST", { snapshot, idempotencyKey: key });
  const two = await a.call("/plans", "POST", { snapshot, idempotencyKey: key });
  assert.equal(one.body.id, two.body.id);
  assert.equal(
    (
      await a.call("/plans", "POST", {
        snapshot: {
          ...snapshot,
          draft: { subject: "Changed", body: "Different" },
        },
        idempotencyKey: key,
      })
    ).status,
    409,
  );
  const changes = {
    ...snapshot,
    interview: { ...details, company: "Updated" },
  };
  const concurrent = await Promise.all([
    a.call(`/plans/${plan.id}`, "PATCH", { expectedRevision: 1, changes }),
    a.call(`/plans/${plan.id}`, "PATCH", { expectedRevision: 1, changes }),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (
      await a.call(`/plans/${plan.id}/share`, "POST", {
        expectedRevision: 1,
        consentAccepted: true,
        sharedFields: ["supports"],
      })
    ).status,
    409,
  );
  const oldEvent = repo.event;
  repo.event = async () => {
    throw new Error("injected event failure");
  };
  const failed = await a.call(`/plans/${plan.id}`, "PATCH", {
    expectedRevision: 2,
    changes: snapshot,
  });
  assert.equal(failed.status, 503);
  repo.event = oldEvent;
  const unchanged = await a.call(`/plans/${plan.id}`);
  assert.equal(unchanged.body.revision, 2);
  assert.equal(unchanged.body.snapshot.interview.company, "Updated");
});
test("I05 I07 I08 I09 I10 I11 I12 I13 S03 S04 S11 HR scope and review invalidation", async () => {
  const { a, plan } = await setup();
  const { hr, grant } = await share(a, plan);
  const view = await hr.call("/hr/plan");
  assert.equal(view.body.response, null);
  for (const key of [
    "invitation",
    "communicationMethods",
    "owner_session_id",
    "draft",
  ])
    assert.equal(view.body[key], undefined);
  assert.equal((await hr.call(`/plans/${plan.id}`, "PATCH", {})).status, 401);
  const payload = {
    expectedResponseRevision: 0,
    responderLabel: "Test HR",
    answers: [
      {
        key: "live_captions",
        status: "confirmed",
        details: "We will enable captions in the meeting.",
      },
    ],
  };
  assert.equal(
    (
      await hr.call("/hr/response", "POST", {
        ...payload,
        answers: [{ ...payload.answers[0], key: "extra_clarification_time" }],
      })
    ).status,
    400,
  );
  const concurrent = await Promise.all([
    hr.call("/hr/response", "POST", payload),
    hr.call("/hr/response", "POST", payload),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  const approve = {
    expectedRevision: 1,
    responseRevision: 1,
    reviewed: true,
    decisions: { acceptedAlternatives: {}, acknowledgedPreferred: [] },
  };
  assert.equal(
    (
      await a.call(`/plans/${plan.id}/approve`, "POST", {
        ...approve,
        responseRevision: 0,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await a.call(`/plans/${plan.id}/approve`, "POST", {
        ...approve,
        decisions: {
          acceptedAlternatives: { live_captions: "invented" },
          acknowledgedPreferred: [],
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (await a.call(`/plans/${plan.id}/approve`, "POST", approve)).body.readiness
      .status,
    "ready",
  );
  const oldEvent = repo.event;
  repo.event = async () => {
    throw new Error("event failure after approval invalidation");
  };
  assert.equal(
    (
      await hr.call("/hr/response", "POST", {
        ...payload,
        expectedResponseRevision: 1,
      })
    ).status,
    503,
  );
  repo.event = oldEvent;
  const rolledBack = (await a.call(`/plans/${plan.id}`)).body;
  assert.equal(rolledBack.response.revision, 1);
  assert.equal(rolledBack.readiness.status, "ready");
  assert.ok(rolledBack.approval);
  assert.equal(
    (
      await hr.call("/hr/response", "POST", {
        ...payload,
        expectedResponseRevision: 1,
        answers: [
          {
            key: "live_captions",
            status: "not_available",
            details: "Caption service unavailable.",
          },
        ],
      })
    ).status,
    200,
  );
  const updated = await a.call(`/plans/${plan.id}`);
  assert.equal(updated.body.approval, null);
  assert.equal(updated.body.readiness.status, "needs_action");
  assert.equal(
    (
      await a.call(`/plans/${plan.id}/revoke-share`, "POST", {
        expectedRevision: 1,
        grantId: grant.grantId,
      })
    ).status,
    200,
  );
  assert.equal((await hr.call("/hr/plan")).status, 401);
  assert.equal((await hr.call("/hr/response", "POST", payload)).status, 401);
});
test("S01 S02 S05 S06 F08 I16 missing/expired sessions, CSRF, consent, deletion", async () => {
  const anonymous = browser();
  assert.equal(
    (await anonymous.call("/plans/00000000-0000-0000-0000-000000000000"))
      .status,
    401,
  );
  assert.equal(
    (await anonymous.call("/hr/exchange", "POST", { token: "invalid" })).status,
    410,
  );
  const { a, plan } = await setup();
  assert.equal(
    (
      await a.call(`/plans/${plan.id}/share`, "POST", {
        expectedRevision: 1,
        sharedFields: ["supports"],
        consentAccepted: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await a.call(
        `/plans/${plan.id}/share`,
        "POST",
        {},
        { "X-CSRF-Token": "bad" },
      )
    ).status,
    403,
  );
  assert.equal(
    (await a.call("/session", "POST", {}, { Origin: "https://evil.invalid" }))
      .status,
    403,
  );
  const { hr, grant } = await share(a, plan);
  await pool.query(
    "UPDATE share_grants SET expires_at=now()-interval '1 second' WHERE id=$1",
    [grant.grantId],
  );
  assert.equal((await hr.call("/hr/plan")).status, 401);
  const active = await share(a, plan);
  assert.equal(
    (await a.call(`/plans/${plan.id}`, "DELETE", { expectedRevision: 1 }))
      .status,
    204,
  );
  assert.equal((await active.hr.call("/hr/plan")).status, 401);
  assert.equal(
    (
      await pool.query("SELECT * FROM plan_versions WHERE plan_id=$1", [
        plan.id,
      ])
    ).rows.length,
    0,
  );
  assert.ok(
    logs.every(
      (e) => Object.keys(e).sort().join(",") === "method,requestId,status",
    ),
  );
});
test("I15 DB outage never issues an unpersisted share link", async () => {
  const { a, plan } = await setup();
  const saved = repo.pool;
  repo.pool = null;
  const r = await a.call(`/plans/${plan.id}/share`, "POST", {
    expectedRevision: 1,
    sharedFields: ["supports"],
    consentAccepted: true,
  });
  repo.pool = saved;
  assert.equal(r.status, 503);
  assert.equal(r.body.shareUrl, undefined);
});
test("S08 rate limit returns retry instructions", async () => {
  const s = createApp({ config: { ...config, rateLimit: 1 } }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise((r) => s.on("listening", r));
  const url = `http://127.0.0.1:${s.address().port}/api/v2/catalog`;
  await fetch(url);
  const r = await fetch(url);
  assert.equal(r.status, 429);
  assert.equal(r.headers.get("retry-after"), "60");
  await new Promise((r) => s.close(r));
});
test("F15 S02 S03 S10 expired sessions, token expiry/revocation and cookie flags", async () => {
  const { a, plan } = await setup();
  const { hr, grant } = await share(a, plan);
  assert.equal(
    (await hr.call(`/plans/${plan.id}/approve`, "POST", {})).status,
    401,
  );
  await pool.query(
    "UPDATE share_grants SET expires_at=now()-interval '1 second' WHERE id=$1",
    [grant.grantId],
  );
  assert.equal(
    (
      await browser().call("/hr/exchange", "POST", {
        token: new URL(grant.shareUrl).hash.split("=")[1],
      })
    ).status,
    410,
  );
  const fresh = await share(a, plan);
  await a.call(`/plans/${plan.id}/revoke-share`, "POST", {
    expectedRevision: 1,
    grantId: fresh.grant.grantId,
  });
  assert.equal(
    (
      await browser().call("/hr/exchange", "POST", {
        token: new URL(fresh.grant.shareUrl).hash.split("=")[1],
      })
    ).status,
    410,
  );
  const token = a.cookie.split("=")[1];
  await pool.query(
    "UPDATE candidate_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
    [hash(token)],
  );
  assert.equal((await a.call("/session")).status, 401);
  assert.equal((await a.call(`/plans/${plan.id}`)).status, 401);
  const r = await browser().call("/session", "POST", {});
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  assert.match(r.headers.get("set-cookie"), /SameSite=Strict/);
  const secure = createApp({
    config: { ...config, production: true },
    repo,
  }).listen(0, "127.0.0.1");
  await new Promise((r) => secure.on("listening", r));
  const response = await fetch(
    `http://127.0.0.1:${secure.address().port}/api/v2/session`,
    {
      method: "POST",
      headers: { Origin: config.origin, "Content-Type": "application/json" },
      body: "{}",
    },
  );
  assert.match(response.headers.get("set-cookie"), /Secure/);
  await new Promise((r) => secure.close(r));
});
test("A10 server rejects invented provenance/readiness and snapshots tied to other text", async () => {
  const { a, snapshot, plan } = await setup();
  for (const extra of [
    { ownerId: "other" },
    { readiness: "ready" },
    { sourceType: "hr_response" },
  ])
    assert.equal(
      (
        await a.call("/plans", "POST", {
          snapshot: { ...snapshot, ...extra },
          idempotencyKey: crypto.randomUUID(),
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await a.call("/plans", "POST", {
        snapshot: {
          ...snapshot,
          manualObservations: [
            {
              key: "live_captions",
              status: "confirmed",
              details: "invented",
              sourceType: "hr_response",
            },
          ],
        },
        idempotencyKey: crypto.randomUUID(),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await a.call(`/plans/${plan.id}`, "PATCH", {
        expectedRevision: 1,
        changes: { ...snapshot, invitation: "different" },
      })
    ).status,
    409,
  );
});

test("S08 analyze/exchange rate limiting prevents repeated provider calls", async () => {
  let calls = 0;
  const limited = createApp({
    config: { ...config, rateLimit: 1 },
    provider: async () => {
      calls++;
      return { interview: emptyInterview(), observations: [] };
    },
  }).listen(0, "127.0.0.1");
  await new Promise((r) => limited.on("listening", r));
  const url = `http://127.0.0.1:${limited.address().port}/api/v2`;
  try {
    const request = {
      method: "POST",
      headers: { Origin: config.origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "New invitation",
        inputRevision: 1,
        mode: "ai",
        aiConsent: true,
      }),
    };
    assert.equal(
      (await fetch(url + "/analyze-invitation", request)).status,
      200,
    );
    assert.equal(
      (await fetch(url + "/analyze-invitation", request)).status,
      429,
    );
    assert.equal(
      (
        await fetch(url + "/hr/exchange", {
          ...request,
          body: JSON.stringify({ token: "invalid" }),
        })
      ).status,
      429,
    );
    assert.equal(calls, 1);
  } finally {
    await new Promise((r) => limited.close(r));
  }
});
