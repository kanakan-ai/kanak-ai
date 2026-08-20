-- Kanak AI — Phase 1 primary database schema
-- Engine: PostgreSQL 16+
-- Source: kanak-ai-specs/design/data/schema.sql
-- This file is applied on first container startup via initdb

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE plan_tier AS ENUM ('free', 'pro', 'platinum');
CREATE TYPE user_role AS ENUM ('customer', 'admin');
CREATE TYPE document_status AS ENUM ('pending', 'parsing', 'ready', 'needs_review', 'failed');
CREATE TYPE document_type AS ENUM ('auto_policy', 'home_policy', 'life_insurance', 'warranty', 'tax', 'receipt', 'other', 'umbrella_policy', 'landlord_policy', 'renters_policy', 'long_term_care', 'unknown');
CREATE TYPE document_source AS ENUM ('upload', 'share_sheet', 'email');
CREATE TYPE identity_channel AS ENUM ('phone', 'email', 'apple', 'gmail', 'microsoft');
CREATE TYPE alert_type AS ENUM ('renewal', 'deadline', 'rate_change');
CREATE TYPE alert_status AS ENUM ('open', 'resolved');
CREATE TYPE quote_session_status AS ENUM ('ready', 'handoff', 'completed', 'failed');

-- ---------------------------------------------------------------------------
-- Users & auth (passwordless)
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan            plan_tier NOT NULL DEFAULT 'free',
  role            user_role NOT NULL DEFAULT 'customer',
  display_name    TEXT,
  dark_mode       BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_digest   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

COMMENT ON TABLE users IS 'Kanak AI account; no password column by design';
COMMENT ON COLUMN users.role IS 'admin = internal ops/dashboard access only; never grant to normal customers';

CREATE TABLE auth_identities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  channel         identity_channel NOT NULL,
  identifier      TEXT NOT NULL,
  verified_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel, identifier)
);

CREATE INDEX auth_identities_user_id_idx ON auth_identities (user_id);

CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE otp_challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel         identity_channel NOT NULL,
  identifier      TEXT NOT NULL,
  code_hash       TEXT NOT NULL,
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 5,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX otp_challenges_lookup_idx ON otp_challenges (channel, identifier, expires_at);

-- ---------------------------------------------------------------------------
-- Documents & extraction
-- ---------------------------------------------------------------------------

CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status          document_status NOT NULL DEFAULT 'pending',
  document_type   document_type NOT NULL DEFAULT 'unknown',
  source          document_source NOT NULL DEFAULT 'upload',
  title           TEXT,
  storage_key     TEXT NOT NULL,
  content_type    TEXT NOT NULL DEFAULT 'application/pdf',
  byte_size       BIGINT,
  checksum_sha256 TEXT,
  parse_error     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX documents_user_id_idx ON documents (user_id);
CREATE INDEX documents_user_status_idx ON documents (user_id, status);
CREATE INDEX documents_user_created_idx ON documents (user_id, created_at DESC);

COMMENT ON COLUMN documents.storage_key IS 'S3-compatible object key; PDF lives in object store';

CREATE TABLE extracted_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID NOT NULL UNIQUE REFERENCES documents (id) ON DELETE CASCADE,
  schema_version      TEXT NOT NULL DEFAULT 'unknown.v0',
  fields              JSONB NOT NULL DEFAULT '[]'::jsonb,
  overall_confidence  REAL CHECK (overall_confidence IS NULL OR (overall_confidence >= 0 AND overall_confidence <= 1)),
  party_name          TEXT,
  reference_id        TEXT,
  amount              NUMERIC(12, 2),
  amount_frequency    TEXT CHECK (amount_frequency IS NULL OR amount_frequency IN ('one_time', 'monthly', 'quarterly', 'semi_annual', 'annual', 'unknown')),
  key_date            DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX extracted_records_key_date_idx ON extracted_records (key_date) WHERE key_date IS NOT NULL;
CREATE INDEX extracted_records_fields_gin_idx ON extracted_records USING gin (fields);

COMMENT ON TABLE extracted_records IS 'Generic structured parse output for any document_type; type-specific keys in fields JSON';
COMMENT ON COLUMN extracted_records.fields IS 'OpenAPI FieldValue[] — schema_version selects expected keys';

-- Parse run lineage (explainability / debugging). Optional raw_response is PII-sensitive.
CREATE TABLE parse_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  content_sha256      TEXT,
  provider_id         TEXT NOT NULL,
  model               TEXT,
  prompt_version      TEXT,
  schema_version      TEXT,
  overall_confidence  REAL,
  status              TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'needs_review')),
  validation_results  JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_response        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX parse_runs_document_id_idx ON parse_runs (document_id);
CREATE INDEX parse_runs_created_at_idx ON parse_runs (created_at DESC);

