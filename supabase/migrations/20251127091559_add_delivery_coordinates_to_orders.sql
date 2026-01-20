/*
  # Add delivery coordinates to orders

  1. Changes
    - Add `delivery_lat` column to orders table (decimal, nullable)
    - Add `delivery_lng` column to orders table (decimal, nullable)
  
  2. Purpose
    - Store delivery location coordinates for route calculation
    - Enable recalculation of routes if needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_lat'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_lat DECIMAL(10, 8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_lng'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_lng DECIMAL(11, 8);
  END IF;
END $$;