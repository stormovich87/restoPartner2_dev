/*
  # Add Payment Fields to Orders and Payment Methods

  ## Summary
  Adds payment status tracking to orders and method type classification 
  to payment methods for cash/cashless distinction.

  ## 1. Modified Tables

  ### `orders` - Added column:
  - `payment_status` (text) - Payment status for cashless orders ('paid' | 'unpaid')
    - NULL for cash payments (not tracked)
    - 'unpaid' by default for cashless
    - 'paid' when payment confirmed

  ### `payment_methods` - Added column:
  - `method_type` (text) - Classification of payment method
    - 'cash' for cash payments
    - 'cashless' for non-cash payments

  ## 2. Important Notes
  - Uses IF NOT EXISTS checks for safe migration
  - payment_status is nullable - only used for cashless transactions
  - method_type defaults to 'cash' for backward compatibility
*/

-- Add payment_status to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status text CHECK (payment_status IN ('paid', 'unpaid'));
  END IF;
END $$;

-- Add method_type to payment_methods table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_methods' AND column_name = 'method_type'
  ) THEN
    ALTER TABLE payment_methods ADD COLUMN method_type text DEFAULT 'cash' CHECK (method_type IN ('cash', 'cashless'));
  END IF;
END $$;

-- Create index for faster payment status queries
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status) WHERE payment_status IS NOT NULL;
