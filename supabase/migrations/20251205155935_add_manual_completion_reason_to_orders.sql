/*
  # Add manual completion reason to orders

  1. Changes
    - Add `manual_completion_reason` column to orders table
    - Stores the reason when order status is manually changed to "completed" by staff
    - This helps track manual interventions and provides accountability

  2. Security
    - Field is nullable (only filled when manual completion occurs)
    - Can be used for audit purposes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'manual_completion_reason'
  ) THEN
    ALTER TABLE orders ADD COLUMN manual_completion_reason text;
  END IF;
END $$;
