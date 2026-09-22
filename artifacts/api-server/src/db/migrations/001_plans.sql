CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY);
CREATE TABLE IF NOT EXISTS candidate_sessions (
 id uuid PRIMARY KEY, token_hash text NOT NULL UNIQUE, csrf text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS plans (
 id uuid PRIMARY KEY, owner_session_id uuid NOT NULL REFERENCES candidate_sessions(id) ON DELETE CASCADE,
 revision integer NOT NULL, state jsonb NOT NULL, idempotency_key text NOT NULL, payload_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_session_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS plan_versions (
 plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE, revision integer NOT NULL,
 profile_json jsonb NOT NULL, interview_json jsonb NOT NULL, observations_json jsonb NOT NULL, draft_json jsonb,
 snapshot_json jsonb NOT NULL, PRIMARY KEY(plan_id, revision)
);
CREATE TABLE IF NOT EXISTS share_grants (
 id uuid PRIMARY KEY, plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
 snapshot_revision integer NOT NULL, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
 revoked_at timestamptz, allowed_fields_json jsonb NOT NULL, projection_json jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS hr_sessions (
 token_hash text PRIMARY KEY, grant_id uuid NOT NULL REFERENCES share_grants(id) ON DELETE CASCADE,
 csrf text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS hr_responses (
 id uuid PRIMARY KEY, grant_id uuid NOT NULL REFERENCES share_grants(id) ON DELETE CASCADE,
 response_revision integer NOT NULL, answers_json jsonb NOT NULL, responder_label text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(grant_id, response_revision)
);
CREATE TABLE IF NOT EXISTS candidate_approvals (
 plan_id uuid PRIMARY KEY REFERENCES plans(id) ON DELETE CASCADE,
 plan_revision integer NOT NULL, response_revision integer NOT NULL,
 accepted_alternatives_json jsonb NOT NULL, approved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS plan_events (
 id uuid PRIMARY KEY, plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
 event_type text NOT NULL, actor_role text NOT NULL, revision integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations(version) VALUES (1) ON CONFLICT DO NOTHING;
