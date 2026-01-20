/*
  # Add cash amount field to orders

  1. Changes
    - Add `cash_amount` column to `orders` table to store the amount customer pays with
    - This is used to calculate change when payment method is cash

  2. Notes
    - Will be null for non-cash payments
    - Should be greater than or equal to total_amount for cash payments
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'cash_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN cash_amount numeric(10,2);
  END IF;
END $$;