COMMENT ON TABLE parse_runs IS 'Parse lineage per attempt; cascade on document/user erase';
COMMENT ON COLUMN parse_runs.raw_response IS 'Only if STORE_RAW_LLM_RESPONSE=true; may contain PII; never analytics';

-- M2-T5c: user corrections to extracted fields (audit + parse-quality learning)
CREATE TABLE field_corrections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  document_id         UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  extracted_record_id UUID REFERENCES extracted_records (id) ON DELETE SET NULL,
  document_type       document_type NOT NULL,
  schema_version      TEXT NOT NULL,
  field_key           TEXT NOT NULL,
  previous_value      JSONB,
  new_value           JSONB,
  previous_confidence REAL,
  source              TEXT NOT NULL DEFAULT 'user_review'
                        CHECK (source IN ('user_review', 'user_detail_edit', 'system_reparse')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX field_corrections_document_id_idx ON field_corrections (document_id);
CREATE INDEX field_corrections_type_key_idx ON field_corrections (document_type, field_key);
CREATE INDEX field_corrections_user_id_idx ON field_corrections (user_id);

COMMENT ON TABLE field_corrections IS 'Audit of user (or system) field fixes for parse learning; cascade with user; no PDF bytes';
COMMENT ON COLUMN field_corrections.previous_value IS 'JSON-encoded prior value; may be null';
COMMENT ON COLUMN field_corrections.new_value IS 'JSON-encoded value after correction';

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------

CREATE TABLE alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  document_id     UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  type            alert_type NOT NULL,
  status          alert_status NOT NULL DEFAULT 'open',
  title           TEXT NOT NULL,
  message         TEXT,
  days_remaining  INT,
  amount_prior    NUMERIC(12, 2),
  amount_current  NUMERIC(12, 2),
  change_percent  REAL,
  details         JSONB NOT NULL DEFAULT '{}'::jsonb,
  primary_action  TEXT NOT NULL DEFAULT 'none' CHECK (primary_action IN ('compare_rates', 'open_document', 'none')),
  fire_at         TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX alerts_user_status_idx ON alerts (user_id, status);
CREATE INDEX alerts_document_id_idx ON alerts (document_id);
CREATE INDEX alerts_fire_at_idx ON alerts (fire_at) WHERE status = 'open' AND fire_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Quote / comparison sessions
-- ---------------------------------------------------------------------------

CREATE TABLE quote_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  document_id         UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  status              quote_session_status NOT NULL DEFAULT 'ready',
  prefill             JSONB NOT NULL DEFAULT '{}'::jsonb,
  partner_handoff_url TEXT,
  result              JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX quote_sessions_user_id_idx ON quote_sessions (user_id);
CREATE INDEX quote_sessions_document_id_idx ON quote_sessions (document_id);

-- ---------------------------------------------------------------------------
-- Ask audit
-- ---------------------------------------------------------------------------

CREATE TABLE ask_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  answer_preview  TEXT,
  source_document_ids UUID[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ask_events_user_created_idx ON ask_events (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Analytics / product events
-- ---------------------------------------------------------------------------

CREATE TABLE analytics_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users (id) ON DELETE CASCADE,
  session_id      TEXT,
  event           TEXT NOT NULL,
  client          TEXT NOT NULL DEFAULT 'web' CHECK (client IN ('web', 'ios', 'android')),
  app_version     TEXT,
  env             TEXT NOT NULL DEFAULT 'local' CHECK (env IN ('local', 'staging', 'prod')),
  properties      JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX analytics_events_event_occurred_idx ON analytics_events (event, occurred_at DESC);
CREATE INDEX analytics_events_user_id_occurred_idx ON analytics_events (user_id, occurred_at DESC) WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Erasure & export jobs
-- ---------------------------------------------------------------------------

CREATE TABLE erasure_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  error           TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX erasure_jobs_user_id_idx ON erasure_jobs (user_id);

CREATE TABLE data_export_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'expired', 'failed')),
  download_url    TEXT,
  expires_at      TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX data_export_jobs_user_id_idx ON data_export_jobs (user_id);

-- ---------------------------------------------------------------------------
-- Audit events (admin only)
-- ---------------------------------------------------------------------------

CREATE TABLE audit_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action              TEXT NOT NULL,
  actor_user_id       UUID REFERENCES users (id) ON DELETE SET NULL,
  actor_subject_ref   TEXT,
  target_user_id      UUID REFERENCES users (id) ON DELETE SET NULL,
  details             JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address          TEXT,
  user_agent          TEXT,
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_action_occurred_idx ON audit_events (action, occurred_at DESC);
CREATE INDEX audit_events_target_user_idx ON audit_events (target_user_id, occurred_at DESC) WHERE target_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER documents_set_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER extracted_records_set_updated_at BEFORE UPDATE ON extracted_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER alerts_set_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER quote_sessions_set_updated_at BEFORE UPDATE ON quote_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER data_export_jobs_set_updated_at BEFORE UPDATE ON data_export_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
