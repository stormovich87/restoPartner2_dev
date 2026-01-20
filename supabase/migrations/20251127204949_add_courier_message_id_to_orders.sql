/*
  # Add courier personal message tracking to orders

  1. Changes
    - Add `courier_message_id` column to `orders` table to store the ID of personal message sent to courier
    - This allows deleting the message when courier is changed or removed

  2. Notes
    - Different from `telegram_message_id` which is for group chat search messages
    - Will be null when no personal message was sent to courier
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'courier_message_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN courier_message_id text;
  END IF;
END $$;