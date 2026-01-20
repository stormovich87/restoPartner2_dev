/*
  # Add accumulated_delay_minutes to archived_orders

  1. Changes
    - Add `accumulated_delay_minutes` column to `archived_orders` table
    - Update archive trigger to include accumulated_delay_minutes

  2. Purpose
    - Preserve delay tracking data in archived orders
    - Maintain consistency between orders and archived_orders tables
*/

-- Add column to archived_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'accumulated_delay_minutes'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN accumulated_delay_minutes integer DEFAULT 0;
  END IF;
END $$;

-- Update archive trigger function
CREATE OR REPLACE FUNCTION archive_order_before_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO archived_orders (
    id, partner_id, branch_id, user_id, status, total,
    created_at, order_number, address, phone, order_items_summary,
    payment_method_id, accepted_at, scheduled_at, extra_time_minutes,
    total_time_minutes, completed_at, completed_total_time_minutes,
    address_line, floor, apartment, entrance, intercom, office, comment,
    delivery_type, courier_id, total_amount, payment_status,
    accumulated_time_minutes, accumulated_delay_minutes, archived_at
  ) VALUES (
    OLD.id, OLD.partner_id, OLD.branch_id, OLD.user_id, OLD.status, OLD.total,
    OLD.created_at, OLD.order_number, OLD.address, OLD.phone, OLD.order_items_summary,
    OLD.payment_method_id, OLD.accepted_at, OLD.scheduled_at, OLD.extra_time_minutes,
    OLD.total_time_minutes, OLD.completed_at, OLD.completed_total_time_minutes,
    OLD.address_line, OLD.floor, OLD.apartment, OLD.entrance, OLD.intercom, OLD.office, OLD.comment,
    OLD.delivery_type, OLD.courier_id, OLD.total_amount, OLD.payment_status,
    OLD.accumulated_time_minutes, OLD.accumulated_delay_minutes, now()
  );
  RETURN OLD;
END;
$$;