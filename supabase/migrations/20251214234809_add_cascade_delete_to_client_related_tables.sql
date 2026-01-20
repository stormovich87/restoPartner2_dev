/*
  # Add CASCADE DELETE to client-related tables

  1. Changes
    - Update foreign keys in client_addresses to CASCADE on delete
    - Update foreign keys in client_orders_history to CASCADE on delete
  
  2. Security
    - When a client is deleted, all related addresses and order history are also deleted
    - Maintains data integrity
*/

-- Fix client_addresses foreign key to cascade delete
ALTER TABLE client_addresses 
  DROP CONSTRAINT IF EXISTS client_addresses_client_id_fkey;

ALTER TABLE client_addresses 
  ADD CONSTRAINT client_addresses_client_id_fkey 
  FOREIGN KEY (client_id) 
  REFERENCES clients(id) 
  ON DELETE CASCADE;

-- Fix client_orders_history foreign key to cascade delete
ALTER TABLE client_orders_history 
  DROP CONSTRAINT IF EXISTS client_orders_history_client_id_fkey;

ALTER TABLE client_orders_history 
  ADD CONSTRAINT client_orders_history_client_id_fkey 
  FOREIGN KEY (client_id) 
  REFERENCES clients(id) 
  ON DELETE CASCADE;
