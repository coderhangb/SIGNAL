import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  planningReducer as reduce,
} from "../src/state/planning-reducer.js";
test("F01 F12 blank real mode and reset leaves no demo data", () => {
  const s = initialState();
  assert.equal(s.invitation, "");
  assert.deepEqual(s.profile.supports, []);
  assert.equal(s.plan, null);
  assert.deepEqual(
    reduce(
      { ...s, demo: true, invitation: "ABC", plan: {} },
      { type: "RESET" },
    ),
    s,
  );
});
test("F02 F03 stale async result or error cannot overwrite newer input", () => {
  let s = reduce(initialState(), { type: "START", id: "A" });
  s = reduce(s, { type: "INVITATION", value: "B" });
  s = reduce(s, { type: "START", id: "B" });
  assert.equal(
    reduce(s, {
      type: "RESULT",
      id: "A",
      inputRevision: 0,
      value: { analysis: { company: "A" } },
    }),
    s,
  );
  assert.equal(reduce(s, { type: "ERROR", id: "A", message: "old" }), s);
  s = reduce(s, { type: "ERROR", id: "B", message: "failed" });
  assert.equal(s.analysis, null);
  assert.equal(s.step, 0);
  s = reduce(s, { type: "START", id: "B-success" });
  s = reduce(s, {
    type: "RESULT",
    id: "B-success",
    inputRevision: 1,
    value: { analysis: { company: "B" } },
  });
  assert.equal(
    reduce(s, {
      type: "RESULT",
      id: "A",
      inputRevision: 0,
      value: { analysis: { company: "A" } },
    }),
    s,
  );
  assert.equal(s.analysis.company, "B");
});
test("F04 F05 F07 profile/detail/draft reset dependent state", () => {
  const s = {
    ...initialState(),
    access: {},
    draft: { body: "old" },
    consent: true,
    plan: { approval: {} },
  };
  for (const action of [
    { type: "PROFILE", value: s.profile },
    { type: "DETAIL", key: "company", value: "new" },
  ]) {
    const n = reduce(s, action);
    assert.equal(n.draft, null);
    assert.equal(n.consent, false);
    assert.equal(n.plan.approval, null);
  }
  assert.equal(
    reduce(s, { type: "DRAFT", value: { body: "new" } }).consent,
    false,
  );
  const pending = reduce(s, { type: "START", id: "old-draft" });
  const edited = reduce(pending, {
    type: "MANUAL_OBSERVATION",
    value: {
      key: "live_captions",
      status: "unknown",
      details: "Please clarify",
    },
  });
  assert.equal(edited.busy, false);
  assert.equal(edited.requestId, null);
  assert.equal(
    reduce(edited, { type: "ERROR", id: "old-draft", message: "cancelled" }),
    edited,
  );
});
