import { Router } from "express";
import { randomUUID } from "node:crypto";
import { check, object, string, revision } from "../domain/validation.js";
export function hrRoutes({ repo, cookieOptions }) {
  const router = Router();
  router.post("/exchange", async (q, r) => {
    object(q.body, ["token"]);
    string(q.body.token, 100);
    const session = await repo.exchange(q.body.token);
    r.cookie("hr", session.token, cookieOptions).json({ csrf: session.csrf });
  });
  router.use(async (q, _r, next) => {
    q.actor = await repo.authenticate(q.cookies.hr, "hr");
    if (q.method !== "GET")
      check(
        q.headers["x-csrf-token"] === q.actor.csrf,
        "CSRF không hợp lệ.",
        403,
        "FORBIDDEN",
      );
    next();
  });
  router.get("/plan", async (q, r) =>
    r.json(
      await repo.scoped(q.actor.grant_id, async (_c, p, g) => ({
        ...g.projection_json,
        response: p.response,
        responseRevision: p.response?.revision ?? 0,
        csrf: q.actor.csrf,
        sourceNotice:
          "Người trả lời tự khai; liên kết không xác minh danh tính.",
      })),
    ),
  );
  router.post("/response", async (q, r) => {
    object(q.body, ["expectedResponseRevision", "answers", "responderLabel"]);
    string(q.body.responderLabel, 200);
    check(
      Array.isArray(q.body.answers) && q.body.answers.length <= 9,
      "Invalid answers.",
    );
    r.json(
      await repo.scoped(q.actor.grant_id, async (c, p, g) => {
        check(
          revision(q.body.expectedResponseRevision) ===
            (p.response?.revision ?? 0),
          "Phản hồi đã đổi. Hãy tải lại.",
          409,
          "REVISION_CONFLICT",
        );
        const seen = new Set();
        for (const a of q.body.answers) {
          object(a, ["key", "status", "details", "alternativeProposal"]);
          check(
            g.projection_json.supports.some((s) => s.key === a.key) &&
              !seen.has(a.key),
            "Support không thuộc nội dung chia sẻ.",
          );
          seen.add(a.key);
          check(
            ["confirmed", "needs_confirmation", "not_available"].includes(
              a.status,
            ),
            "Invalid HR status.",
          );
          string(a.details, 2000);
          if (a.alternativeProposal != null)
            string(a.alternativeProposal, 2000, false);
        }
        const responseRevision = ++p.responseCounter;
        const row = (
          await c.query(
            "INSERT INTO hr_responses(id,grant_id,response_revision,answers_json,responder_label) VALUES($1,$2,$3,$4,$5) RETURNING created_at",
            [
              randomUUID(),
              g.id,
              responseRevision,
              JSON.stringify(q.body.answers),
              q.body.responderLabel,
            ],
          )
        ).rows[0];
        p.response = {
          revision: responseRevision,
          answers: q.body.answers,
          responderLabel: q.body.responderLabel,
          sourceType: "hr_response",
          createdAt: row.created_at,
        };
        p.approval = null;
        await c.query("DELETE FROM candidate_approvals WHERE plan_id=$1", [
          p.id,
        ]);
        await repo.write(c, p);
        await repo.event(c, p, "hr_response", "hr");
        return { responseRevision };
      }),
    );
  });
  return router;
}
