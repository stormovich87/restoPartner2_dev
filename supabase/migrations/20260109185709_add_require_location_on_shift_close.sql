/*
  # Add require location on shift close setting

  1. Changes
    - Add `require_location_on_shift_close` boolean field to partner_settings table
    - Default value is false (disabled by default)
  
  2. Purpose
    - Allow partners to require employees to be within branch radius when closing shifts
    - Works similarly to the existing location verification for shift opening
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'require_location_on_shift_close'
  ) THEN
    ALTER TABLE partner_settings 
    ADD COLUMN require_location_on_shift_close boolean DEFAULT false;
  END IF;
END $$;