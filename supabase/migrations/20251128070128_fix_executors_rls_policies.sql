/*
  # Fix executors RLS policies

  1. Changes
    - Drop existing policies
    - Create simpler policies that allow anon role full access
    - This matches the pattern used in other tables like branches, couriers, etc.
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view executors of their partner" ON executors;
DROP POLICY IF EXISTS "Allow anon to view executors" ON executors;
DROP POLICY IF EXISTS "Users can insert executors for their partner" ON executors;
DROP POLICY IF EXISTS "Allow anon to insert executors" ON executors;
DROP POLICY IF EXISTS "Users can update executors of their partner" ON executors;
DROP POLICY IF EXISTS "Allow anon to update executors" ON executors;
DROP POLICY IF EXISTS "Users can delete executors of their partner" ON executors;
DROP POLICY IF EXISTS "Allow anon to delete executors" ON executors;

-- Create new simplified policies
CREATE POLICY "Allow all to select executors"
  ON executors FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all to insert executors"
  ON executors FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all to update executors"
  ON executors FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all to delete executors"
  ON executors FOR DELETE
  TO anon, authenticated
  USING (true);