/*
  # Add delay tracking to orders table

  1. New Columns
    - `delay_started_at` (timestamptz, nullable)
      - Records when an order first became overdue
      - Used to calculate actual delay duration
      - Reset to NULL when order becomes non-overdue (due to extra time or schedule change)
    
  2. Purpose
    - Track the exact moment when delay begins
    - Calculate accurate delay duration from this fixed point
    - Enable proper delay timer that survives extra time additions and schedule changes
    
  3. Notes
    - This field is managed by the application logic
    - When an order transitions from non-overdue to overdue: set to current timestamp
    - When an order transitions from overdue to non-overdue: set to NULL
    - When overdue status persists: keep the original timestamp to maintain accurate delay duration
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delay_started_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN delay_started_at timestamptz DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_delay_started_at ON orders(delay_started_at) WHERE delay_started_at IS NOT NULL;