/*
  # Add delivery payer field to orders

  1. Changes to `orders` table
    - Add `delivery_payer` (text) - who pays for delivery: 'establishment' or 'client'
    - Add `executor_readiness_minutes` (integer) - readiness time for executor in minutes
  
  2. Changes to `archived_orders` table
    - Add same fields for consistency
  
  3. Notes
    - Default `delivery_payer` to 'establishment'
    - Fields are used for Telegram message formatting
*/

-- Add fields to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_payer'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_payer text DEFAULT 'establishment';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'executor_readiness_minutes'
  ) THEN
    ALTER TABLE orders ADD COLUMN executor_readiness_minutes integer;
  END IF;
END $$;

-- Add fields to archived_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'delivery_payer'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN delivery_payer text DEFAULT 'establishment';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'executor_readiness_minutes'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN executor_readiness_minutes integer;
  END IF;
END $$;