/*
  # Add default payment method to executors

  1. Changes
    - Add `default_payment_method_id` column to `executors` table
      - UUID field that references `payment_methods` table
      - Nullable (optional default payment method)
      - Will be used to auto-select payment method when executor is chosen
    
  2. Security
    - No RLS changes needed (inherits from existing policies)
    
  3. Notes
    - When an executor is selected for an order, this payment method will be auto-selected
    - This provides convenience for users creating orders with specific executors
*/

-- Add default_payment_method_id to executors table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'executors' AND column_name = 'default_payment_method_id'
  ) THEN
    ALTER TABLE executors ADD COLUMN default_payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL;
  END IF;
END $$;