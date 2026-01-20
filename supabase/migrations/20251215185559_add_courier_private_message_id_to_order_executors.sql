/*
  # Add courier private message tracking to order_executors

  1. Changes
    - Add `courier_private_message_id` column to `order_executors` table to track the private message sent to the courier when they accept an order
  
  2. Purpose
    - When a courier accepts an order from an executor, we send them a private message
    - We need to track this message ID so we can delete it when the executor is cancelled
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_executors' AND column_name = 'courier_private_message_id'
  ) THEN
    ALTER TABLE order_executors ADD COLUMN courier_private_message_id text;
  END IF;
END $$;