/*
  # Add en_route status to order_executors

  1. Changes
    - Drop existing status check constraint
    - Add new constraint with 'en_route' status included

  2. Purpose
    - Allow external couriers to update their order status to 'en_route' 
      when they click "Vyehal" button in Telegram
*/

ALTER TABLE order_executors DROP CONSTRAINT IF EXISTS order_executors_status_check;

ALTER TABLE order_executors ADD CONSTRAINT order_executors_status_check 
  CHECK (status = ANY (ARRAY['searching'::text, 'assigned'::text, 'en_route'::text, 'completed'::text, 'cancelled'::text]));