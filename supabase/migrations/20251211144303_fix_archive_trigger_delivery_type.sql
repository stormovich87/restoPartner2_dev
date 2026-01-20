/*
  # Fix archive trigger to use correct field name

  1. Changes
    - Update `archive_completed_order()` function to use `delivery_type` instead of `order_type`
    - The field in database is named `delivery_type` but the trigger was using `order_type`
    - This fixes archiving failures when completing orders
  
  2. Notes
    - No data changes needed, only fixing the trigger function
    - This resolves issues with order completion and archiving
*/

CREATE OR REPLACE FUNCTION archive_completed_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO archived_orders (
      id, partner_id, branch_id, order_number, shift_order_number, shift_id,
      client_name, phone, delivery_address, delivery_lat, delivery_lng,
      delivery_type, comment, total_amount, delivery_price, delivery_price_manual,
      delivery_payer, payment_method_id, cash_amount, status, courier_id,
      created_at, updated_at, expected_delivery_time, actual_delivery_time,
      delay_reason, accumulated_time, accumulated_delay_time,
      telegram_group_message_id, telegram_group_info_message_id,
      telegram_courier_message_id, distance_km, duration_minutes,
      en_route_at, manual_completion_reason, poster_spot_id, poster_incoming_order_id,
      executor_id, executor_zone_id, courier_zone_id, payment_breakdown
    ) VALUES (
      NEW.id, NEW.partner_id, NEW.branch_id, NEW.order_number, NEW.shift_order_number, NEW.shift_id,
      NEW.client_name, NEW.phone, NEW.delivery_address, NEW.delivery_lat, NEW.delivery_lng,
      NEW.delivery_type, NEW.comment, NEW.total_amount, NEW.delivery_price, NEW.delivery_price_manual,
      NEW.delivery_payer, NEW.payment_method_id, NEW.cash_amount, NEW.status, NEW.courier_id,
      NEW.created_at, NEW.updated_at, NEW.expected_delivery_time, NEW.actual_delivery_time,
      NEW.delay_reason, NEW.accumulated_time, NEW.accumulated_delay_time,
      NEW.telegram_group_message_id, NEW.telegram_group_info_message_id,
      NEW.telegram_courier_message_id, NEW.distance_km, NEW.duration_minutes,
      NEW.en_route_at, NEW.manual_completion_reason, NEW.poster_spot_id, NEW.poster_incoming_order_id,
      NEW.executor_id, NEW.executor_zone_id, NEW.courier_zone_id, NEW.payment_breakdown
    );
    
    DELETE FROM orders WHERE id = NEW.id;
    
    RETURN NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;