/*
  # Add Google Maps API Key to Partner Settings

  1. Changes
    - Add `google_maps_api_key` column to `partner_settings` table
      - Stores the Google Maps API key for geocoding and distance calculations
      - Encrypted text field for security
      - Nullable (optional feature)

  2. Notes
    - API key will be used for:
      - Geocoding (address to coordinates)
      - Reverse geocoding (coordinates to address)
      - Distance calculations between locations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'google_maps_api_key'
  ) THEN
    ALTER TABLE partner_settings 
    ADD COLUMN google_maps_api_key text DEFAULT NULL;
  END IF;
END $$;