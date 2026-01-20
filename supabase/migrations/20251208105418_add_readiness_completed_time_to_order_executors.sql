/*
  # Add readiness completed time tracking

  1. Changes
    - Add `readiness_completed_time_minutes` column to `order_executors` table
      - Type: integer
      - Purpose: Store the final time elapsed when order is completed
      - Used to display frozen timer after order completion
  
  2. Notes
    - When order status changes to 'completed', calculate elapsed time from readiness_started_at
    - Store this value for display purposes
    - Nullable to support existing records and executors without timers
*/

-- Add readiness_completed_time_minutes column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_executors' AND column_name = 'readiness_completed_time_minutes'
  ) THEN
    ALTER TABLE order_executors ADD COLUMN readiness_completed_time_minutes integer;
  END IF;
END $$;