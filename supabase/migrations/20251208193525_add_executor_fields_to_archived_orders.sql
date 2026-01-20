/*
  # Add executor fields to archived_orders table

  1. Changes
    - Add executor_type column for tracking performer/courier type
    - Add executor_id column for executor reference
    - Add executor_zone_id column for zone reference
    - Add delivery_price_uah column for delivery price
    - Add delivery_payer column for who pays for delivery
    - Add client_name column for client name
    - Add delivery_address column for delivery address

  2. Purpose
    - Enable proper order history display with delivery pricing
    - Track courier payments based on zones
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'executor_type'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN executor_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'executor_id'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN executor_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'executor_zone_id'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN executor_zone_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'delivery_price_uah'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN delivery_price_uah numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'delivery_payer'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN delivery_payer text DEFAULT 'client';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'client_name'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN client_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'delivery_address'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN delivery_address text;
  END IF;
END $$;