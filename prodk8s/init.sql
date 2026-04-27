-- ============================================================
-- RCA COE Tracker — one-time bootstrap for the in-cluster Postgres.
--
-- Run this ONCE against the in-cluster postgres pod after the PVC
-- binds and the StatefulSet is Ready.  The actual table DDL lives
-- in `backend/migrations/001_init.sql` and is run separately by
-- exec'ing into the app pod (see prodk8s/DEPLOY.md).
--
-- This file only:
--   1. ensures the `rca` role exists with the password from the secret
--   2. ensures the `rca_coe` database exists and is owned by `rca`
--   3. ensures the `rca_coe` schema exists in that database
--   4. sets a default search_path so app queries don't need to qualify
--   5. grants schema privileges to `rca`
--
-- Connect as the postgres superuser inside the StatefulSet pod
-- (`POSTGRES_USER` from the secret IS the superuser the image
-- creates on first boot — so the role already exists; the CREATE
-- ROLE block below is here only for clarity / re-runnability).
-- ============================================================

-- 1. Role (idempotent — the entrypoint will already have created it,
--    but if you ever rebuild the PVC from scratch this guards it).
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'rca') THEN
      CREATE ROLE rca LOGIN PASSWORD 'changeme-rotate-me';
   END IF;
END
$$;

-- 2. Database (cannot be wrapped in a DO block; run separately if it
--    already exists this is a no-op error you can ignore).
-- CREATE DATABASE rca_coe OWNER rca;
-- (left commented out — POSTGRES_DB=rca_coe in the secret means the
--  image creates it on first boot automatically.)

-- 3. Schema + search_path + grants. Run AFTER \c rca_coe.
\c rca_coe

CREATE SCHEMA IF NOT EXISTS rca_coe AUTHORIZATION rca;

ALTER DATABASE rca_coe SET search_path TO rca_coe, public;
ALTER ROLE rca IN DATABASE rca_coe SET search_path TO rca_coe, public;

GRANT USAGE, CREATE ON SCHEMA rca_coe TO rca;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA rca_coe TO rca;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA rca_coe TO rca;
ALTER DEFAULT PRIVILEGES IN SCHEMA rca_coe GRANT ALL ON TABLES TO rca;
ALTER DEFAULT PRIVILEGES IN SCHEMA rca_coe GRANT ALL ON SEQUENCES TO rca;
