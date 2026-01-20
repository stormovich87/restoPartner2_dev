/*
  # Add shift tracking to orders

  1. Changes
    - Add `shift_id` column to `orders` table to track which shift an order belongs to
    - Add foreign key constraint to reference `shifts` table
    - Create index for better query performance
    - Update existing orders to assign them to open shifts (if any)
    - Add `shift_id` to `archived_orders` for consistency

  2. Migration Strategy
    - Add nullable column first
    - Update existing records
    - Add index for performance
*/

-- Add shift_id to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL;

-- Add shift_id to archived_orders table
ALTER TABLE archived_orders 
ADD COLUMN IF NOT EXISTS shift_id uuid;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_orders_shift_id ON orders(shift_id);

-- Update existing orders to assign to current open shifts
DO $$
DECLARE
  shift_record RECORD;
BEGIN
  FOR shift_record IN 
    SELECT id, branch_id, partner_id 
    FROM shifts 
    WHERE status = 'open'
  LOOP
    UPDATE orders 
    SET shift_id = shift_record.id 
    WHERE branch_id = shift_record.branch_id 
      AND partner_id = shift_record.partner_id
      AND shift_id IS NULL
      AND status IN ('in_progress', 'en_route');
  END LOOP;
END $$;
