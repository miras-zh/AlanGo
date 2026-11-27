-- ============================================================================
-- 000013_crm_finance_reminders_push.down.sql
-- ============================================================================

DROP TABLE IF EXISTS broadcast_campaigns;
DROP TABLE IF EXISTS arena_reminders;
DROP TABLE IF EXISTS arena_expenses;
DROP TABLE IF EXISTS arena_clients;

DROP INDEX IF EXISTS idx_bookings_upcoming_reminder;
ALTER TABLE bookings DROP COLUMN IF EXISTS reminder_sent_at;
ALTER TABLE users DROP COLUMN IF EXISTS marketing_push_enabled;
