/*
  # Move location verification to partner settings

  1. Changes
    - Remove `require_location_on_completion` from `couriers` table
    - Add `require_courier_location_on_completion` to `partner_settings` table
      - Boolean field (default: false)
      - Global setting for all couriers of a partner
      - When enabled, all couriers must provide location when completing orders
  
  2. Purpose
    - Simplify location verification management
    - Single toggle for entire organization instead of per-courier
*/

-- Remove location verification field from couriers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'require_location_on_completion'
  ) THEN
    ALTER TABLE couriers DROP COLUMN require_location_on_completion;
  END IF;
END $$;

-- Add global location verification setting to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'require_courier_location_on_completion'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN require_courier_location_on_completion boolean DEFAULT false;
  END IF;
END $$;