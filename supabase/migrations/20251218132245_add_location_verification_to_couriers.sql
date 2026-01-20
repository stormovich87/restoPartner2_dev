/*
  # Add location verification setting for couriers

  1. Changes
    - Add `require_location_on_completion` column to `couriers` table
      - Boolean field (default: false)
      - Determines whether courier must provide location when completing orders
      - Location will be verified against completion_radius_meters setting
  
  2. Purpose
    - Allow per-courier configuration of location verification on order completion
    - When enabled, courier must be within specified radius to complete order
    - If outside radius, show distance and required proximity
*/

-- Add location verification field to couriers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'require_location_on_completion'
  ) THEN
    ALTER TABLE couriers ADD COLUMN require_location_on_completion boolean DEFAULT false;
  END IF;
END $$;