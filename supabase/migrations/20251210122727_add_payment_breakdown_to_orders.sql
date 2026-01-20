/*
  # Add payment breakdown to orders

  1. Changes
    - Add `payment_breakdown` column to `orders` table
      - JSONB field to store array of payment splits
      - Each item: { method_id: uuid, amount: number, status: 'paid' | 'unpaid' }
      - Defaults to NULL (for backward compatibility)
    
    - Add same field to `archived_orders` table for consistency
    
  2. Security
    - No RLS changes needed (inherits from existing policies)
    
  3. Notes
    - This enables split payments across multiple payment methods
    - Status tracking for non-cash payments
*/

-- Add payment_breakdown to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_breakdown'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_breakdown JSONB DEFAULT NULL;
  END IF;
END $$;

-- Add payment_breakdown to archived_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'payment_breakdown'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN payment_breakdown JSONB DEFAULT NULL;
  END IF;
END $$;

-- Update the archive trigger to include payment_breakdown
CREATE OR REPLACE FUNCTION archive_completed_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO archived_orders (
      id, partner_id, branch_id, order_number, shift_order_number, shift_id,
      client_name, phone, delivery_address, delivery_lat, delivery_lng,
      order_type, comment, total_amount, delivery_price, delivery_price_manual,
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
      NEW.order_type, NEW.comment, NEW.total_amount, NEW.delivery_price, NEW.delivery_price_manual,
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
