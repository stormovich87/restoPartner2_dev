/*
  # Add bad weather surcharge to executors

  1. Changes
    - Add `bad_weather_surcharge_percent` decimal column to `executors` table
    - Default value is 0 (no surcharge)
    - Represents percentage increase for delivery zones during bad weather
    
  2. Security
    - No RLS changes needed (existing policies apply)
*/

-- Add bad_weather_surcharge_percent column to executors table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'executors' AND column_name = 'bad_weather_surcharge_percent'
  ) THEN
    ALTER TABLE executors ADD COLUMN bad_weather_surcharge_percent numeric(5,2) DEFAULT 0 NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN executors.bad_weather_surcharge_percent IS 'Percentage surcharge added to delivery zone prices during bad weather (e.g., 20 for 20% increase)';
