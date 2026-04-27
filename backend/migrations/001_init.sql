-- RCA COE Tracker initial schema.
-- Run after `prodk8s/init.sql` has created the schema + role.

SET search_path TO rca_coe;

CREATE TABLE IF NOT EXISTS users (
    email          TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    slack_id       TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_name_lower ON users (LOWER(name));

DO $$ BEGIN
    CREATE TYPE rca_status AS ENUM ('open','in_progress','rca_done','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS rcas (
    id                  BIGSERIAL PRIMARY KEY,
    title               TEXT NOT NULL,
    body                TEXT NOT NULL DEFAULT '',
    status              rca_status NOT NULL DEFAULT 'open',
    creator_email       TEXT NOT NULL REFERENCES users(email),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at           TIMESTAMPTZ,
    ai_summary          TEXT,
    ai_summary_at       TIMESTAMPTZ,
    ai_summary_model    TEXT
);
CREATE INDEX IF NOT EXISTS idx_rcas_status     ON rcas (status);
CREATE INDEX IF NOT EXISTS idx_rcas_creator    ON rcas (creator_email);
CREATE INDEX IF NOT EXISTS idx_rcas_created_at ON rcas (created_at DESC);

CREATE TABLE IF NOT EXISTS rca_assignees (
    rca_id      BIGINT NOT NULL REFERENCES rcas(id) ON DELETE CASCADE,
    user_email  TEXT   NOT NULL REFERENCES users(email),
    PRIMARY KEY (rca_id, user_email)
);
CREATE INDEX IF NOT EXISTS idx_rca_assignees_email ON rca_assignees (user_email);

CREATE TABLE IF NOT EXISTS rca_history (
    id           BIGSERIAL PRIMARY KEY,
    rca_id       BIGINT NOT NULL REFERENCES rcas(id) ON DELETE CASCADE,
    actor_email  TEXT NOT NULL,
    action       TEXT NOT NULL,
    from_value   TEXT,
    to_value     TEXT,
    at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rca_history_rca ON rca_history (rca_id, at DESC);
