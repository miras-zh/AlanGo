-- 000004_business_onboarding.up.sql
-- Self-service business accounts:
--   venue_type — what the owner rents out: complex (building with several
--                halls), single (one hall/court), outdoor (open field/court).
--   hidden     — arena is excluded from the public catalog while its owner
--                has the business account disabled (data is kept).
ALTER TABLE arenas ADD COLUMN IF NOT EXISTS venue_type VARCHAR(32) NOT NULL DEFAULT 'complex';
ALTER TABLE arenas ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_arenas_hidden ON arenas (hidden);
