/*
  # Add foreign key for executor_zone_id to archived_orders

  1. Changes
    - Add foreign key constraint from archived_orders.executor_zone_id to performer_delivery_zones.id
    
  2. Purpose
    - Enable joining performer_delivery_zones to get courier_payment for order history
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'archived_orders_executor_zone_id_fkey'
    AND table_name = 'archived_orders'
  ) THEN
    ALTER TABLE archived_orders
    ADD CONSTRAINT archived_orders_executor_zone_id_fkey
    FOREIGN KEY (executor_zone_id) REFERENCES performer_delivery_zones(id) ON DELETE SET NULL;
  END IF;
END $$;
