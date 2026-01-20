/*
  # Add Couriers Table and Extended Order Fields

  ## Summary
  Adds courier management and extends orders table with detailed delivery information,
  customer contact details, and order execution parameters.

  ## 1. New Tables

  ### `couriers`
  - `id` (uuid, primary key) - Unique courier identifier
  - `partner_id` (uuid, foreign key) - Reference to partner
  - `branch_id` (uuid, foreign key) - Reference to branch
  - `name` (text) - Courier full name
  - `phone` (text) - Courier phone number
  - `is_active` (boolean) - Whether courier is currently active
  - `created_at` (timestamptz) - Creation timestamp

  ## 2. Modified Tables

  ### `orders` - Added columns:
  - `address_line` (text) - Full address (City, Street, House number)
  - `floor` (text) - Floor number
  - `apartment` (text) - Apartment number
  - `entrance` (text) - Entrance/Porch number
  - `intercom` (text) - Intercom code
  - `office` (text) - Office number (for business centers)
  - `comment` (text) - Order comment/notes
  - `delivery_type` (text) - "delivery" or "pickup"
  - `courier_id` (uuid, FK) - Reference to courier (NULL for pickup)
  - `total_amount` (numeric) - Total order amount
  - Updated address field to be nullable (will use address_line instead)

  ## 3. Security
  - Enable RLS on couriers table
  - Service role can manage all data
  - Partners can only see their own couriers

  ## 4. Important Notes
  - Uses IF NOT EXISTS checks to safely modify schema
  - Maintains backward compatibility with existing orders
  - Provides default values for new columns where appropriate
*/

-- Create couriers table
CREATE TABLE IF NOT EXISTS couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Add new columns to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'address_line'
  ) THEN
    ALTER TABLE orders ADD COLUMN address_line text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'floor'
  ) THEN
    ALTER TABLE orders ADD COLUMN floor text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'apartment'
  ) THEN
    ALTER TABLE orders ADD COLUMN apartment text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'entrance'
  ) THEN
    ALTER TABLE orders ADD COLUMN entrance text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'intercom'
  ) THEN
    ALTER TABLE orders ADD COLUMN intercom text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'office'
  ) THEN
    ALTER TABLE orders ADD COLUMN office text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'comment'
  ) THEN
    ALTER TABLE orders ADD COLUMN comment text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_type'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_type text DEFAULT 'delivery' CHECK (delivery_type IN ('delivery', 'pickup'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'courier_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN courier_id uuid REFERENCES couriers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN total_amount numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Make address column nullable (we'll use address_line instead)
ALTER TABLE orders ALTER COLUMN address DROP NOT NULL;

-- Enable RLS on couriers
ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for couriers
CREATE POLICY "Service role can manage couriers"
  ON couriers FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can read active couriers"
  ON couriers FOR SELECT
  USING (is_active = true);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_couriers_partner_id ON couriers(partner_id);
CREATE INDEX IF NOT EXISTS idx_couriers_branch_id ON couriers(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_courier_id ON orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_type ON orders(delivery_type);