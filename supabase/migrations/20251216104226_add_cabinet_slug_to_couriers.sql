/*
  # Add Cabinet URL Slug to Couriers

  1. Changes
    - Add `cabinet_slug` column to couriers table
    - Create unique constraint on (partner_id, cabinet_slug)
    - Add index for faster lookups
  
  2. Details
    - The slug will be in format: "firstname-lastname" in Latin characters
    - Used for generating URLs like: https://restopresto.org/{partner_domain}/admin/{cabinet_slug}
    - Unique per partner to avoid conflicts
*/

-- Add cabinet_slug column to couriers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'cabinet_slug'
  ) THEN
    ALTER TABLE couriers ADD COLUMN cabinet_slug text;
  END IF;
END $$;

-- Create unique index on partner_id and cabinet_slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_couriers_partner_cabinet_slug 
  ON couriers(partner_id, cabinet_slug) 
  WHERE cabinet_slug IS NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_couriers_cabinet_slug 
  ON couriers(cabinet_slug) 
  WHERE cabinet_slug IS NOT NULL;