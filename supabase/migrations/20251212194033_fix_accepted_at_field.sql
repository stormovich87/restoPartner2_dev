/*
  # Fix accepted_at field for notification system

  1. Changes
    - Remove DEFAULT now() from accepted_at column
    - Set accepted_at to NULL for orders where is_accepted = false
    - This ensures notification system works correctly by showing orders that haven't been accepted yet

  2. Notes
    - accepted_at should only be set when order is actually accepted by staff
    - This is required for proper notification and alert functionality
*/

-- Remove default value from accepted_at
ALTER TABLE orders ALTER COLUMN accepted_at DROP DEFAULT;

-- Set accepted_at to NULL for orders that aren't accepted yet
UPDATE orders
SET accepted_at = NULL
WHERE is_accepted = false OR is_accepted IS NULL;
