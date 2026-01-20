/*
  # Add ETA fields to order_executors

  1. New Columns
    - `eta_pickup_minutes` (integer) - Estimated time to pickup in minutes
    - `eta_pickup_at` (timestamptz) - Estimated pickup time
  
  2. Purpose
    - Track individual executor ETA for orders
    - Display countdown timer in executor row in Orders page
*/

-- Add ETA fields to order_executors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_executors' AND column_name = 'eta_pickup_minutes'
  ) THEN
    ALTER TABLE order_executors ADD COLUMN eta_pickup_minutes integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_executors' AND column_name = 'eta_pickup_at'
  ) THEN
    ALTER TABLE order_executors ADD COLUMN eta_pickup_at timestamptz;
  END IF;
END $$;