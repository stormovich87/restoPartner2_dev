/*
  # Add kilometer pricing fields to order_executors

  1. Changes
    - Add `distance_price_uah` (numeric) - price calculated based on distance
    - Add `rounded_distance_km` (numeric) - distance after applying graduation rounding
    - Add `total_delivery_price_uah` (numeric) - total delivery price (zone + distance)
  
  2. Purpose
    - Store the calculated distance-based price for each order executor
    - Allow showing price breakdown in Telegram messages
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_executors' AND column_name = 'distance_price_uah'
  ) THEN
    ALTER TABLE order_executors ADD COLUMN distance_price_uah numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_executors' AND column_name = 'rounded_distance_km'
  ) THEN
    ALTER TABLE order_executors ADD COLUMN rounded_distance_km numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_executors' AND column_name = 'total_delivery_price_uah'
  ) THEN
    ALTER TABLE order_executors ADD COLUMN total_delivery_price_uah numeric DEFAULT 0;
  END IF;
END $$;