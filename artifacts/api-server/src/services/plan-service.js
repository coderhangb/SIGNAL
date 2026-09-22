import { check, object, string, statuses } from "../domain/validation.js";
import { normalizeProfile } from "../domain/support-catalog.js";
import {
  extractRules,
  inputHash,
  validateInterview,
} from "./invitation-service.js";
import { requirementsFor } from "./draft-service.js";
export function makeSnapshot(input, analyses) {
  object(input, [
    "profile",
    "invitation",
    "analysisId",
    "mode",
    "interview",
    "draft",
    "manualObservations",
    "demo",
  ]);
  check(input.demo !== true, "Demo không tạo phản hồi HR thật.");
  const profile = normalizeProfile(input.profile);
  string(input.invitation, 20000, false);
  check(
    ["manual", "rules", "ai"].includes(input.mode),
    "Invalid analysis mode.",
  );
  let observations;
  if (input.mode === "manual")
    observations = extractRules("", 1).observations.map((o) => ({
      ...o,
      extractionMode: "manual",
    }));
  else {
    const analysis = analyses.get(input.analysisId);
    check(
      analysis &&
        analysis.inputHash === inputHash(input.invitation) &&
        analysis.extractionMode === input.mode,
      "Phân tích đã hết hạn hoặc không khớp thư. Phân tích lại.",
      409,
      "ANALYSIS_STALE",
    );
    observations = structuredClone(analysis.observations);
  }
  object(input.draft, ["subject", "body", "mode", "warnings"]);
  string(input.draft.subject, 300);
  string(input.draft.body, 10000);
  const manualObservations = input.manualObservations ?? [];
  check(
    Array.isArray(manualObservations) &&
      manualObservations.length <= profile.supports.length,
    "Invalid manual observations.",
  );
  const seen = new Set();
  const manual = manualObservations.map((o) => {
    object(o, ["key", "status", "details"]);
    check(
      profile.supports.some((s) => s.key === o.key) &&
        !seen.has(o.key) &&
        statuses.includes(o.status),
      "Invalid manual observation.",
    );
    seen.add(o.key);
    string(o.details, 2000);
    // Client cannot claim an HR source. Timestamps and source labels are server assigned.
    return {
      key: o.key,
      status: o.status,
      details: o.details,
      evidence: {
        quote: o.details,
        sourceType: "candidate_entered",
        timestamp: new Date().toISOString(),
      },
    };
  });
  return {
    profile,
    invitation: input.invitation,
    analysisId: input.analysisId ?? null,
    mode: input.mode,
    interview: validateInterview(input.interview),
    draft: {
      subject: input.draft.subject,
      body: input.draft.body,
      mode: "edited_template",
    },
    observations,
    manualObservations,
    requirements: requirementsFor(profile, observations, manual),
  };
}
export function sharedProjection(snapshot, fields) {
  check(
    Array.isArray(fields) &&
      fields.includes("supports") &&
      fields.every((k) =>
        [
          "supports",
          "interview",
          "draft",
          "communicationMethods",
          "invitation",
        ].includes(k),
      ) &&
      new Set(fields).size === fields.length,
    "Invalid shared fields.",
  );
  check(
    !fields.includes("communicationMethods") ||
      snapshot.profile.shareCommunicationMethods,
    "Chưa đồng ý chia sẻ cách giao tiếp.",
  );
  const projection = { supports: snapshot.profile.supports };
  if (snapshot.profile.supports.some((s) => s.key === "vsl_interpreter"))
    projection.interpreterNotes = snapshot.profile.interpreterNotes || "";
  for (const k of fields) {
    if (k === "supports") continue;
    projection[k] =
      k === "communicationMethods"
        ? snapshot.profile.communicationMethods
        : snapshot[k];
  }
  return projection;
}
export function validateDecisions(input, plan) {
  object(input, ["acceptedAlternatives", "acknowledgedPreferred"]);
  object(
    input.acceptedAlternatives,
    plan.snapshot.profile.supports.map((s) => s.key),
  );
  for (const [key, proposal] of Object.entries(input.acceptedAlternatives)) {
    check(
      typeof proposal === "string" &&
        proposal.length > 0 &&
        plan.response?.answers.some(
          (a) => a.key === key && a.alternativeProposal === proposal,
        ),
      "Phương án không tồn tại trong phản hồi hiện tại.",
    );
  }
  check(
    Array.isArray(input.acknowledgedPreferred) &&
      input.acknowledgedPreferred.every((k) =>
        plan.snapshot.profile.supports.some(
          (s) => s.key === k && s.importance === "preferred",
        ),
      ),
    "Invalid preferred acknowledgment.",
  );
  return input;
}
