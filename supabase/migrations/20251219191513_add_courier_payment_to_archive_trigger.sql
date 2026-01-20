/*
  # Add courier_payment_amount to archive trigger

  1. Changes
    - Update archive_completed_order function to include courier_payment_amount field
    - This ensures delivery price and courier payment are preserved in history
    - Values won't change when executor settings are modified

  2. Security
    - No RLS changes needed
*/

CREATE OR REPLACE FUNCTION archive_completed_order()
RETURNS TRIGGER AS $$
BEGIN
IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
INSERT INTO archived_orders (
id, partner_id, branch_id, user_id, status, total, created_at,
order_number, address, phone, order_items_summary, payment_method_id,
accepted_at, scheduled_at, extra_time_minutes, total_time_minutes,
completed_at, completed_total_time_minutes, address_line, floor,
apartment, entrance, intercom, office, comment, delivery_type,
courier_id, total_amount, payment_status, accumulated_time_minutes,
shift_id, shift_order_number, delay_started_at, distance_km,
duration_minutes, delivery_lat, delivery_lng, telegram_message_id,
courier_search_started_at, courier_message_id, cash_amount,
accumulated_delay_minutes, sent_to_poster, poster_order_id,
poster_status, poster_error, delivery_price_uah, delivery_price_manual,
executor_type, executor_id, executor_zone_id, assignment_status,
courier_zone_id, group_chat_message_id, en_route_at,
manual_completion_reason, payment_breakdown, source, source_call_id, client_id,
courier_payment_amount
)
VALUES (
NEW.id, NEW.partner_id, NEW.branch_id, NEW.user_id, NEW.status, NEW.total,
NEW.created_at, NEW.order_number, NEW.address, NEW.phone,
NEW.order_items_summary, NEW.payment_method_id, NEW.accepted_at,
NEW.scheduled_at, NEW.extra_time_minutes, NEW.total_time_minutes,
NEW.completed_at, NEW.completed_total_time_minutes, NEW.address_line,
NEW.floor, NEW.apartment, NEW.entrance, NEW.intercom, NEW.office,
NEW.comment, NEW.delivery_type, NEW.courier_id, NEW.total_amount,
NEW.payment_status, NEW.accumulated_time_minutes, NEW.shift_id,
NEW.shift_order_number, NEW.delay_started_at, NEW.distance_km,
NEW.duration_minutes, NEW.delivery_lat, NEW.delivery_lng,
NEW.telegram_message_id, NEW.courier_search_started_at,
NEW.courier_message_id, NEW.cash_amount, NEW.accumulated_delay_minutes,
NEW.sent_to_poster, NEW.poster_order_id, NEW.poster_status,
NEW.poster_error, NEW.delivery_price_uah, NEW.delivery_price_manual,
NEW.executor_type, NEW.executor_id, NEW.executor_zone_id,
NEW.assignment_status, NEW.courier_zone_id, NEW.group_chat_message_id,
NEW.en_route_at, NEW.manual_completion_reason, NEW.payment_breakdown,
NEW.source, NEW.source_call_id, NEW.client_id,
NEW.courier_payment_amount
)
ON CONFLICT (id) DO UPDATE SET
status = EXCLUDED.status,
completed_at = EXCLUDED.completed_at,
completed_total_time_minutes = EXCLUDED.completed_total_time_minutes,
accumulated_time_minutes = EXCLUDED.accumulated_time_minutes,
accumulated_delay_minutes = EXCLUDED.accumulated_delay_minutes,
courier_id = EXCLUDED.courier_id,
courier_zone_id = EXCLUDED.courier_zone_id,
executor_type = EXCLUDED.executor_type,
executor_id = EXCLUDED.executor_id,
executor_zone_id = EXCLUDED.executor_zone_id,
payment_breakdown = EXCLUDED.payment_breakdown,
source = EXCLUDED.source,
source_call_id = EXCLUDED.source_call_id,
client_id = EXCLUDED.client_id,
courier_payment_amount = EXCLUDED.courier_payment_amount,
delivery_price_uah = EXCLUDED.delivery_price_uah;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;