/*
  # Add app_url to partner_settings for courier cabinet

  1. Changes
    - Add `app_url` column to `partner_settings` table
      - Type: text
      - Purpose: Store the application URL for generating courier cabinet links
      - Nullable (if null, system will auto-generate from Supabase URL)

  2. Notes
    - This URL is used by the external courier bot to generate cabinet links
    - The URL should be the base URL of the application (e.g., https://myapp.bolt.new)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'app_url'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN app_url text;
  END IF;
END $$;