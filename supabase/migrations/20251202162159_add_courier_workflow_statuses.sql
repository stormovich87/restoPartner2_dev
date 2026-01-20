/*
  # Add Courier Workflow Statuses

  1. Changes
    - Add new statuses to orders table: 'searching', 'accepted', 'en_route'
    - Update status check constraint to allow new values
    - Status flow:
      - 'in_progress' - order created, no courier assigned
      - 'searching' - searching for courier in group chat
      - 'accepted' - courier accepted the order
      - 'en_route' - courier is on the way
      - 'completed' - order delivered

  2. Migration Details
    - Uses ALTER TABLE to add check constraint
    - Maintains backward compatibility
    - Existing 'in_progress' and 'completed' statuses remain valid
*/

-- Drop existing constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_status_check'
    AND table_name = 'orders'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_status_check;
  END IF;
END $$;

-- Add new constraint with additional statuses
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('in_progress', 'searching', 'accepted', 'en_route', 'completed'));