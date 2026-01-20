/*
  # Add minimum order amount fields

  1. Changes to courier_delivery_zones:
    - Add `min_order_amount` (numeric, nullable) - minimum order amount for this delivery zone

  2. Changes to partner_settings:
    - Add `min_pickup_order_amount` (numeric, nullable) - minimum order amount for pickup orders

  3. Purpose:
    - Allow partners to set minimum order requirements per delivery zone
    - Allow partners to set minimum order requirement for pickup (self-service) orders
    - Display warning when order total is below minimum required amount
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courier_delivery_zones' AND column_name = 'min_order_amount'
  ) THEN
    ALTER TABLE courier_delivery_zones ADD COLUMN min_order_amount numeric DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'min_pickup_order_amount'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN min_pickup_order_amount numeric DEFAULT NULL;
  END IF;
END $$;

COMMENT ON COLUMN courier_delivery_zones.min_order_amount IS 'Minimum order amount for this delivery zone';
COMMENT ON COLUMN partner_settings.min_pickup_order_amount IS 'Minimum order amount for pickup (self-service) orders';