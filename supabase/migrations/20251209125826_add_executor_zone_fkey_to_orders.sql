/*
  # Add executor_zone_id foreign key to orders table

  1. Changes
    - Add foreign key constraint from orders.executor_zone_id to performer_delivery_zones.id
    - This enables joining executor zone data when querying orders

  2. Notes
    - Required for displaying correct courier payment in order history
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_executor_zone_id_fkey'
    AND table_name = 'orders'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_executor_zone_id_fkey
    FOREIGN KEY (executor_zone_id) REFERENCES performer_delivery_zones(id);
  END IF;
END $$;