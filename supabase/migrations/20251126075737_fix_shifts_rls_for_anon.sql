/*
  # Fix Shifts RLS Policies for Anonymous Users

  ## Changes
  - Add policies for anonymous users to manage shifts
  - Allow anon role to create, update, and view shifts

  ## Security
  - Anonymous users can manage shifts for any partner (since this is partner's own interface)
  - This matches the pattern used for orders and other tables
*/

-- Policy: Anonymous users can view all shifts
DROP POLICY IF EXISTS "Anonymous users can view open shifts" ON shifts;

CREATE POLICY "Anonymous users can view all shifts"
  ON shifts
  FOR SELECT
  TO anon
  USING (true);

-- Policy: Anonymous users can create shifts
CREATE POLICY "Anonymous users can create shifts"
  ON shifts
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Anonymous users can update shifts
CREATE POLICY "Anonymous users can update shifts"
  ON shifts
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);