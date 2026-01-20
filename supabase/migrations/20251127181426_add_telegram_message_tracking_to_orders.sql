/*
  # Add Telegram Message Tracking to Orders

  1. Changes
    - Add `telegram_message_id` column to `orders` table to store the Telegram message ID
    - Add `courier_search_started_at` column to track when courier search was initiated
    
  2. Purpose
    - Enables tracking of Telegram messages sent to courier groups
    - Allows deletion of specific messages when courier search is cancelled
    - Tracks timing of courier search initiation
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'telegram_message_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN telegram_message_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'courier_search_started_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN courier_search_started_at timestamptz;
  END IF;
END $$;