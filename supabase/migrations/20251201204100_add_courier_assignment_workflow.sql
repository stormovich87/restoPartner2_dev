/*
  # Add Courier Assignment Workflow Fields

  1. Changes
    - Add `assignment_status` column to orders table
      - Values: 'searching', 'assigned', 'cancelled'
      - Default: 'searching'
    - Add `group_chat_id_accepted` to track which group the order was accepted from
    - Add index for assignment_status for faster queries

  2. Purpose
    - Track the workflow of courier assignment through Telegram
    - Enable "Accept Order" and "Cancel Order" functionality
    - Track which Telegram group accepted the order
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'assignment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN assignment_status text DEFAULT 'searching' CHECK (assignment_status IN ('searching', 'assigned', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'group_chat_id_accepted'
  ) THEN
    ALTER TABLE orders ADD COLUMN group_chat_id_accepted text;
  END IF;
END $$;

-- Create index for faster assignment status queries
CREATE INDEX IF NOT EXISTS idx_orders_assignment_status ON orders(assignment_status) WHERE assignment_status = 'searching';