-- Run AFTER db/schema.sql. Safe to run more than once.
CREATE TABLE IF NOT EXISTS staff_applications (
  id BIGSERIAL PRIMARY KEY,
  email CITEXT NOT NULL,
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  password_hash TEXT NOT NULL,
  preferred_language TEXT NOT NULL DEFAULT 'mr' CHECK (preferred_language IN ('mr','hi','en')),
  experience TEXT NOT NULL DEFAULT '' CHECK (char_length(experience) <= 1200),
  village_or_area TEXT NOT NULL DEFAULT '' CHECK (char_length(village_or_area) <= 160),
  reason TEXT NOT NULL DEFAULT '' CHECK (char_length(reason) <= 1200),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS staff_applications_status_created_idx ON staff_applications(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS staff_applications_pending_email_idx ON staff_applications(email) WHERE status IN ('pending', 'approved');
ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS assigned_staff_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS support_requests_assigned_staff_idx ON support_requests(assigned_staff_id, created_at DESC);