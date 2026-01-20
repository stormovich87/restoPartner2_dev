/*
  # Add Poster Integration Fields to Orders

  1. Changes
    - Add `sent_to_poster` (boolean) - Flag if order was sent to Poster
    - Add `poster_order_id` (text) - Order ID from Poster API
    - Add `poster_status` (text) - Status from Poster (created, processing, etc)
    - Add `poster_error` (text) - Error message if sending failed

  2. Notes
    - These fields track integration status with Poster POS
    - Allows retry logic and error tracking
*/

-- Add Poster integration fields to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'sent_to_poster'
  ) THEN
    ALTER TABLE orders ADD COLUMN sent_to_poster boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'poster_order_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN poster_order_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'poster_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN poster_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'poster_error'
  ) THEN
    ALTER TABLE orders ADD COLUMN poster_error text;
  END IF;
END $$;

-- Create index for poster_order_id
CREATE INDEX IF NOT EXISTS idx_orders_poster_order_id ON orders(poster_order_id);

-- Add same fields to archived_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'sent_to_poster'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN sent_to_poster boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'poster_order_id'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN poster_order_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'poster_status'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN poster_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'poster_error'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN poster_error text;
  END IF;
END $$;
