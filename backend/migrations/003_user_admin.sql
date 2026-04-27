-- Promote users to admin via the UI. ADMIN_EMAILS env var still seeds on first
-- login; after that, admin status lives on this column.

SET search_path TO rca_coe;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users (is_admin) WHERE is_admin = true;
