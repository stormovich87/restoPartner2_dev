/*
  # Add distance and duration fields to orders

  1. Changes
    - Add `distance_km` column to orders table (decimal, nullable)
    - Add `duration_minutes` column to orders table (integer, nullable)
  
  2. Purpose
    - Store calculated route distance from branch to delivery location
    - Store calculated route duration from branch to delivery location
    - These values are calculated using Google Routes API
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'distance_km'
  ) THEN
    ALTER TABLE orders ADD COLUMN distance_km DECIMAL(10, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'duration_minutes'
  ) THEN
    ALTER TABLE orders ADD COLUMN duration_minutes INTEGER;
  END IF;
END $$;