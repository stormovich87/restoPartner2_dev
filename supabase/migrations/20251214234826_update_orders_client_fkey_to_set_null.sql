/*
  # Update orders foreign key for client_id to SET NULL on delete

  1. Changes
    - Update foreign key in orders table to SET NULL when client is deleted
  
  2. Rationale
    - Preserves order history even when client is deleted
    - Maintains referential integrity without data loss
*/

-- Fix orders foreign key to set null on client delete
ALTER TABLE orders 
  DROP CONSTRAINT IF EXISTS orders_client_id_fkey;

ALTER TABLE orders 
  ADD CONSTRAINT orders_client_id_fkey 
  FOREIGN KEY (client_id) 
  REFERENCES clients(id) 
  ON DELETE SET NULL;
