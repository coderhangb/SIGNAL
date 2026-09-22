import test from "node:test";
import assert from "node:assert/strict";
import {
  invitations as inv,
  profile,
  details,
} from "../fixtures/invitations.js";
import {
  extractRules,
  validateModelOutput,
  emptyInterview,
} from "../../src/services/invitation-service.js";
import { normalizeProfile, catalog } from "../../src/domain/support-catalog.js";
import {
  requirementsFor,
  createDraft,
} from "../../src/services/draft-service.js";
import {
  computeReadiness,
  exportPlan,
} from "../../src/domain/readiness-policy.js";
import { classifySupportObservation } from "../../src/domain/status-policy.js";
const get = (text, key) =>
  extractRules(text).observations.find((o) => o.key === key);
for (const [id, fixture, key, expected] of [
  ["U05", "INV01", "live_captions", "confirmed"],
  ["U06", "INV02", "live_captions", "not_available"],
  ["U07", "INV03", "live_captions", "needs_confirmation"],
  ["U08", "INV04", "live_captions", "unknown"],
  ["U09", "INV05", "vsl_interpreter", "not_available"],
  ["U09", "INV05", "live_captions", "confirmed"],
  ["U10", "INV06", "written_questions_during", "confirmed"],
  ["U10", "INV06", "questions_in_advance", "not_available"],
  ["U11", "INV07", "live_captions", "needs_confirmation"],
  ["U11", "INV07", "vsl_interpreter", "not_available"],
  ["U12", "INV09", "live_captions", "needs_confirmation"],
  ["U13", "INV11", "vsl_interpreter", "needs_confirmation"],
  ["U14", "INV12", "vsl_interpreter", "needs_confirmation"],
])
  test(`${id} ${fixture} ${key}`, () => {
    const o = get(inv[fixture], key);
    assert.equal(o.status, expected);
    if (o.evidence)
      assert.equal(
        inv[fixture].slice(o.evidence.start, o.evidence.end),
        o.evidence.quote,
      );
  });
test("U01 U02 VSL clarification and HR interpreter exactly once", () => {
  const p = { ...profile(), communicationMethods: ["vsl"] };
  assert.throws(() => normalizeProfile(p));
  assert.throws(() => normalizeProfile({ ...p, interpreterArrangement: "hr" }));
  assert.equal(
    normalizeProfile({
      ...p,
      interpreterArrangement: "hr",
      supports: [
        { key: "vsl_interpreter", importance: "essential" },
        { key: "vsl_interpreter", importance: "preferred" },
      ],
    }).supports.length,
    1,
  );
});
test("U03 U04 U17 stable keys, written responses, dedupe and reject unknown", () => {
  const p = profile([
    { key: "written_responses", importance: "essential" },
    { key: "written_responses", importance: "preferred" },
  ]);
  assert.equal(requirementsFor(p)[0].key, "written_responses");
  assert.equal(normalizeProfile(p).supports[0].importance, "essential");
  assert.equal(catalog.supports.length, 9);
  assert.throws(() =>
    normalizeProfile(profile([{ key: "fake", importance: "essential" }])),
  );
});
test("U12 conflict keeps both quotations", () =>
  assert.equal(get(inv.INV09, "live_captions").evidenceHistory.length, 2));
test("U15 invalid quote cannot confirm; U16 forwarded context cannot confirm", () => {
  const result = validateModelOutput(
    {
      interview: emptyInterview(),
      observations: [
        {
          key: "live_captions",
          status: "confirmed",
          quote: "We will provide captions.",
        },
      ],
    },
    inv.INV04,
    1,
  );
  assert.equal(result.observations[0].status, "unknown");
  assert.ok(result.warnings.length);
  assert.equal(
    get(
      "Forwarded message: Previous interview. We will enable live captions.",
      "live_captions",
    ).status,
    "needs_confirmation",
  );
});
test("U18 U19 U20 U21 U22 template uses selected pending supports only", () => {
  const p = profile();
  const make = (text) =>
    createDraft(
      p,
      emptyInterview(),
      requirementsFor(p, extractRules(text).observations),
    ).body;
  const pending = make(inv.INV04);
  assert.match(pending, /Phụ đề/);
  assert.doesNotMatch(
    pending,
    /VSL|chat|ABC|24 September|Tôi chọn giao tiếp|Deaf/,
  );
  assert.doesNotMatch(make(inv.INV01), /Xin xác nhận/);
  assert.match(make(inv.INV02), /phương án phù hợp khác/);
});
test("U23 U24 ambiguous date and absent timezone stay null", () => {
  const a = extractRules(inv.INV10);
  assert.equal(a.interview.date, null);
  assert.equal(a.rawValues.date, "10/11/2026");
  assert.equal(a.interview.timezone, null);
});
test("A08 prompt injection yields no confirmations", () =>
  assert.ok(
    extractRules(inv.INV08).observations.every((o) => o.status !== "confirmed"),
  ));
