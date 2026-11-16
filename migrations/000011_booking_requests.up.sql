-- 000011_booking_requests.up.sql
-- Client bookings become requests: created as 'pending', the arena owner
-- confirms, rejects (with a reason) or reschedules them. Payment received is
-- now stored on the server instead of the owner's phone.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_bookings_arena_status ON bookings (arena_id, status);
