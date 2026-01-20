/*
  # Add Default Map Settings to Partner Settings

  1. Changes
    - Add `default_map_address` (text) - Default address for map center
    - Add `default_map_lat` (double precision) - Default latitude for map center
    - Add `default_map_lng` (double precision) - Default longitude for map center

  2. Notes
    - These fields allow partners to set a default map center point
    - Used as initial map center when creating/editing branches
    - Coordinates are nullable until first address is geocoded
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'default_map_address'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN default_map_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'default_map_lat'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN default_map_lat double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'default_map_lng'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN default_map_lng double precision;
  END IF;
END $$;
