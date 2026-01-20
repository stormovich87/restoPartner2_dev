/*
  # Add courier assignment to order_executors

  1. Changes
    - Add `courier_id` (uuid, nullable, FK to couriers) - stores the courier who accepted the order
    - Add `courier_name` (text, nullable) - cached courier name for display

  2. Notes
    - When external courier accepts an order via Telegram button, courier_id and courier_name are set
    - Status changes from 'searching' to 'assigned'
*/

-- Add courier_id field to order_executors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_executors' AND column_name = 'courier_id'
  ) THEN
    ALTER TABLE order_executors ADD COLUMN courier_id uuid REFERENCES couriers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add courier_name field to order_executors (cached for display)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_executors' AND column_name = 'courier_name'
  ) THEN
    ALTER TABLE order_executors ADD COLUMN courier_name text;
  END IF;
END $$;

-- Create index for courier lookups
CREATE INDEX IF NOT EXISTS idx_order_executors_courier_id ON order_executors(courier_id);
