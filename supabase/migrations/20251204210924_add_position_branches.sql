/*
  # Add position branches relationship

  1. New Tables
    - `position_branches`
      - `id` (uuid, primary key)
      - `position_id` (uuid, foreign key to positions)
      - `branch_id` (uuid, foreign key to branches)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `position_branches` table
    - Add policies for all operations (matching positions table pattern)

  3. Changes
    - Creates many-to-many relationship between positions and branches
    - Allows restricting staff members to specific branches
*/

CREATE TABLE IF NOT EXISTS position_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(position_id, branch_id)
);

ALTER TABLE position_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on position_branches"
  ON position_branches
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_position_branches_position_id ON position_branches(position_id);
CREATE INDEX IF NOT EXISTS idx_position_branches_branch_id ON position_branches(branch_id);