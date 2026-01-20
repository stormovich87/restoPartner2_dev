/*
  # Add final button settings to external courier bot

  1. Changes
    - Add `external_courier_final_button_enabled` (boolean) - enable final button after registration
    - Add `external_courier_final_button_text` (text) - button text
    - Add `external_courier_final_button_url` (text) - group invite link
  
  2. Purpose
    - Allow executors to show a final button after successful courier registration
    - Button can redirect courier to a group chat
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'executors' AND column_name = 'external_courier_final_button_enabled'
  ) THEN
    ALTER TABLE executors ADD COLUMN external_courier_final_button_enabled boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'executors' AND column_name = 'external_courier_final_button_text'
  ) THEN
    ALTER TABLE executors ADD COLUMN external_courier_final_button_text text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'executors' AND column_name = 'external_courier_final_button_url'
  ) THEN
    ALTER TABLE executors ADD COLUMN external_courier_final_button_url text;
  END IF;
END $$;