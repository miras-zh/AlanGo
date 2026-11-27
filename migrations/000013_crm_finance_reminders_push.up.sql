-- ============================================================================
-- 000013_crm_finance_reminders_push.up.sql
--   1. users.marketing_push_enabled & bookings.reminder_sent_at
--   2. arena_clients: deduplicated relational CRM table linked to users & bookings
--   3. arena_expenses: business expense tracking for P&L finance analytics
--   4. arena_reminders: scheduled reminders & tasks for arena owners
--   5. broadcast_campaigns: platform-wide and per-arena push/in-app broadcasts
-- ============================================================================

-- 1. User broadcast preference & booking reminder guard
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS marketing_push_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_upcoming_reminder
    ON bookings (booking_date, start_time)
    WHERE status = 'confirmed' AND reminder_sent_at IS NULL;

-- 2. Linked client base per arena (no data duplication across users / bookings)
CREATE TABLE IF NOT EXISTS arena_clients (
    id               BIGSERIAL PRIMARY KEY,
    arena_id         BIGINT NOT NULL REFERENCES arenas(id) ON DELETE CASCADE,
    user_id          BIGINT REFERENCES users(id) ON DELETE SET NULL,
    phone_key        VARCHAR(64) NOT NULL,
    display_name     VARCHAR(120) NOT NULL DEFAULT '',
    display_phone    VARCHAR(50) NOT NULL DEFAULT '',
    segment_override VARCHAR(20) NOT NULL DEFAULT '',
    tags             TEXT NOT NULL DEFAULT '',
    notes            TEXT NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_arena_clients_arena_phone UNIQUE (arena_id, phone_key),
    CONSTRAINT chk_arena_clients_segment CHECK (segment_override IN ('', 'vip', 'regular', 'new', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_arena_clients_arena_user
    ON arena_clients (arena_id, user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_arena_clients_user
    ON arena_clients (user_id)
    WHERE user_id IS NOT NULL;

-- Backfill existing bookings into arena_clients without duplicating clients
INSERT INTO arena_clients (arena_id, user_id, phone_key, display_name, display_phone, created_at, updated_at)
SELECT DISTINCT ON (src.arena_id, src.phone_key)
    src.arena_id,
    COALESCE(src.booking_user_id, matched_user.id) AS user_id,
    src.phone_key,
    src.client_name,
    src.client_phone,
    src.created_at,
    NOW()
FROM (
    SELECT
        b.arena_id,
        b.user_id AS booking_user_id,
        b.client_name,
        b.client_phone,
        b.created_at,
        CASE
            WHEN LENGTH(RIGHT(regexp_replace(COALESCE(b.client_phone, ''), '[^0-9]', '', 'g'), 10)) = 10
                THEN RIGHT(regexp_replace(b.client_phone, '[^0-9]', '', 'g'), 10)
            WHEN b.user_id IS NOT NULL
                THEN 'u:' || b.user_id::text
            ELSE 'raw:' || COALESCE(NULLIF(LOWER(TRIM(b.client_name)), ''), b.id::text)
        END AS phone_key
    FROM bookings b
) src
LEFT JOIN LATERAL (
    SELECT u.id
    FROM users u
    WHERE LENGTH(RIGHT(regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g'), 10)) = 10
      AND RIGHT(regexp_replace(u.phone, '[^0-9]', '', 'g'), 10) = src.phone_key
    ORDER BY u.id ASC
    LIMIT 1
) matched_user ON TRUE
ORDER BY src.arena_id, src.phone_key, (src.booking_user_id IS NOT NULL) DESC, src.created_at DESC
ON CONFLICT (arena_id, phone_key) DO NOTHING;

-- 3. Business expenses (linked to arenas)
CREATE TABLE IF NOT EXISTS arena_expenses (
    id           BIGSERIAL PRIMARY KEY,
    arena_id     BIGINT NOT NULL REFERENCES arenas(id) ON DELETE CASCADE,
    created_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
    category     VARCHAR(32) NOT NULL DEFAULT 'other',
    title        VARCHAR(160) NOT NULL,
    amount       INTEGER NOT NULL CHECK (amount >= 0),
    expense_date VARCHAR(20) NOT NULL,
    notes        TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_arena_expenses_date_iso CHECK (expense_date ~ '^\d{4}-\d{2}-\d{2}$'),
    CONSTRAINT chk_arena_expenses_category CHECK (category IN ('rent', 'salary', 'utilities', 'equipment', 'marketing', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_arena_expenses_arena_date
    ON arena_expenses (arena_id, expense_date DESC);

-- 4. Business reminders / operational tasks
CREATE TABLE IF NOT EXISTS arena_reminders (
    id           BIGSERIAL PRIMARY KEY,
    arena_id     BIGINT NOT NULL REFERENCES arenas(id) ON DELETE CASCADE,
    booking_id   BIGINT REFERENCES bookings(id) ON DELETE CASCADE,
    client_id    BIGINT REFERENCES arena_clients(id) ON DELETE SET NULL,
    created_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
    title        VARCHAR(200) NOT NULL,
    notes        TEXT NOT NULL DEFAULT '',
    due_date     VARCHAR(20) NOT NULL,
    due_time     VARCHAR(10) NOT NULL DEFAULT '10:00',
    remind_push  BOOLEAN NOT NULL DEFAULT TRUE,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending',
    notified_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_arena_reminders_date_iso CHECK (due_date ~ '^\d{4}-\d{2}-\d{2}$'),
    CONSTRAINT chk_arena_reminders_time_format CHECK (due_time ~ '^\d{2}:\d{2}$'),
    CONSTRAINT chk_arena_reminders_status CHECK (status IN ('pending', 'done'))
);

CREATE INDEX IF NOT EXISTS idx_arena_reminders_arena_status
    ON arena_reminders (arena_id, status, due_date, due_time);

CREATE INDEX IF NOT EXISTS idx_arena_reminders_due_push
    ON arena_reminders (due_date, due_time)
    WHERE status = 'pending' AND remind_push = TRUE AND notified_at IS NULL;

-- 5. Broadcast push / in-app campaigns
CREATE TABLE IF NOT EXISTS broadcast_campaigns (
    id               BIGSERIAL PRIMARY KEY,
    sender_user_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
    scope            VARCHAR(20) NOT NULL DEFAULT 'platform',
    arena_id         BIGINT REFERENCES arenas(id) ON DELETE CASCADE,
    title            VARCHAR(160) NOT NULL,
    body             TEXT NOT NULL,
    target_filter    VARCHAR(160) NOT NULL DEFAULT 'all',
    recipients_count INTEGER NOT NULL DEFAULT 0,
    push_sent_count  INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_broadcast_campaigns_scope CHECK (scope IN ('platform', 'arena'))
);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_scope_arena
    ON broadcast_campaigns (scope, arena_id, created_at DESC);
