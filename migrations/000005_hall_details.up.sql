-- 000005_hall_details.up.sql
-- Structured hall attributes for the business "add hall" form and a photo
-- gallery (up to 5 images, first one is the cover = halls.image_url).
ALTER TABLE halls ADD COLUMN IF NOT EXISTS length_m   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE halls ADD COLUMN IF NOT EXISTS width_m    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE halls ADD COLUMN IF NOT EXISTS max_people INTEGER NOT NULL DEFAULT 0;
ALTER TABLE halls ADD COLUMN IF NOT EXISTS photos     TEXT[]  NOT NULL DEFAULT '{}';
