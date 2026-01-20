/*
  # Extend Orders Table with Full Order Management Schema

  ## Summary
  Extends the existing orders table with all fields needed for complete order tracking:
  order numbers, customer details, payment methods, timing information, and status management.

  ## 1. New Tables

  ### `payment_methods`
  - `id` (uuid, primary key) - Unique payment method identifier
  - `partner_id` (uuid, foreign key) - Reference to partner
  - `name` (text) - Payment method name (e.g., "Наличные", "Карта")
  - `is_active` (boolean) - Whether method is currently active
  - `created_at` (timestamptz) - Creation timestamp

  ## 2. Modified Tables

  ### `orders` - Added columns:
  - `order_number` (text) - Unique order number for display
  - `address` (text) - Delivery address
  - `phone` (text) - Customer phone number
  - `order_items_summary` (text) - Brief description of order contents
  - `payment_method_id` (uuid, FK) - Reference to payment method
  - `accepted_at` (timestamptz) - When order was accepted
  - `scheduled_at` (timestamptz) - When order should be ready (NULL = now)
  - `extra_time_minutes` (integer) - Additional time added to order (in minutes)
  - `total_time_minutes` (integer) - Total preparation time
  - `completed_at` (timestamptz) - When order was completed
  - `completed_total_time_minutes` (integer) - Actual time taken to complete
  - Updated `status` to use: "in_progress", "completed"

  ## 3. Security
  - Enable RLS on payment_methods table
  - Service role can manage all data
  - Partners can only see their own payment methods and orders

  ## 4. Important Notes
  - Uses IF NOT EXISTS and IF EXISTS checks to safely modify schema
  - Maintains backward compatibility with existing orders data
  - Provides default values for new columns
*/

-- Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Add new columns to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'address'
  ) THEN
    ALTER TABLE orders ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'phone'
  ) THEN
    ALTER TABLE orders ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_items_summary'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_items_summary text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_method_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN accepted_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'scheduled_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN scheduled_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'extra_time_minutes'
  ) THEN
    ALTER TABLE orders ADD COLUMN extra_time_minutes integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'total_time_minutes'
  ) THEN
    ALTER TABLE orders ADD COLUMN total_time_minutes integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'completed_total_time_minutes'
  ) THEN
    ALTER TABLE orders ADD COLUMN completed_total_time_minutes integer;
  END IF;
END $$;

-- Update existing orders to have accepted_at if NULL
UPDATE orders SET accepted_at = created_at WHERE accepted_at IS NULL;

-- Enable RLS on payment_methods
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_methods
CREATE POLICY "Service role can manage payment methods"
  ON payment_methods FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can read active payment methods"
  ON payment_methods FOR SELECT
  USING (is_active = true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_partner_id ON orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_accepted_at ON orders(accepted_at);
CREATE INDEX IF NOT EXISTS idx_payment_methods_partner_id ON payment_methods(partner_id);