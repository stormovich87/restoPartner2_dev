/*
  # Add readiness time to order_executors

  1. Changes
    - Add `readiness_minutes` column to `order_executors` table (default 30 minutes)
    - This field stores how many minutes until the order is ready
    - Used for countdown timer display in executor button
  
  2. Notes
    - Default value is 30 minutes
    - Can be customized per order when assigning executor
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_executors' AND column_name = 'readiness_minutes'
  ) THEN
    ALTER TABLE order_executors ADD COLUMN readiness_minutes integer DEFAULT 30;
  END IF;
END $$;