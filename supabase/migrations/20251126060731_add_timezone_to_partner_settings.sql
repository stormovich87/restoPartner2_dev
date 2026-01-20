/*
  # Add Timezone to Partner Settings

  ## Summary
  Adds timezone configuration to partner_settings table to ensure
  time consistency between scheduled orders and displayed times.

  ## Changes
  1. New Column
    - `timezone` (text) - Stores timezone identifier (e.g., 'Europe/Kiev', 'UTC')
    - Default: 'UTC'
    - Not null

  ## Notes
  - Allows partners to set their local timezone
  - Ensures consistency between order scheduling calendar and time display
  - Uses standard IANA timezone identifiers
*/

-- Add timezone column to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE partner_settings 
    ADD COLUMN timezone text DEFAULT 'UTC' NOT NULL;
  END IF;
END $$;