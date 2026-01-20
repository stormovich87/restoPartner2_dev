/*
  # Add readiness timer tracking to order_executors

  1. Changes
    - Add `readiness_started_at` column to `order_executors` table
      - Type: timestamptz (timestamp with timezone)
      - Purpose: Track when the countdown timer started for executor readiness
      - Used together with `readiness_minutes` to calculate remaining time
  
  2. Usage
    - When executor is assigned: set `readiness_started_at = now()`
    - Client calculates: remaining_time = readiness_minutes*60 - (current_time - readiness_started_at)
    - When remaining_time <= 0: executor status becomes "expired"
  
  3. Notes
    - No default value - will be set explicitly when executor is assigned
    - Nullable to support existing records
*/

-- Add readiness_started_at column to track when countdown timer started
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_executors' AND column_name = 'readiness_started_at'
  ) THEN
    ALTER TABLE order_executors ADD COLUMN readiness_started_at timestamptz;
  END IF;
END $$;