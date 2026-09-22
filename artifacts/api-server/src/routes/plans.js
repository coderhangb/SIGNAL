import { Router } from "express";
import { randomUUID } from "node:crypto";
import { check, object, string, revision } from "../domain/validation.js";
import { computeReadiness, exportPlan } from "../domain/readiness-policy.js";
import {
  makeSnapshot,
  sharedProjection,
  validateDecisions,
} from "../services/plan-service.js";
import { token, hash, uuid } from "../repositories/plan-repository.js";
import { inputHash } from "../services/invitation-service.js";
const expect = (plan, value) =>
  check(
    plan.revision === revision(value),
    "Dữ liệu đã thay đổi. Hãy tải lại.",
    409,
    "REVISION_CONFLICT",
  );
export const publicPlan = (p) => ({ ...p, readiness: computeReadiness(p) });
export function candidateRoutes({ repo, config, analyses }) {
  const router = Router();
  router.use(async (q, _r, next) => {
    q.actor = await repo.authenticate(q.cookies.candidate, "candidate");
    if (q.method !== "GET")
      check(
        q.headers["x-csrf-token"] === q.actor.csrf,
        "CSRF không hợp lệ.",
        403,
        "FORBIDDEN",
      );
    next();
  });
  router.post("/", async (q, r) => {
    object(q.body, ["snapshot", "idempotencyKey"]);
    string(q.body.idempotencyKey, 100);
    // Stable idempotency compares original payload before server timestamps.
    const snapshot = makeSnapshot(q.body.snapshot, analyses);
    const p = await repo.create(q.actor.id, snapshot, q.body.idempotencyKey);
    r.status(201).json(publicPlan(p));
  });
  router.get("/:id", async (q, r) =>
    r.json(
      await repo.owned(q.actor.id, q.params.id, async (c, p) => {
        if (p.snapshot.analysisId)
          analyses.set(p.snapshot.analysisId, {
            inputHash: inputHash(p.snapshot.invitation),
            observations: p.snapshot.observations,
            extractionMode: p.snapshot.mode,
          });
        const grants = (
          await c.query(
            "SELECT id,snapshot_revision,expires_at,revoked_at FROM share_grants WHERE plan_id=$1",
            [p.id],
          )
        ).rows;
        return { ...publicPlan(p), grants };
      }),
    ),
  );
  router.patch("/:id", async (q, r) => {
    object(q.body, ["expectedRevision", "changes", "confirmNeedsChange"]);
    r.json(
      await repo.owned(q.actor.id, q.params.id, async (c, p) => {
        expect(p, q.body.expectedRevision);
        const next = makeSnapshot(q.body.changes, analyses);
        const removed = p.snapshot.profile.supports.some(
          (s) =>
            s.importance === "essential" &&
            !next.profile.supports.some(
              (n) => n.key === s.key && n.importance === "essential",
            ),
        );
        check(
          !removed || q.body.confirmNeedsChange === true,
          "Cần xác nhận thay đổi nhu cầu cần thiết.",
        );
        p.revision++;
        p.snapshot = next;
        p.approval = null;
        p.response = null;
        await c.query(
          "UPDATE share_grants SET revoked_at=now() WHERE plan_id=$1 AND revoked_at IS NULL",
          [p.id],
        );
        await c.query("DELETE FROM candidate_approvals WHERE plan_id=$1", [
          p.id,
        ]);
        await repo.version(c, p);
        await repo.write(c, p);
        await repo.event(c, p, removed ? "needs_changed" : "updated");
        return publicPlan(p);
      }),
    );
  });
  router.post("/:id/share", async (q, r) => {
    object(q.body, ["expectedRevision", "sharedFields", "consentAccepted"]);
    check(
      q.body.consentAccepted === true,
      "Cần duyệt nội dung và đồng ý chia sẻ.",
    );
    r.status(201).json(
      await repo.owned(q.actor.id, q.params.id, async (c, p) => {
        expect(p, q.body.expectedRevision);
        const projection = sharedProjection(p.snapshot, q.body.sharedFields);
        // A share replaces previous grants; no parallel responders silently override each other.
        await c.query(
          "UPDATE share_grants SET revoked_at=now() WHERE plan_id=$1 AND revoked_at IS NULL",
          [p.id],
        );
        const raw = token(),
          id = randomUUID();
        const grant = (
          await c.query(
            "INSERT INTO share_grants(id,plan_id,snapshot_revision,token_hash,expires_at,allowed_fields_json,projection_json) VALUES($1,$2,$3,$4,now()+($5 * interval '1 hour'),$6,$7) RETURNING expires_at",
            [
              id,
              p.id,
              p.revision,
              hash(raw),
              config.grantHours,
              JSON.stringify(q.body.sharedFields),
              JSON.stringify(projection),
            ],
          )
        ).rows[0];
        p.response = null;
        p.approval = null;
        await c.query("DELETE FROM candidate_approvals WHERE plan_id=$1", [
          p.id,
        ]);
        await repo.write(c, p);
        await repo.event(c, p, "shared");
        return {
          grantId: id,
          shareUrl: `${config.origin}/hr#token=${raw}`,
          expiresAt: grant.expires_at,
          projection,
        };
      }),
    );
  });
  router.post("/:id/revoke-share", async (q, r) => {
    object(q.body, ["grantId", "expectedRevision"]);
    check(uuid(q.body.grantId), "Invalid grant.");
    r.json(
      await repo.owned(q.actor.id, q.params.id, async (c, p) => {
        expect(p, q.body.expectedRevision);
        await c.query(
          "UPDATE share_grants SET revoked_at=now() WHERE id=$1 AND plan_id=$2",
          [q.body.grantId, p.id],
        );
        await repo.event(c, p, "share_revoked");
        return { revoked: true };
      }),
    );
  });
  router.post("/:id/approve", async (q, r) => {
    object(q.body, [
      "expectedRevision",
      "responseRevision",
      "decisions",
      "reviewed",
    ]);
    check(q.body.reviewed === true, "Cần kiểm tra chi tiết trước khi duyệt.");
    r.json(
      await repo.owned(q.actor.id, q.params.id, async (c, p) => {
        expect(p, q.body.expectedRevision);
        check(
          revision(q.body.responseRevision) === (p.response?.revision ?? 0),
          "Phản hồi đã đổi. Hãy tải lại.",
          409,
          "REVISION_CONFLICT",
        );
        const decisions = validateDecisions(q.body.decisions, p);
        p.approval = {
          planRevision: p.revision,
          responseRevision: p.response?.revision ?? 0,
          decisions,
          reviewed: true,
          approvedAt: new Date().toISOString(),
        };
        await c.query(
          "INSERT INTO candidate_approvals(plan_id,plan_revision,response_revision,accepted_alternatives_json) VALUES($1,$2,$3,$4) ON CONFLICT(plan_id) DO UPDATE SET plan_revision=$2,response_revision=$3,accepted_alternatives_json=$4,approved_at=now()",
          [
            p.id,
            p.revision,
            p.approval.responseRevision,
            JSON.stringify(decisions),
          ],
        );
        await repo.write(c, p);
        await repo.event(c, p, "candidate_review");
        return publicPlan(p);
      }),
    );
  });
  router.get("/:id/export", async (q, r) =>
    r
      .type("text/plain")
      .send(
        await repo.owned(q.actor.id, q.params.id, async (_c, p) =>
          exportPlan(p),
        ),
      ),
  );
  router.delete("/:id", async (q, r) => {
    object(q.body, ["expectedRevision"]);
    await repo.owned(q.actor.id, q.params.id, async (c, p) => {
      expect(p, q.body.expectedRevision);
      await c.query("DELETE FROM plans WHERE id=$1", [p.id]);
    });
    r.status(204).end();
  });
  return router;
}
