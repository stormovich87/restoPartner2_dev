/*
  # Add en_route timestamp to orders

  1. Changes
    - Add `en_route_at` column to `orders` table to track when courier started delivery
    - Add `en_route_at` column to `archived_orders` table for consistency
  
  2. Notes
    - This timestamp is set when courier clicks "Выехал" button
    - Used to track delivery time and detect delays during delivery
*/

-- Add en_route_at to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'en_route_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN en_route_at timestamptz;
  END IF;
END $$;

-- Add en_route_at to archived_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'en_route_at'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN en_route_at timestamptz;
  END IF;
END $$;
