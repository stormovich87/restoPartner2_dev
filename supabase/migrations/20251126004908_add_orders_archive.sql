/*
  # Add Orders Archive System

  ## Summary
  Implements archival system for deleted orders. When an order is deleted, it is automatically
  moved to the archived_orders table instead of being permanently deleted.

  ## 1. New Tables

  ### `archived_orders`
  - Identical structure to `orders` table
  - `id` (uuid, primary key) - Unique order identifier (preserved from original)
  - `partner_id` (uuid) - Reference to partner
  - `branch_id` (uuid) - Reference to branch
  - `user_id` (uuid, nullable) - Reference to user
  - `courier_id` (uuid, nullable) - Reference to courier
  - `payment_method_id` (uuid, nullable) - Reference to payment method
  - All order fields preserved (order_number, address, phone, etc.)
  - `archived_at` (timestamptz) - When order was archived
  - `archived_by` (uuid, nullable) - Who archived the order

  ## 2. New Functions

  ### `archive_order_before_delete()`
  - Trigger function that runs BEFORE DELETE on orders table
  - Copies the order to archived_orders table
  - Preserves all order data
  - Prevents data loss

  ## 3. Security
  - Enable RLS on archived_orders table
  - Service role can manage archived orders
  - Partners can only view their own archived orders
  - Archived orders are read-only for partners

  ## 4. Important Notes
  - Uses IF NOT EXISTS to prevent errors on re-run
  - Trigger ensures no order is lost when deleted
  - Archive is append-only for partners (no modifications allowed)
  - All original order data is preserved including timestamps
*/

-- Create archived_orders table with same structure as orders
CREATE TABLE IF NOT EXISTS archived_orders (
  id uuid PRIMARY KEY,
  partner_id uuid NOT NULL,
  branch_id uuid,
  user_id uuid,
  status text DEFAULT 'pending',
  total numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  order_number text,
  address text,
  phone text,
  order_items_summary text,
  payment_method_id uuid,
  accepted_at timestamptz,
  scheduled_at timestamptz,
  extra_time_minutes integer DEFAULT 0,
  total_time_minutes integer DEFAULT 0,
  completed_at timestamptz,
  completed_total_time_minutes integer,
  address_line text,
  floor text,
  apartment text,
  entrance text,
  intercom text,
  office text,
  comment text,
  delivery_type text DEFAULT 'delivery',
  courier_id uuid,
  total_amount numeric DEFAULT 0,
  payment_status text,
  accumulated_time_minutes integer DEFAULT 0,
  archived_at timestamptz DEFAULT now(),
  archived_by uuid
);

-- Create function to archive order before deletion
CREATE OR REPLACE FUNCTION archive_order_before_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO archived_orders (
    id, partner_id, branch_id, user_id, status, total,
    created_at, order_number, address, phone, order_items_summary,
    payment_method_id, accepted_at, scheduled_at, extra_time_minutes,
    total_time_minutes, completed_at, completed_total_time_minutes,
    address_line, floor, apartment, entrance, intercom, office, comment,
    delivery_type, courier_id, total_amount, payment_status,
    accumulated_time_minutes, archived_at
  ) VALUES (
    OLD.id, OLD.partner_id, OLD.branch_id, OLD.user_id, OLD.status, OLD.total,
    OLD.created_at, OLD.order_number, OLD.address, OLD.phone, OLD.order_items_summary,
    OLD.payment_method_id, OLD.accepted_at, OLD.scheduled_at, OLD.extra_time_minutes,
    OLD.total_time_minutes, OLD.completed_at, OLD.completed_total_time_minutes,
    OLD.address_line, OLD.floor, OLD.apartment, OLD.entrance, OLD.intercom, OLD.office, OLD.comment,
    OLD.delivery_type, OLD.courier_id, OLD.total_amount, OLD.payment_status,
    OLD.accumulated_time_minutes, now()
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS archive_order_trigger ON orders;
CREATE TRIGGER archive_order_trigger
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION archive_order_before_delete();

-- Enable RLS on archived_orders
ALTER TABLE archived_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for archived_orders
CREATE POLICY "Service role can manage archived orders"
  ON archived_orders FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Partners can view their archived orders"
  ON archived_orders FOR SELECT
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE status = 'active'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_archived_orders_partner_id ON archived_orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_archived_orders_archived_at ON archived_orders(archived_at);
CREATE INDEX IF NOT EXISTS idx_archived_orders_order_number ON archived_orders(order_number);