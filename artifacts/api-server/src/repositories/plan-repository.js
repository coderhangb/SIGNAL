import { randomUUID, randomBytes, createHash } from "node:crypto";
import { AppError, check } from "../domain/validation.js";
export const token = () => randomBytes(32).toString("base64url");
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const uuid = (value) =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
export class PlanRepository {
  constructor(pool) {
    this.pool = pool;
  }
  async tx(fn) {
    if (!this.pool)
      throw new AppError(
        503,
        "DB_UNAVAILABLE",
        "Cần cấu hình PostgreSQL trước khi lưu/chia sẻ.",
        true,
      );
    let client;
    try {
      client = await this.pool.connect();
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      if (e instanceof AppError) throw e;
      throw new AppError(
        503,
        "DB_UNAVAILABLE",
        "Chưa lưu được dữ liệu. Hãy thử lại.",
        true,
      );
    } finally {
      client?.release();
    }
  }
  async session(existing, hours) {
    return this.tx(async (c) => {
      if (existing) {
        const found = (
          await c.query(
            "SELECT id, csrf FROM candidate_sessions WHERE token_hash=$1 AND expires_at>now()",
            [hash(existing)],
          )
        ).rows[0];
        if (found) return { ...found, token: existing };
      }
      const result = { id: randomUUID(), token: token(), csrf: token() };
      await c.query(
        "INSERT INTO candidate_sessions(id,token_hash,csrf,expires_at) VALUES($1,$2,$3,now()+($4 * interval '1 hour'))",
        [result.id, hash(result.token), result.csrf, hours],
      );
      return result;
    });
  }
  async authenticate(raw, role) {
    check(
      raw,
      "Phiên đã hết hạn hoặc chưa có. Không thể khôi phục bằng plan ID.",
      401,
      "SESSION_EXPIRED",
    );
    return this.tx(async (c) => {
      const sql =
        role === "candidate"
          ? "SELECT id,csrf FROM candidate_sessions WHERE token_hash=$1 AND expires_at>now()"
          : "SELECT s.grant_id, s.csrf FROM hr_sessions s JOIN share_grants g ON g.id=s.grant_id WHERE s.token_hash=$1 AND s.expires_at>now() AND g.expires_at>now() AND g.revoked_at IS NULL";
      const row = (await c.query(sql, [hash(raw)])).rows[0];
      check(
        row,
        "Phiên đã hết hạn hoặc liên kết đã bị thu hồi.",
        401,
        "SESSION_EXPIRED",
      );
      return row;
    });
  }
  async event(c, plan, type, role = "candidate") {
    await c.query(
      "INSERT INTO plan_events(id,plan_id,event_type,actor_role,revision) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), plan.id, type, role, plan.revision],
    );
  }
  async version(c, plan) {
    const s = plan.snapshot;
    await c.query(
      "INSERT INTO plan_versions(plan_id,revision,profile_json,interview_json,observations_json,draft_json,snapshot_json) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        plan.id,
        plan.revision,
        JSON.stringify(s.profile),
        JSON.stringify(s.interview),
        JSON.stringify(s.observations),
        JSON.stringify(s.draft),
        JSON.stringify(s),
      ],
    );
  }
  async write(c, plan) {
    await c.query(
      "UPDATE plans SET revision=$2,state=$3,updated_at=now() WHERE id=$1",
      [plan.id, plan.revision, JSON.stringify(plan)],
    );
  }
  async create(owner, snapshot, idempotencyKey) {
    return this.tx(async (c) => {
      await c.query(
        "SELECT id FROM candidate_sessions WHERE id=$1 FOR UPDATE",
        [owner],
      );
      const payloadHash = hash(
        JSON.stringify(snapshot, (key, value) =>
          key === "timestamp" ? undefined : value,
        ),
      );
      const existing = (
        await c.query(
          "SELECT state,payload_hash FROM plans WHERE owner_session_id=$1 AND idempotency_key=$2",
          [owner, idempotencyKey],
        )
      ).rows[0];
      if (existing) {
        check(
          existing.payload_hash === payloadHash,
          "Idempotency key đã dùng với dữ liệu khác.",
          409,
          "REVISION_CONFLICT",
        );
        return existing.state;
      }
      const plan = {
        id: randomUUID(),
        revision: 1,
        snapshot,
        response: null,
        approval: null,
        responseCounter: 0,
      };
      await c.query(
        "INSERT INTO plans(id,owner_session_id,revision,state,idempotency_key,payload_hash) VALUES($1,$2,1,$3,$4,$5)",
        [plan.id, owner, JSON.stringify(plan), idempotencyKey, payloadHash],
      );
      await this.version(c, plan);
      await this.event(c, plan, "created");
      return plan;
    });
  }
  async owned(owner, id, fn) {
    check(uuid(id), "Không tìm thấy kế hoạch.", 404, "NOT_FOUND");
    return this.tx(async (c) => {
      const row = (
        await c.query(
          "SELECT state FROM plans WHERE id=$1 AND owner_session_id=$2 FOR UPDATE",
          [id, owner],
        )
      ).rows[0];
      check(row, "Không tìm thấy kế hoạch.", 404, "NOT_FOUND");
      return fn(c, row.state);
    });
  }
  async scoped(grantId, fn) {
    return this.tx(async (c) => {
      const initial = (
        await c.query("SELECT plan_id FROM share_grants WHERE id=$1", [grantId])
      ).rows[0];
      check(initial, "Liên kết không còn hiệu lực.", 410, "LINK_EXPIRED");
      const row = (
        await c.query("SELECT state FROM plans WHERE id=$1 FOR UPDATE", [
          initial.plan_id,
        ])
      ).rows[0];
      const grant = (
        await c.query(
          "SELECT * FROM share_grants WHERE id=$1 AND revoked_at IS NULL AND expires_at>now()",
          [grantId],
        )
      ).rows[0];
      check(row && grant, "Liên kết không còn hiệu lực.", 410, "LINK_EXPIRED");
      return fn(c, row.state, grant);
    });
  }
  async exchange(raw) {
    return this.tx(async (c) => {
      const grant = (
        await c.query(
          "SELECT id,expires_at FROM share_grants WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()",
          [hash(raw)],
        )
      ).rows[0];
      check(
        grant,
        "Liên kết sai, hết hạn hoặc đã thu hồi.",
        410,
        "LINK_EXPIRED",
      );
      const result = { token: token(), csrf: token() };
      await c.query(
        "INSERT INTO hr_sessions(token_hash,grant_id,csrf,expires_at) VALUES($1,$2,$3,$4)",
        [hash(result.token), grant.id, result.csrf, grant.expires_at],
      );
      return result;
    });
  }
}
