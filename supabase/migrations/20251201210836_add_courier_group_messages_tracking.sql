/*
  # Add tracking for courier group messages

  1. Changes to `orders` table
    - Add `courier_group_messages` (jsonb) - Array of objects tracking messages in different courier groups
      Structure: [{ group_chat_id: string, message_id: number, courier_id?: string }]
  
  2. Purpose
    - Track all messages sent to different courier groups
    - Enable deletion of messages from all groups when order is accepted
    - Store which courier accepted the order from which group
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'courier_group_messages'
  ) THEN
    ALTER TABLE orders ADD COLUMN courier_group_messages jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_courier_group_messages ON orders USING gin(courier_group_messages);
