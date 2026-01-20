/*
  # Add accumulated delay time tracking

  1. Changes
    - Add `accumulated_delay_minutes` column to `orders` table
    - This stores the total accumulated delay time for the order
    - When delay_started_at is set, delay accumulates until order is completed
    - Prevents delay timer from jumping when delay_started_at changes

  2. Purpose
    - Each order maintains its own delay counter
    - Delay counter only stops when order status = 'completed'
    - Accumulated delay persists even if delay_started_at is updated
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'accumulated_delay_minutes'
  ) THEN
    ALTER TABLE orders ADD COLUMN accumulated_delay_minutes integer DEFAULT 0 NOT NULL;
  END IF;
END $$;