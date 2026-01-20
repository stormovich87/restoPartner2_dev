/*
  # Add Shifts System and Shift Order Numbers

  ## 1. New Tables
  
  ### `shifts` table
  - `id` (uuid, primary key) - Unique shift identifier
  - `partner_id` (uuid, foreign key) - Reference to partner
  - `branch_id` (uuid, foreign key) - Reference to branch
  - `opened_at` (timestamptz) - When shift was opened
  - `closed_at` (timestamptz, nullable) - When shift was closed
  - `opened_by` (uuid, nullable) - Admin user who opened the shift
  - `closed_by` (uuid, nullable) - Admin user who closed the shift
  - `status` (text) - 'open' or 'closed'
  - `total_orders_count` (integer) - Total orders in this shift
  - `completed_orders_count` (integer) - Completed orders in this shift
  - `created_at` (timestamptz) - Record creation timestamp

  ## 2. Modified Tables
  
  ### `orders` table - Added columns:
  - `shift_id` (uuid, nullable, foreign key) - Reference to shift
  - `shift_order_number` (integer, nullable) - Order number within the shift

  ## 3. Security
  - Enable RLS on `shifts` table
  - Add policies for authenticated users to manage shifts
  - Add policy for anon users to read open shifts

  ## 4. Indexes
  - Index on `shifts(partner_id, branch_id, status)` for quick lookups
  - Index on `shifts(opened_at)` for chronological queries
  - Index on `orders(shift_id)` for shift-related queries
*/

-- Create shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  opened_at timestamptz DEFAULT now() NOT NULL,
  closed_at timestamptz,
  opened_by uuid REFERENCES admin_users(id),
  closed_by uuid REFERENCES admin_users(id),
  status text DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'closed')),
  total_orders_count integer DEFAULT 0 NOT NULL,
  completed_orders_count integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add shift columns to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shift_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shift_order_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN shift_order_number integer;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shifts_partner_branch_status ON shifts(partner_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_opened_at ON shifts(opened_at);
CREATE INDEX IF NOT EXISTS idx_orders_shift_id ON orders(shift_id);

-- Enable RLS on shifts table
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view shifts for their partner
CREATE POLICY "Authenticated users can view shifts for their partner"
  ON shifts
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners 
      WHERE id = (
        SELECT partner_id FROM admin_users 
        WHERE id = auth.uid()
      )
    )
  );

-- Policy: Authenticated users can create shifts for their partner
CREATE POLICY "Authenticated users can create shifts for their partner"
  ON shifts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    partner_id IN (
      SELECT id FROM partners 
      WHERE id = (
        SELECT partner_id FROM admin_users 
        WHERE id = auth.uid()
      )
    )
  );

-- Policy: Authenticated users can update shifts for their partner
CREATE POLICY "Authenticated users can update shifts for their partner"
  ON shifts
  FOR UPDATE
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners 
      WHERE id = (
        SELECT partner_id FROM admin_users 
        WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    partner_id IN (
      SELECT id FROM partners 
      WHERE id = (
        SELECT partner_id FROM admin_users 
        WHERE id = auth.uid()
      )
    )
  );

-- Policy: Anonymous users can view open shifts
CREATE POLICY "Anonymous users can view open shifts"
  ON shifts
  FOR SELECT
  TO anon
  USING (status = 'open');

-- Function to update shift order counts
CREATE OR REPLACE FUNCTION update_shift_order_counts()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.shift_id IS NOT NULL THEN
    UPDATE shifts
    SET total_orders_count = total_orders_count + 1,
        completed_orders_count = completed_orders_count + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END
    WHERE id = NEW.shift_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.shift_id IS NOT NULL THEN
    IF OLD.status != NEW.status AND NEW.status = 'completed' THEN
      UPDATE shifts
      SET completed_orders_count = completed_orders_count + 1
      WHERE id = NEW.shift_id;
    ELSIF OLD.status != NEW.status AND OLD.status = 'completed' THEN
      UPDATE shifts
      SET completed_orders_count = completed_orders_count - 1
      WHERE id = NEW.shift_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.shift_id IS NOT NULL THEN
    UPDATE shifts
    SET total_orders_count = total_orders_count - 1,
        completed_orders_count = completed_orders_count - CASE WHEN OLD.status = 'completed' THEN 1 ELSE 0 END
    WHERE id = OLD.shift_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for shift order counts
DROP TRIGGER IF EXISTS trigger_update_shift_order_counts ON orders;
CREATE TRIGGER trigger_update_shift_order_counts
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_shift_order_counts();