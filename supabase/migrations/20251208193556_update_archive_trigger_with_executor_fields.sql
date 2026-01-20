/*
  # Update Archive Trigger with Executor Fields

  1. Changes
    - Updates the archive_order_before_delete function to copy new fields
    - Includes executor_type, executor_id, executor_zone_id, delivery_price_uah
    - Includes delivery_payer, client_name, delivery_address
    - Includes shift_id, en_route_at, courier_zone_id

  2. Purpose
    - Ensure all order data is properly archived for history
*/

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
    delivery_price_uah, delivery_payer, client_name, delivery_address
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
    OLD.delivery_price_uah, OLD.delivery_payer, OLD.client_name, OLD.delivery_address
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS archive_order_trigger ON orders;

CREATE TRIGGER archive_order_trigger
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION archive_order_before_delete();