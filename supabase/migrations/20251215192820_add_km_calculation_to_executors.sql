/*
  # Add kilometer calculation settings to executors

  1. Changes
    - Add `km_calculation_enabled` (boolean) - enable distance-based pricing
    - Add `price_per_km` (numeric) - price per kilometer
    - Add `km_graduation_meters` (integer) - rounding graduation in meters (e.g., 200m)
  
  2. Purpose
    - Allow executors to charge for delivery based on distance
    - Distance is calculated from branch to delivery address using Routes API
    - Price formula: zone_price + (rounded_distance_km * price_per_km)
    - Minimum distance is 1 km
    - Distance is rounded to nearest graduation step
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'executors' AND column_name = 'km_calculation_enabled'
  ) THEN
    ALTER TABLE executors ADD COLUMN km_calculation_enabled boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'executors' AND column_name = 'price_per_km'
  ) THEN
    ALTER TABLE executors ADD COLUMN price_per_km numeric DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'executors' AND column_name = 'km_graduation_meters'
  ) THEN
    ALTER TABLE executors ADD COLUMN km_graduation_meters integer DEFAULT 100 NOT NULL;
  END IF;
END $$;