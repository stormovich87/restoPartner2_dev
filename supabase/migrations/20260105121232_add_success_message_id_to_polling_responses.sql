/*
  # Add Success Message ID to Polling Responses

  1. Changes
    - Add `success_message_id` (bigint) to `external_courier_polling_responses`
      - Stores Telegram message ID of the success message sent after courier agrees
      - Allows deletion of success message when new poll is sent

  2. Purpose
    - Clean up previous success messages ("Отлично! Вы добавлены...") from private chats
    - Keep private chats clean by removing old poll-related messages
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_courier_polling_responses' AND column_name = 'success_message_id'
  ) THEN
    ALTER TABLE external_courier_polling_responses ADD COLUMN success_message_id bigint;
  END IF;
END $$;