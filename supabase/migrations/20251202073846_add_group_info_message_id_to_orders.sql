/*
  # Add group info message ID tracking to orders

  1. Changes to `orders` table
    - Add `group_info_message_id` (text) - Telegram message ID for info message "order accepted by courier" in group chat
  
  2. Changes to `archived_orders` table
    - Add `group_info_message_id` (text) - same field for archived orders

  ## Purpose
  Track separate info message in group chat that shows which courier accepted the order.
  This allows proper cleanup when courier cancels or search is cancelled.
*/

-- Add group_info_message_id to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'group_info_message_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN group_info_message_id text;
  END IF;
END $$;

-- Add group_info_message_id to archived_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'group_info_message_id'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN group_info_message_id text;
  END IF;
END $$;