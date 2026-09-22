import { Router } from "express";
import { catalog } from "../domain/support-catalog.js";
import { AppError, check, object, string } from "../domain/validation.js";
import {
  analysisEnvelope,
  extractRules,
  validateModelOutput,
  validateInterview,
} from "../services/invitation-service.js";
import { requirementsFor, createDraft } from "../services/draft-service.js";
export function signalRoutes({ config, provider, analyses }) {
  const router = Router();
  router.get("/catalog", (_q, r) => r.json(catalog));
  router.post("/analyze-invitation", async (q, r) => {
    object(q.body, ["text", "locale", "inputRevision", "mode", "aiConsent"]);
    const { text, inputRevision, mode = "rules", aiConsent } = q.body;
    string(text, config.invitationLimit);
    check(
      Number.isInteger(inputRevision) && inputRevision >= 0,
      "Invalid input revision.",
    );
    check(["rules", "ai"].includes(mode), "Choose Rules or AI.");
    let result;
    if (mode === "rules") result = extractRules(text, inputRevision);
    else {
      check(aiConsent === true, "Cần đồng ý gửi thư tới nhà cung cấp AI.");
      const model = await provider(text);
      try {
        result = validateModelOutput(model, text, inputRevision);
      } catch {
        throw new AppError(
          422,
          "AI_INVALID_OUTPUT",
          "Kết quả AI sai định dạng. Hãy nhập tay hoặc thử lại.",
          true,
        );
      }
    }
    const analysis = analysisEnvelope(result, text, inputRevision);
    // Bounded, ephemeral extraction tickets. Saved snapshots themselves are persisted in PostgreSQL.
    if (analyses.size >= 1000) analyses.delete(analyses.keys().next().value);
    analyses.set(analysis.analysisId, analysis);
    r.json(analysis);
  });
  function preview(body) {
    const analysis = body.analysisId ? analyses.get(body.analysisId) : null;
    check(
      !body.analysisId || analysis,
      "Phân tích hết hạn. Hãy phân tích lại.",
      409,
      "ANALYSIS_STALE",
    );
    const manual = body.manualObservations ?? [];
    check(Array.isArray(manual), "Invalid manual observations.");
    for (const m of manual) {
      object(m, ["key", "status", "details"]);
      string(m.details, 2000);
      check(
        body.profile.supports.some((s) => s.key === m.key) &&
          [
            "confirmed",
            "needs_confirmation",
            "unknown",
            "not_available",
          ].includes(m.status),
        "Invalid manual observation.",
      );
    }
    return requirementsFor(
      body.profile,
      analysis?.observations ?? [],
      manual.map((m) => ({
        ...m,
        evidence: { quote: m.details, sourceType: "candidate_entered" },
      })),
    );
  }
  router.post("/access-check", (q, r) => {
    object(q.body, [
      "profile",
      "analysisId",
      "reviewedDetails",
      "manualObservations",
    ]);
    validateInterview(q.body.reviewedDetails);
    r.json({ requirements: preview(q.body), preview: true });
  });
  router.post("/accommodation-request", (q, r) => {
    object(q.body, [
      "profile",
      "analysisId",
      "reviewedDetails",
      "manualObservations",
    ]);
    const interview = validateInterview(q.body.reviewedDetails);
    r.json(createDraft(q.body.profile, interview, preview(q.body)));
  });
  return router;
}
