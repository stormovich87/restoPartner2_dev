/*
  # Add Poster API settings to partner_settings

  1. Changes
    - Add `poster_account` column - Poster account name without .joinposter.com
    - Add `poster_api_token` column - Poster API token in format account:apikey
  
  2. Notes
    - Both fields are nullable to allow partners without Poster integration
    - Encrypted storage should be used for API token in production
*/

-- Add Poster API settings columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'poster_account'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN poster_account text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'poster_api_token'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN poster_api_token text;
  END IF;
END $$;