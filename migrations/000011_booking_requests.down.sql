-- 000011_booking_requests.down.sql
DROP INDEX IF EXISTS idx_bookings_arena_status;
ALTER TABLE bookings DROP COLUMN IF EXISTS status_changed_at;
ALTER TABLE bookings DROP COLUMN IF EXISTS paid_amount;
ALTER TABLE bookings DROP COLUMN IF EXISTS rejection_reason;
