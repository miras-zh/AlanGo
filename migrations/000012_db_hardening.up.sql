-- ============================================================================
-- 000012_db_hardening.up.sql
-- Schema hardening based on PostgreSQL audit:
--   1. Normalize legacy booking dates ('Сегодня'/'Завтра') and add CHECK constraints.
--   2. Align subscription_requests types (BIGINT), clean orphans/duplicates,
--      add FK to users(id) ON DELETE CASCADE and partial UNIQUE on pending requests.
--   3. Add missing FK from client_ratings(arena_id) to arenas(id) ON DELETE CASCADE.
--   4. Enforce case-insensitive uniqueness on users(LOWER(email)).
--   5. Optimize indexes and drop duplicates / redundant single-column indexes.
-- ============================================================================

-- 1. Bookings legacy seed date normalization & integrity constraints
UPDATE bookings
SET booking_date = CASE
    WHEN booking_date = 'Сегодня' THEN TO_CHAR((NOW() AT TIME ZONE 'Asia/Almaty')::date, 'YYYY-MM-DD')
    WHEN booking_date = 'Завтра'  THEN TO_CHAR(((NOW() AT TIME ZONE 'Asia/Almaty')::date + INTERVAL '1 day')::date, 'YYYY-MM-DD')
    ELSE TO_CHAR((created_at AT TIME ZONE 'Asia/Almaty')::date, 'YYYY-MM-DD')
END
WHERE booking_date !~ '^\d{4}-\d{2}-\d{2}$';

UPDATE bookings
SET start_time = '0' || start_time
WHERE start_time ~ '^\d:\d{2}$';

UPDATE bookings
SET end_time = '0' || end_time
WHERE end_time ~ '^\d:\d{2}$';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_bookings_date_iso') THEN
        ALTER TABLE bookings
            ADD CONSTRAINT chk_bookings_date_iso CHECK (booking_date ~ '^\d{4}-\d{2}-\d{2}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_bookings_time_format') THEN
        ALTER TABLE bookings
            ADD CONSTRAINT chk_bookings_time_format CHECK (start_time ~ '^\d{2}:\d{2}$' AND end_time ~ '^\d{2}:\d{2}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_bookings_status') THEN
        ALTER TABLE bookings
            ADD CONSTRAINT chk_bookings_status CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'completed'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_bookings_duration_pos') THEN
        ALTER TABLE bookings
            ADD CONSTRAINT chk_bookings_duration_pos CHECK (duration_minutes > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_bookings_paid_nonneg') THEN
        ALTER TABLE bookings
            ADD CONSTRAINT chk_bookings_paid_nonneg CHECK (paid_amount >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_user_status
    ON bookings (user_id, status, created_at DESC);

-- 2. subscription_requests type alignment, FK, duplicate cleanup, pending uniqueness
ALTER SEQUENCE IF EXISTS subscription_requests_id_seq AS BIGINT;
ALTER TABLE subscription_requests
    ALTER COLUMN id TYPE BIGINT,
    ALTER COLUMN user_id TYPE BIGINT;

DELETE FROM subscription_requests
WHERE user_id NOT IN (SELECT id FROM users);

DELETE FROM subscription_requests a
USING subscription_requests b
WHERE a.status = 'pending'
  AND b.status = 'pending'
  AND a.user_id = b.user_id
  AND a.id < b.id;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscription_requests_user') THEN
        ALTER TABLE subscription_requests
            ADD CONSTRAINT fk_subscription_requests_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

DROP INDEX IF EXISTS idx_subscription_requests_user_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_requests_user_pending
    ON subscription_requests (user_id) WHERE status = 'pending';

-- 3. client_ratings FK to arenas(id)
DELETE FROM client_ratings
WHERE arena_id NOT IN (SELECT id FROM arenas);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_client_ratings_arena') THEN
        ALTER TABLE client_ratings
            ADD CONSTRAINT fk_client_ratings_arena
            FOREIGN KEY (arena_id) REFERENCES arenas(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Case-insensitive email uniqueness on users
DROP INDEX IF EXISTS idx_users_email_lower;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower
    ON users (LOWER(email));

-- 5. Arena functional index for case-insensitive city/district filtering & drop redundant indexes
CREATE INDEX IF NOT EXISTS idx_arenas_city_district_lower
    ON arenas (LOWER(city), LOWER(district)) WHERE hidden = false;

DROP INDEX IF EXISTS idx_hall_schedules_hall;
DROP INDEX IF EXISTS idx_schedules_arena;
