-- 000009_client_ratings.up.sql
-- A business rates a client (1-5) after a booking in its arena. One rating
-- per booking; the client's rating is the average (5.0 when unrated).
CREATE TABLE IF NOT EXISTS client_ratings (
    id          BIGSERIAL PRIMARY KEY,
    booking_id  BIGINT  NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    user_id     BIGINT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    arena_id    BIGINT  NOT NULL,
    rated_by    BIGINT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score       SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_ratings_user ON client_ratings (user_id);
