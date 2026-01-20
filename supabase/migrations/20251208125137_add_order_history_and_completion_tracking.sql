/*
  # Add Order History Tracking and Completion Fields

  ## Changes Made:
  
  1. New Tables
    - `order_history` - Tracks all actions performed on orders
      - `id` (uuid, primary key)
      - `order_id` (uuid, foreign key to orders)
      - `action_type` (text) - Type of action: 'created', 'accepted', 'status_changed', 'cancelled', 'completed', 'assigned', 'updated'
      - `action_by_user_id` (uuid, nullable) - Admin user who performed the action
      - `action_by_courier_id` (uuid, nullable) - Courier who performed the action
      - `old_status` (text, nullable) - Previous order status
      - `new_status` (text, nullable) - New order status
      - `details` (jsonb, nullable) - Additional details about the action
      - `created_at` (timestamptz)

  2. Modified Tables
    - `orders` and `archived_orders`
      - Add `completed_by_user_id` (uuid, nullable) - Admin who completed the order
      - Add `completed_by_courier_id` (uuid, nullable) - Courier who completed the order
      - Add `completed_at` (timestamptz, nullable) - When order was completed

  3. Security
    - Enable RLS on `order_history` table
    - Add policies for authenticated users to read their partner's order history
    - Add policies for service role to insert order history

  4. Indexes
    - Add indexes for efficient querying by order_id, created_at, action_type
*/

-- Create order_history table
CREATE TABLE IF NOT EXISTS order_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('created', 'accepted', 'status_changed', 'cancelled', 'completed', 'assigned', 'updated', 'courier_accepted', 'courier_cancelled')),
  action_by_user_id uuid REFERENCES admin_users(id),
  action_by_courier_id uuid REFERENCES couriers(id),
  old_status text,
  new_status text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add completion tracking fields to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'completed_by_user_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN completed_by_user_id uuid REFERENCES admin_users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'completed_by_courier_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN completed_by_courier_id uuid REFERENCES couriers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN completed_at timestamptz;
  END IF;
END $$;

-- Add completion tracking fields to archived_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'completed_by_user_id'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN completed_by_user_id uuid REFERENCES admin_users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'completed_by_courier_id'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN completed_by_courier_id uuid REFERENCES couriers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN completed_at timestamptz;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;

-- Policies for order_history
CREATE POLICY "Users can view order history for their partner"
  ON order_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN branches b ON o.branch_id = b.id
      JOIN admin_partner_access apa ON apa.partner_id = b.partner_id
      WHERE o.id = order_history.order_id
      AND apa.admin_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert order history"
  ON order_history FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Anon can view order history"
  ON order_history FOR SELECT
  TO anon
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON order_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_history_action_type ON order_history(action_type);
CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON orders(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_archived_orders_completed_at ON archived_orders(completed_at) WHERE completed_at IS NOT NULL;
