/*
  # Add completion radius to partner settings

  1. Changes
    - Add `completion_radius_meters` column to `partner_settings` table
    - This defines the maximum distance (in meters) from delivery address where courier can complete the order
    - Default value is 100 meters

  2. Notes
    - Used to verify courier is at the delivery location before allowing order completion
    - Radius is measured from the delivery coordinates to courier's shared location
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'completion_radius_meters'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN completion_radius_meters integer DEFAULT 100;
  END IF;
END $$;