test("U25 U26 U27 U28 U29 candidate approval gates readiness and export", () => {
  const plan = {
    revision: 1,
    snapshot: {
      interview: details,
      requirements: [
        {
          key: "vsl_interpreter",
          name: "Phiên dịch",
          importance: "essential",
          status: "not_available",
        },
        {
          key: "live_captions",
          name: "Phụ đề",
          importance: "preferred",
          status: "unknown",
        },
      ],
    },
    response: {
      revision: 1,
      answers: [
        {
          key: "vsl_interpreter",
          status: "not_available",
          alternativeProposal: "Written interview",
          details: "No interpreter",
        },
      ],
    },
    approval: null,
  };
  assert.equal(computeReadiness(plan).status, "needs_action");
  plan.approval = {
    planRevision: 1,
    responseRevision: 1,
    reviewed: true,
    decisions: {
      acceptedAlternatives: { vsl_interpreter: "Written interview" },
      acknowledgedPreferred: [],
    },
  };
  assert.equal(computeReadiness(plan).status, "awaiting_candidate_review");
  plan.approval.decisions.acknowledgedPreferred = ["live_captions"];
  assert.equal(computeReadiness(plan).status, "ready");
  assert.match(exportPlan(plan), /Written interview/);
  assert.match(exportPlan(plan), /Hỗ trợ chưa đáp ứng: live_captions/);
  plan.response.revision = 2;
  assert.equal(computeReadiness(plan).status, "needs_action");
});
test("Invalid calendar date, time or timezone cannot be ready", () => {
  const p = {
    revision: 1,
    snapshot: {
      interview: {
        ...details,
        date: "2026-02-30",
        time: "25:01",
        timezone: "guess",
      },
      requirements: [],
    },
    approval: {
      planRevision: 1,
      responseRevision: 0,
      reviewed: true,
      decisions: {},
    },
  };
  assert.deepEqual(computeReadiness(p).missingDetails, [
    "date",
    "time",
    "timezone",
  ]);
});

test("U20 U23 U24 AI cannot fabricate missing company, year or timezone", () => {
  const result = validateModelOutput(
    {
      interview: {
        ...emptyInterview(),
        company: "ABC Company",
        date: "2026-09-24",
        timezone: "Asia/Ho_Chi_Minh",
      },
      observations: [],
    },
    "Interview on 24 September.",
    1,
  );
  assert.equal(result.interview.company, null);
  assert.equal(result.interview.date, null);
  assert.equal(result.interview.timezone, null);
  assert.equal(result.warnings.length, 3);
});
test("Policy contract: absent, denial, conditions, conflict, and unvalidated affirmation", () => {
  for (const [assertion, conditional, evidenceValidated, expected] of [
    ["affirmed", false, true, "confirmed"],
    ["denied", false, true, "not_available"],
    ["affirmed", true, true, "needs_confirmation"],
    ["absent", false, false, "unknown"],
    ["conflicting", false, true, "needs_confirmation"],
    ["affirmed", false, false, "needs_confirmation"],
  ])
    assert.equal(
      classifySupportObservation({ assertion, conditional, evidenceValidated })
        .status,
      expected,
    );
});
test("U25 captions already confirmed never automatically replace essential interpreter", () => {
  const p = {
    revision: 1,
    snapshot: {
      interview: details,
      requirements: [
        {
          key: "vsl_interpreter",
          importance: "essential",
          status: "not_available",
        },
        { key: "live_captions", importance: "essential", status: "confirmed" },
      ],
    },
  };
  assert.equal(computeReadiness(p).status, "needs_action");
});
