/*
  # Make orders.user_id nullable

  1. Changes
    - Make `user_id` column in `orders` table nullable
    - This allows creating orders without requiring a logged-in user
    - Useful for scenarios where orders are created by the system or from external sources

  2. Notes
    - Existing orders with user_id will remain unchanged
    - New orders can be created without specifying user_id
*/

ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;