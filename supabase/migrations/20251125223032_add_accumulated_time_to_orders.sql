/*
  # Add accumulated time tracking to orders

  ## Changes
  1. New Column
    - `accumulated_time_minutes` (integer, default 0)
      - Stores the accumulated working time when order is paused/completed
      - Used to resume timer from the correct position when order returns to "in_progress"
  
  ## Purpose
  This allows orders to maintain timer continuity when switching between statuses:
  - When order is completed, accumulated time is saved
  - When order returns to "in_progress", timer continues from accumulated time
  - Timer only runs when status is "in_progress"
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'accumulated_time_minutes'
  ) THEN
    ALTER TABLE orders ADD COLUMN accumulated_time_minutes integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Set accumulated_time_minutes for completed orders to match their completed_total_time_minutes
UPDATE orders 
SET accumulated_time_minutes = COALESCE(completed_total_time_minutes, 0)
WHERE status = 'completed' AND accumulated_time_minutes = 0;
