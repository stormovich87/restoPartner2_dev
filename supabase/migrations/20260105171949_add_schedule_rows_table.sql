/*
  # Add Schedule Rows Table

  1. New Tables
    - `schedule_rows` - represents a row in the schedule table for a specific employee
      - `id` (uuid, primary key)
      - `partner_id` (uuid, foreign key to partners)
      - `period_id` (uuid, foreign key to schedule_periods)
      - `branch_id` (uuid, foreign key to branches)
      - `position_id` (uuid, nullable, foreign key to positions)
      - `staff_member_id` (uuid, nullable, foreign key to staff_members)
      - `display_order` (integer)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Add `row_id` column to `schedule_shifts` table
    - This allows grouping shifts by row instead of just by staff_member

  3. Security
    - Enable RLS on schedule_rows
    - Add policies for access

  4. Constraints
    - Unique constraint on (period_id, branch_id, staff_member_id) to prevent duplicate assignments
*/

-- Schedule Rows table
CREATE TABLE IF NOT EXISTS schedule_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES schedule_periods(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  position_id uuid REFERENCES positions(id) ON DELETE SET NULL,
  staff_member_id uuid REFERENCES staff_members(id) ON DELETE CASCADE,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE schedule_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view schedule rows"
  ON schedule_rows FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can insert schedule rows"
  ON schedule_rows FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Users can update schedule rows"
  ON schedule_rows FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete schedule rows"
  ON schedule_rows FOR DELETE
  TO authenticated, anon
  USING (true);

-- Add row_id to schedule_shifts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'row_id'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN row_id uuid REFERENCES schedule_rows(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create unique index to prevent duplicate employee assignments in same branch/period
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_rows_unique_assignment
  ON schedule_rows(period_id, branch_id, staff_member_id)
  WHERE staff_member_id IS NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_schedule_rows_partner ON schedule_rows(partner_id);
CREATE INDEX IF NOT EXISTS idx_schedule_rows_period ON schedule_rows(period_id);
CREATE INDEX IF NOT EXISTS idx_schedule_rows_branch ON schedule_rows(branch_id);
CREATE INDEX IF NOT EXISTS idx_schedule_rows_lookup ON schedule_rows(partner_id, period_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_row ON schedule_shifts(row_id);

-- Grant permissions
GRANT ALL ON schedule_rows TO anon, authenticated, service_role;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_rows;