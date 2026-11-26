-- 000012_db_hardening.down.sql

CREATE INDEX IF NOT EXISTS idx_schedules_arena ON arena_schedules (arena_id);
CREATE INDEX IF NOT EXISTS idx_hall_schedules_hall ON hall_schedules (hall_id);
DROP INDEX IF EXISTS idx_arenas_city_district_lower;

DROP INDEX IF EXISTS uq_users_email_lower;
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

ALTER TABLE client_ratings DROP CONSTRAINT IF EXISTS fk_client_ratings_arena;

DROP INDEX IF EXISTS uq_subscription_requests_user_pending;
ALTER TABLE subscription_requests DROP CONSTRAINT IF EXISTS fk_subscription_requests_user;
ALTER TABLE subscription_requests
    ALTER COLUMN user_id TYPE INTEGER,
    ALTER COLUMN id TYPE INTEGER;
ALTER SEQUENCE IF EXISTS subscription_requests_id_seq AS INTEGER;

DROP INDEX IF EXISTS idx_bookings_user_status;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS chk_bookings_paid_nonneg;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS chk_bookings_duration_pos;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS chk_bookings_status;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS chk_bookings_time_format;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS chk_bookings_date_iso;
