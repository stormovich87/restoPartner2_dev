/*
  # Add History Cleanup Settings

  1. New Fields
    - `history_retention_days` - Period in days to keep archived orders history
      - null = keep forever (default)
      - positive number = delete orders older than N days
    - `history_auto_cleanup_enabled` - Enable automatic cleanup of old archived orders

  2. Changes
    - Add `history_retention_days` integer field to `partner_settings` table
    - Add `history_auto_cleanup_enabled` boolean field to `partner_settings` table
    - Default values: null retention (keep forever), auto cleanup disabled

  3. Security
    - Maintains existing RLS policies
*/

-- Add history cleanup settings to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'history_retention_days'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN history_retention_days integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'history_auto_cleanup_enabled'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN history_auto_cleanup_enabled boolean DEFAULT false;
  END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN partner_settings.history_retention_days IS 'Number of days to keep archived orders. NULL = keep forever, positive integer = delete after N days';
COMMENT ON COLUMN partner_settings.history_auto_cleanup_enabled IS 'Enable automatic cleanup of archived orders older than retention period';