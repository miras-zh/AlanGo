-- 000007_arena_logo.up.sql
-- Business "avatar": a square logo for each arena, separate from the cover
-- (image_url). Uploaded by the owner via POST /api/arenas/{id}/logo.
ALTER TABLE arenas ADD COLUMN IF NOT EXISTS logo_url TEXT NOT NULL DEFAULT '';
