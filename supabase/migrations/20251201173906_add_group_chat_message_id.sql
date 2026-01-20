/*
  # Add group chat message ID tracking

  1. Changes to `orders` table
    - Add `group_chat_message_id` (bigint) - Telegram message ID in group chat
  
  2. Changes to `archived_orders` table  
    - Add same field for consistency
  
  3. Notes
    - Used for tracking and updating messages in courier group chat
    - Allows editing/deleting messages when order status changes
*/

-- Add field to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'group_chat_message_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN group_chat_message_id bigint;
  END IF;
END $$;

-- Add field to archived_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'group_chat_message_id'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN group_chat_message_id bigint;
  END IF;
END $$;