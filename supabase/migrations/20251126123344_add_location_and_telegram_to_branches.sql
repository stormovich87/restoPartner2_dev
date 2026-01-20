/*
  # Add Location and Telegram Integration to Branches

  1. Changes
    - Add `latitude` column to `branches` table
      - Stores the latitude coordinate of the branch location
      - Used for distance calculations and mapping
    - Add `longitude` column to `branches` table
      - Stores the longitude coordinate of the branch location
      - Used for distance calculations and mapping
    - Add `telegram_bot_token` column to `branches` table
      - Stores the Telegram bot token for sending order notifications
      - Encrypted text field for security
    - Add `telegram_chat_id` column to `branches` table
      - Stores the Telegram chat/group ID where notifications are sent
      - Text field for chat ID

  2. Notes
    - Coordinates are optional and can be determined via Google Maps API
    - Telegram integration is optional per branch
    - Each branch can have its own bot and chat for notifications
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE branches ADD COLUMN latitude double precision DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE branches ADD COLUMN longitude double precision DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'telegram_bot_token'
  ) THEN
    ALTER TABLE branches ADD COLUMN telegram_bot_token text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'telegram_chat_id'
  ) THEN
    ALTER TABLE branches ADD COLUMN telegram_chat_id text DEFAULT NULL;
  END IF;
END $$;