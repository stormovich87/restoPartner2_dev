/*
  # Add courier type (own vs external) to couriers table

  1. Changes
    - Add `is_own` boolean column to `couriers` table
    - Default value is `true` (own couriers)
    - Set existing couriers to be own couriers
    
  2. Security
    - No RLS changes needed (existing policies apply)
*/

-- Add is_own column to couriers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'is_own'
  ) THEN
    ALTER TABLE couriers ADD COLUMN is_own boolean DEFAULT true NOT NULL;
  END IF;
END $$;
