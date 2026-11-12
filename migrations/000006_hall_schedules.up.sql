-- 000006_hall_schedules.up.sql
-- Each hall has its own weekly schedule (and therefore its own booking
-- slots). arena_schedules stays as the template for halls without one.
CREATE TABLE IF NOT EXISTS hall_schedules (
    id             BIGSERIAL PRIMARY KEY,
    hall_id        BIGINT      NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
    day_of_week    INTEGER     NOT NULL, -- 0 = Воскресенье ... 6 = Суббота
    day_name       VARCHAR(50) NOT NULL DEFAULT '',
    is_closed      BOOLEAN     NOT NULL DEFAULT FALSE,
    start_time     VARCHAR(10) NOT NULL DEFAULT '08:00',
    end_time       VARCHAR(10) NOT NULL DEFAULT '23:00',
    slot_durations INTEGER[]   NOT NULL DEFAULT '{60, 90}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hall_day UNIQUE (hall_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_hall_schedules_hall ON hall_schedules (hall_id);

-- Existing halls inherit their arena's schedule.
INSERT INTO hall_schedules (hall_id, day_of_week, day_name, is_closed, start_time, end_time, slot_durations)
SELECT h.id, s.day_of_week, s.day_name, s.is_closed, s.start_time, s.end_time, s.slot_durations
FROM halls h
JOIN arena_schedules s ON s.arena_id = h.arena_id
ON CONFLICT (hall_id, day_of_week) DO NOTHING;

-- Overlap checks look bookings up by hall and date.
CREATE INDEX IF NOT EXISTS idx_bookings_hall_date ON bookings (hall_id, booking_date);
