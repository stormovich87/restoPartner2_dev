/*
  # Add Binotel Integration Settings to Partner Settings

  ## Overview
  This migration adds fields to the partner_settings table to support Binotel telephony integration.
  Binotel allows partners to receive incoming call notifications and automatically create orders.

  ## Changes
    - Adds `binotel_api_key` (text, nullable) - API key for Binotel integration
    - Adds `binotel_secret_key` (text, nullable) - Secret key for Binotel webhook authentication
    - Adds `binotel_enabled` (boolean) - Enable/disable Binotel integration

  ## Security Notes
    - API keys and secrets are stored in the database and should only be accessible to authenticated users
    - Consider using environment variables for sensitive data in production
    
  ## Important Notes
    1. Binotel integration allows partners to:
       - Receive real-time incoming call notifications
       - Automatically pre-fill customer phone numbers when creating orders
       - Match incoming calls to branch phone numbers
    2. When enabled, the system listens for Binotel webhook events
    3. The secret key is used to verify webhook authenticity
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'binotel_api_key'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN binotel_api_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'binotel_secret_key'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN binotel_secret_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'binotel_enabled'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN binotel_enabled boolean DEFAULT false;
  END IF;
END $$;