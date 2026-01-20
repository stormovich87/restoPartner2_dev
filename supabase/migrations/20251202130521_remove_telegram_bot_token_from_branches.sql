/*
  # Remove telegram_bot_token from branches table

  1. Changes
    - Drop `telegram_bot_token` column from branches table
    - All Telegram bot operations now use token from partner_settings.courier_bot_token
    - Branches only store telegram_chat_id for group destinations

  2. Notes
    - This migration is safe to run as all functions now use partner_settings.courier_bot_token
    - No data loss - chat_id fields remain intact
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'telegram_bot_token'
  ) THEN
    ALTER TABLE branches DROP COLUMN telegram_bot_token;
  END IF;
END $$;
