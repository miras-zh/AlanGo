-- ============================================================================
-- 000001_init_schema.up.sql
-- Consolidated initial schema for the App Skeleton:
--   1. users
--   2. notifications
--   3. items (universal CRUD domain entity)
--   4. audit_log
--   5. app_analytics_events & traffic_hourly_stats
--   6. subscription_plans
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id                   BIGSERIAL PRIMARY KEY,
    full_name            VARCHAR(255) NOT NULL DEFAULT '',
    email                VARCHAR(255) NOT NULL UNIQUE,
    phone                VARCHAR(50)  NOT NULL DEFAULT '',
    phone_verified       BOOLEAN      NOT NULL DEFAULT FALSE,
    city                 VARCHAR(100) NOT NULL DEFAULT '',
    photo                TEXT         NOT NULL DEFAULT '',
    push_token           VARCHAR(255) NOT NULL DEFAULT '',
    password             TEXT         NOT NULL DEFAULT '',
    google_sub           VARCHAR(255) UNIQUE,
    apple_sub            VARCHAR(255) UNIQUE,
    apple_refresh_token  TEXT,
    role                 VARCHAR(50)  NOT NULL DEFAULT 'client',
    business_role        VARCHAR(50)  NOT NULL DEFAULT '',
    type                 VARCHAR(50)  NOT NULL DEFAULT 'user',
    plan                 VARCHAR(50)  NOT NULL DEFAULT 'standard',
    plan_expires_at      TIMESTAMPTZ,
    active               BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_push_token  ON users (push_token) WHERE push_token <> '';

CREATE TABLE IF NOT EXISTS notifications (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id    BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    type        VARCHAR(50)  NOT NULL,
    title       VARCHAR(255) NOT NULL,
    body        TEXT         NOT NULL DEFAULT '',
    entity_id   BIGINT,
    read        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread  ON notifications (user_id) WHERE read = FALSE;

CREATE TABLE IF NOT EXISTS items (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    description TEXT         NOT NULL DEFAULT '',
    category    VARCHAR(100) NOT NULL DEFAULT 'general',
    status      VARCHAR(50)  NOT NULL DEFAULT 'active',
    image_url   TEXT         NOT NULL DEFAULT '',
    metadata    JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_user_id    ON items (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_cat_status ON items (category, status, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action      VARCHAR(50)  NOT NULL,
    detail      TEXT         NOT NULL DEFAULT '',
    ip          VARCHAR(64)  NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created ON audit_log (user_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS app_analytics_events (
    id          BIGSERIAL PRIMARY KEY,
    event_type  VARCHAR(64)  NOT NULL,
    target_type VARCHAR(32)  NOT NULL DEFAULT '',
    target_id   BIGINT       NOT NULL DEFAULT 0,
    platform    VARCHAR(32)  NOT NULL DEFAULT '',
    source      VARCHAR(64)  NOT NULL DEFAULT '',
    device_id   VARCHAR(128) NOT NULL DEFAULT '',
    ip          VARCHAR(64)  NOT NULL DEFAULT '',
    user_agent  TEXT         NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON app_analytics_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_device     ON app_analytics_events (event_type, device_id) WHERE device_id <> '';

CREATE TABLE IF NOT EXISTS traffic_hourly_stats (
    bucket_time   TIMESTAMPTZ PRIMARY KEY,
    peak_online   INTEGER     NOT NULL DEFAULT 0,
    unique_users  INTEGER     NOT NULL DEFAULT 0,
    unique_guests INTEGER     NOT NULL DEFAULT 0,
    total_unique  INTEGER     NOT NULL DEFAULT 0,
    web_count     INTEGER     NOT NULL DEFAULT 0,
    ios_count     INTEGER     NOT NULL DEFAULT 0,
    android_count INTEGER     NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_plans (
    id               BIGSERIAL PRIMARY KEY,
    code             VARCHAR(50)  NOT NULL UNIQUE,
    name             VARCHAR(100) NOT NULL,
    price_kzt        INTEGER      NOT NULL DEFAULT 0,
    price_on_request BOOLEAN      NOT NULL DEFAULT FALSE,
    features         TEXT[]       NOT NULL DEFAULT '{}',
    sort_order       INTEGER      NOT NULL DEFAULT 0,
    active           BOOLEAN      NOT NULL DEFAULT TRUE,
    is_default       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO subscription_plans (code, name, price_kzt, features, sort_order, active, is_default)
VALUES
    ('standard', 'Standard', 0,    ARRAY['Базовый функционал', 'До 10 записей'], 1, TRUE, TRUE),
    ('pro',      'Pro',      2990, ARRAY['Расширенный доступ', 'Безлимитные записи', 'Приоритетная поддержка'], 2, TRUE, FALSE),
    ('vip',      'VIP',      7990, ARRAY['Полный доступ ко всем функциям', 'Персональные уведомления', 'VIP статус'], 3, TRUE, FALSE)
ON CONFLICT (code) DO NOTHING;
