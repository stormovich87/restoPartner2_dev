/*
  # Add External Couriers System

  1. Changes to Tables
    - `couriers` table:
      - Add `is_external` (boolean) - marks if courier is external/third-party
    
    - `partner_settings` table:
      - Add `external_courier_bot_token` (text) - bot token for external courier registration
      - Add `external_courier_bot_username` (text) - bot username for display
    
    - `executors` table:
      - Add `allow_external_couriers` (boolean) - enables external couriers for this executor

  2. Notes
    - External couriers are registered through a separate bot
    - They can accept orders but are not shown in manual courier assignment lists
    - Only executors with `allow_external_couriers` enabled can assign orders to external couriers
    - External couriers are automatically shown in orders when they accept
*/

-- Add is_external field to couriers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'is_external'
  ) THEN
    ALTER TABLE couriers ADD COLUMN is_external boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add external courier bot settings to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'external_courier_bot_token'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN external_courier_bot_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'external_courier_bot_username'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN external_courier_bot_username text;
  END IF;
END $$;

-- Add allow_external_couriers field to executors table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'executors' AND column_name = 'allow_external_couriers'
  ) THEN
    ALTER TABLE executors ADD COLUMN allow_external_couriers boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Create index for quick filtering of external couriers
CREATE INDEX IF NOT EXISTS idx_couriers_is_external ON couriers(partner_id, is_external) WHERE is_active = true;
