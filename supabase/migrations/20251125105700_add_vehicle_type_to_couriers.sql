/*
  # Add vehicle_type field to couriers table

  ## Summary
  Adds the vehicle_type column to the couriers table to store courier transportation type.

  ## Changes
  - Add `vehicle_type` (text, nullable) column to couriers table
  - Allows storing courier's transportation method (walking, bicycle, car)

  ## Notes
  - This field is optional and can be null
  - Uses IF NOT EXISTS check for safe migration
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'vehicle_type'
  ) THEN
    ALTER TABLE couriers ADD COLUMN vehicle_type text;
  END IF;
END $$;
