-- Adds AWS-style CoE metadata: severity, environment, services, and incident
-- timestamps. Title + body remain mandatory; everything below is optional so
-- you can still file a quick RCA without filling every box.

SET search_path TO rca_coe;

DO $$ BEGIN
    CREATE TYPE rca_severity AS ENUM ('sev1','sev2','sev3');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE rcas
    ADD COLUMN IF NOT EXISTS severity              rca_severity,
    ADD COLUMN IF NOT EXISTS environment           TEXT,
    ADD COLUMN IF NOT EXISTS services_affected     TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS incident_started_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS incident_detected_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS incident_mitigated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS incident_resolved_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_rcas_severity    ON rcas (severity);
CREATE INDEX IF NOT EXISTS idx_rcas_environment ON rcas (LOWER(environment));
