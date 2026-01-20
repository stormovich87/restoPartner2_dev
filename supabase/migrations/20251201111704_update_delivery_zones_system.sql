/*
  # Update Delivery Zones System

  ## Overview
  Updates delivery zones system with missing fields and tables

  ## Changes

  ### partner_settings table
  - Add `courier_no_zone_message` field for message when address is outside zones

  ### orders table
  - Add `delivery_price_uah` - Final delivery price in UAH
  - Add `delivery_price_manual` - Whether price was manually set
  - Add `executor_type` - "courier" or "performer"
  - Add `executor_id` - UUID of executor
  - Add `executor_zone_id` - UUID of selected zone
  - Add `assignment_status` - "searching" or "assigned"

  ### executors table
  - `no_zone_message` already exists

  ## Tables
  - `courier_delivery_zones` - Already exists
  - `performer_delivery_zones` - Already exists (used for performer zones)
*/

-- Add courier_no_zone_message to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'courier_no_zone_message'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN courier_no_zone_message text DEFAULT 'Адрес доставки вне зоны обслуживания курьеров';
  END IF;
END $$;

-- Add delivery zone fields to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_price_uah'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_price_uah numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_price_manual'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_price_manual boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'executor_type'
  ) THEN
    ALTER TABLE orders ADD COLUMN executor_type text CHECK (executor_type IN ('courier', 'performer'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'executor_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN executor_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'executor_zone_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN executor_zone_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'assignment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN assignment_status text DEFAULT 'searching' CHECK (assignment_status IN ('searching', 'assigned'));
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_executor ON orders(executor_type, executor_id) WHERE executor_type IS NOT NULL;