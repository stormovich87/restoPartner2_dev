/*
  # Fix User Branch Access and Client Data Structure

  1. New Tables
    - `user_branch_access`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `partner_id` (uuid, foreign key to partners)
      - `branch_id` (uuid, foreign key to branches)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on `user_branch_access` table
    - Add policy for users to read their own branch access records
    - Users can only see access records where user_id matches auth.uid()
*/

-- Create user_branch_access table
CREATE TABLE IF NOT EXISTS user_branch_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, branch_id)
);

-- Enable RLS
ALTER TABLE user_branch_access ENABLE ROW LEVEL SECURITY;

-- Add policy for authenticated users to read their own branch access
CREATE POLICY "Users can read own branch access"
  ON user_branch_access
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Add policy for authenticated users to manage their own branch access (for admins)
CREATE POLICY "Admins can manage branch access for their partner"
  ON user_branch_access
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.partner_id = user_branch_access.partner_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.partner_id = user_branch_access.partner_id
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_branch_access_user_id 
  ON user_branch_access(user_id);

CREATE INDEX IF NOT EXISTS idx_user_branch_access_partner_id 
  ON user_branch_access(partner_id);

CREATE INDEX IF NOT EXISTS idx_user_branch_access_branch_id 
  ON user_branch_access(branch_id);