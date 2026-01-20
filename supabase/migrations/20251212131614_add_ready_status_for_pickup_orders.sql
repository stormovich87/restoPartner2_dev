/*
  # Add 'ready' status for pickup orders

  1. Changes
    - Add new order status 'ready' between 'in_progress' and 'completed' for pickup orders
    - This status indicates the order is ready for customer pickup
    - Update status check constraint to include 'ready'
*/

-- First, check if the constraint exists and drop it if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_status_check'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_status_check;
  END IF;
END $$;

-- Add the updated constraint with 'ready' status
ALTER TABLE orders 
  ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('in_progress', 'ready', 'en_route', 'completed'));

-- Do the same for archived_orders
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'archived_orders_status_check'
  ) THEN
    ALTER TABLE archived_orders DROP CONSTRAINT archived_orders_status_check;
  END IF;
END $$;

ALTER TABLE archived_orders 
  ADD CONSTRAINT archived_orders_status_check 
  CHECK (status IN ('in_progress', 'ready', 'en_route', 'completed'));