/*
  # Add Telegram Bot Settings for Courier Registration

  1. Changes to `partner_settings` table
    - Add `courier_bot_token` (text) - Token for Telegram bot
    - Add `courier_bot_enabled` (boolean) - Enable/disable bot registration

  2. Changes to `couriers` table
    - Add `telegram_user_id` (text) - Telegram user ID for identification
    - Add `telegram_username` (text) - Telegram username
    - Add unique constraint on telegram_user_id per partner

  3. Purpose
    - Enable automated courier registration through Telegram bot
    - Store Telegram identifiers for courier verification
    - Allow partners to control bot registration feature
*/

-- Add courier bot settings to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'courier_bot_token'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN courier_bot_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'courier_bot_enabled'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN courier_bot_enabled boolean DEFAULT false;
  END IF;
END $$;

-- Add Telegram fields to couriers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'telegram_user_id'
  ) THEN
    ALTER TABLE couriers ADD COLUMN telegram_user_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'telegram_username'
  ) THEN
    ALTER TABLE couriers ADD COLUMN telegram_username text;
  END IF;
END $$;

-- Create unique index for telegram_user_id per partner (prevent duplicate registrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_couriers_telegram_user_partner'
  ) THEN
    CREATE UNIQUE INDEX idx_couriers_telegram_user_partner
    ON couriers(partner_id, telegram_user_id)
    WHERE telegram_user_id IS NOT NULL;
  END IF;
END $$;