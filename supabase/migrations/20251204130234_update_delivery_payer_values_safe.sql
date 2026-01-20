/*
  # Update delivery_payer values from establishment to restaurant (safe version)

  1. Changes
    - If delivery_payer column exists, update all 'establishment' values to 'restaurant' in orders table
    - If delivery_payer column exists, update all 'establishment' values to 'restaurant' in archived_orders table
    - Update default value for delivery_payer column if it exists
  
  2. Notes
    - This migration ensures consistency with the new naming convention
    - 'restaurant' is more clear than 'establishment'
    - Checks for column existence before updating
*/

DO $$
BEGIN
  -- Update orders table if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_payer'
  ) THEN
    UPDATE orders SET delivery_payer = 'restaurant' WHERE delivery_payer = 'establishment';
    ALTER TABLE orders ALTER COLUMN delivery_payer SET DEFAULT 'restaurant';
  END IF;

  -- Update archived_orders table if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'delivery_payer'
  ) THEN
    UPDATE archived_orders SET delivery_payer = 'restaurant' WHERE delivery_payer = 'establishment';
    ALTER TABLE archived_orders ALTER COLUMN delivery_payer SET DEFAULT 'restaurant';
  END IF;
END $$;