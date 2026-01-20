/*
  # Fix positions RLS policies

  1. Changes
    - Drop existing ALL policy
    - Create separate policies for SELECT, INSERT, UPDATE, DELETE operations
    - This ensures proper permissions for all operations

  2. Security
    - Maintains same access level but with explicit policies
    - Allows anon and authenticated users to perform all operations
*/

DROP POLICY IF EXISTS "Allow all operations on positions" ON positions;

CREATE POLICY "Users can view positions"
  ON positions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert positions"
  ON positions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update positions"
  ON positions
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete positions"
  ON positions
  FOR DELETE
  TO anon, authenticated
  USING (true);