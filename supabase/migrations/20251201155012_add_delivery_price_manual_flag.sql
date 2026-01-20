/*
  # Add delivery price manual flag and courier zone tracking

  1. Changes to `orders` table
    - Add `delivery_price_manual` (boolean) - flag to track if delivery price was manually set
    - Add `courier_zone_id` (uuid) - reference to the manually selected courier delivery zone
  
  2. Changes to `archived_orders` table
    - Add same fields for consistency when archiving orders
  
  3. Notes
    - Default `delivery_price_manual` to false (automatic calculation)
    - `courier_zone_id` is nullable (only set when manual selection is made)
*/

-- Add fields to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_price_manual'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_price_manual boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'courier_zone_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN courier_zone_id uuid REFERENCES courier_delivery_zones(id);
  END IF;
END $$;

-- Add fields to archived_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'delivery_price_manual'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN delivery_price_manual boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'courier_zone_id'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN courier_zone_id uuid;
  END IF;
END $$;