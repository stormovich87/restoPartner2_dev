/*
  # Add foreign key for courier_zone_id in archived_orders

  1. Changes
    - Add foreign key constraint from archived_orders.courier_zone_id to courier_delivery_zones.id
    - This enables JOIN queries to fetch courier payment information

  2. Notes
    - The constraint allows NULL values (not all orders have a courier zone)
    - ON DELETE SET NULL ensures archived orders remain if zone is deleted
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'archived_orders_courier_zone_id_fkey'
    AND table_name = 'archived_orders'
  ) THEN
    ALTER TABLE archived_orders
    ADD CONSTRAINT archived_orders_courier_zone_id_fkey
    FOREIGN KEY (courier_zone_id) REFERENCES courier_delivery_zones(id)
    ON DELETE SET NULL;
  END IF;
END $$;
