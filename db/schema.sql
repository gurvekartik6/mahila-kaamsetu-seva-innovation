-- Mahila KaamSetu production schema (PostgreSQL 14+).
-- Run against the configured database with:
-- psql -U postgres -d mahila_db -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email CITEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('member','staff','admin')),
  preferred_language TEXT NOT NULL DEFAULT 'mr'
    CHECK (preferred_language IN ('mr','hi','en')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_expiry_idx
  ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS sessions_user_idx
  ON sessions(user_id);

CREATE TABLE IF NOT EXISTS support_requests (
  id BIGSERIAL PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL
    CHECK (request_type IN ('work','health','docs','saheli','other')),
  description TEXT NOT NULL
    CHECK (char_length(description) BETWEEN 3 AND 3000),
  village TEXT NOT NULL DEFAULT '',
  reply_preference TEXT NOT NULL DEFAULT 'web'
    CHECK (reply_preference IN ('web','saheli','phone')),
  language TEXT NOT NULL DEFAULT 'mr'
    CHECK (language IN ('mr','hi','en')),
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN (
      'created','review','in_progress','waiting_user','completed','rejected'
    )),
  staff_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade the earlier demo table in place, if it already exists.
ALTER TABLE support_requests
  ADD COLUMN IF NOT EXISTS public_id TEXT;

ALTER TABLE support_requests
  ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE support_requests
  ADD COLUMN IF NOT EXISTS staff_note TEXT NOT NULL DEFAULT '';

ALTER TABLE support_requests
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
DECLARE
  legacy_user_id BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM support_requests WHERE user_id IS NULL
  ) THEN
    INSERT INTO users(email, full_name, password_hash, role, active)
      VALUES (
        'legacy-import@kaamsetu.invalid',
        'Legacy imported requests',
        'disabled',
        'member',
        FALSE
      )
      ON CONFLICT(email) DO UPDATE SET active = FALSE
      RETURNING id INTO legacy_user_id;

    UPDATE support_requests
      SET user_id = legacy_user_id
      WHERE user_id IS NULL;
  END IF;

  UPDATE support_requests
    SET public_id = 'MK-LEGACY-' || id::text
    WHERE public_id IS NULL;

  UPDATE support_requests
    SET updated_at = created_at
    WHERE updated_at IS NULL;
END $$;

ALTER TABLE support_requests
  ALTER COLUMN public_id SET NOT NULL;

ALTER TABLE support_requests
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE support_requests
  DROP CONSTRAINT IF EXISTS support_requests_status_check;

ALTER TABLE support_requests
  ADD CONSTRAINT support_requests_status_check
  CHECK (
    status IN (
      'created','review','in_progress','waiting_user','completed','rejected'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS support_requests_public_id_idx
  ON support_requests(public_id);

CREATE INDEX IF NOT EXISTS support_requests_user_created_idx
  ON support_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS support_requests_status_created_idx
  ON support_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS opportunities (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 180),
  description TEXT NOT NULL
    CHECK (char_length(description) BETWEEN 3 AND 3000),
  kind TEXT NOT NULL CHECK (kind IN ('training','work','support')),
  organisation TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  eligibility TEXT NOT NULL DEFAULT '',
  compensation TEXT NOT NULL DEFAULT '',
  application_url TEXT,
  contact TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'mr'
    CHECK (language IN ('mr','hi','en')),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  valid_until DATE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS opportunities_published_idx
  ON opportunities(published, verified, valid_until);

CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL
    CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')),
  byte_size INTEGER NOT NULL
    CHECK (byte_size BETWEEN 1 AND 3145728),
  encrypted_content BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_user_idx
  ON documents(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_idx
  ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
  ON audit_logs(actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL
);

-- Staff questions and escalations to administrators.
CREATE TABLE IF NOT EXISTS staff_admin_messages (
  id BIGSERIAL PRIMARY KEY,
  staff_user_id BIGINT NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL
    CHECK (char_length(subject) BETWEEN 3 AND 160),
  message TEXT NOT NULL
    CHECK (char_length(message) BETWEEN 3 AND 3000),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','answered','closed')),
  admin_reply TEXT NOT NULL DEFAULT '',
  responded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS staff_admin_messages_status_created_idx
  ON staff_admin_messages(status, created_at DESC);

CREATE INDEX IF NOT EXISTS staff_admin_messages_staff_created_idx
  ON staff_admin_messages(staff_user_id, created_at DESC);