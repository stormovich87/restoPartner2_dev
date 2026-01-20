/*
  # Add Courier Payment Amount Field

  1. New Fields
    - `orders.courier_payment_amount` - decimal field to store exact courier payment at assignment time
    - `archived_orders.courier_payment_amount` - same field for historical records

  2. Changes
    - Add courier_payment_amount column to orders table
    - Add courier_payment_amount column to archived_orders table
    - Update archive trigger to copy courier_payment_amount

  3. Purpose
    - Store the exact courier payment amount at the time of assignment
    - Prevent discrepancies when zone prices change after order assignment
    - Provide accurate historical payment data
*/

-- Add courier_payment_amount to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS courier_payment_amount numeric(10,2) DEFAULT NULL;

-- Add courier_payment_amount to archived_orders table
ALTER TABLE archived_orders
ADD COLUMN IF NOT EXISTS courier_payment_amount numeric(10,2) DEFAULT NULL;

-- Update archive trigger to include courier_payment_amount
DROP FUNCTION IF EXISTS archive_order_before_delete() CASCADE;

CREATE OR REPLACE FUNCTION archive_order_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO archived_orders (
    id, partner_id, branch_id, user_id, status, total,
    created_at, order_number, address, phone, order_items_summary,
    payment_method_id, accepted_at, scheduled_at, extra_time_minutes,
    total_time_minutes, completed_at, completed_total_time_minutes,
    address_line, floor, apartment, entrance, intercom, office, comment,
    delivery_type, courier_id, total_amount, payment_status,
    accumulated_time_minutes, archived_at, accumulated_delay_minutes,
    sent_to_poster, poster_order_id, poster_status, poster_error,
    delivery_price_manual, courier_zone_id, group_chat_message_id,
    shift_id, en_route_at, executor_type, executor_id, executor_zone_id,
    delivery_price_uah, delivery_payer, client_name, delivery_address,
    courier_payment_amount
  ) VALUES (
    OLD.id, OLD.partner_id, OLD.branch_id, OLD.user_id, OLD.status, OLD.total,
    OLD.created_at, OLD.order_number, OLD.address, OLD.phone, OLD.order_items_summary,
    OLD.payment_method_id, OLD.accepted_at, OLD.scheduled_at, OLD.extra_time_minutes,
    OLD.total_time_minutes, OLD.completed_at, OLD.completed_total_time_minutes,
    OLD.address_line, OLD.floor, OLD.apartment, OLD.entrance, OLD.intercom, OLD.office, OLD.comment,
    OLD.delivery_type, OLD.courier_id, OLD.total_amount, OLD.payment_status,
    OLD.accumulated_time_minutes, now(), OLD.accumulated_delay_minutes,
    OLD.sent_to_poster, OLD.poster_order_id, OLD.poster_status, OLD.poster_error,
    OLD.delivery_price_manual, OLD.courier_zone_id, OLD.group_chat_message_id,
    OLD.shift_id, OLD.en_route_at, OLD.executor_type, OLD.executor_id, OLD.executor_zone_id,
    OLD.delivery_price_uah, OLD.delivery_payer, OLD.client_name, OLD.delivery_address,
    OLD.courier_payment_amount
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS archive_order_trigger ON orders;

CREATE TRIGGER archive_order_trigger
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION archive_order_before_delete();