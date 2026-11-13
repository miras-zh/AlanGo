-- 000010_arena_location.up.sql
-- Map location of a sports complex, set by its owner in the business
-- profile. Nullable: complexes without a location are hidden from the map.
ALTER TABLE arenas ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE arenas ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
