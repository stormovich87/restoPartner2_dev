/*
  # Add courier_id foreign key to archived_orders

  1. Changes
    - Add foreign key constraint from archived_orders.courier_id to couriers.id
    - This allows proper relationship querying in Supabase
*/

-- Add foreign key for courier_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'archived_orders_courier_id_fkey'
  ) THEN
    ALTER TABLE archived_orders
    ADD CONSTRAINT archived_orders_courier_id_fkey
    FOREIGN KEY (courier_id) REFERENCES couriers(id);
  END IF;
END $$;
