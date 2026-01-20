/*
  # Fix Shifts RLS Policies

  ## Changes
  - Drop existing RLS policies for shifts table
  - Recreate correct policies with proper SQL logic
  - Fix INSERT policy to correctly validate partner_id
  - Fix UPDATE policy to correctly validate partner_id

  ## Security
  - Authenticated users can only manage shifts for their own partner
  - Anonymous users can only view open shifts
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can create shifts for their partner" ON shifts;
DROP POLICY IF EXISTS "Authenticated users can update shifts for their partner" ON shifts;
DROP POLICY IF EXISTS "Authenticated users can view shifts for their partner" ON shifts;
DROP POLICY IF EXISTS "Anonymous users can view open shifts" ON shifts;

-- Policy: Authenticated users can view shifts for their partner
CREATE POLICY "Authenticated users can view shifts for their partner"
  ON shifts
  FOR SELECT
  TO authenticated
  USING (
    partner_id = (
      SELECT partner_id FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- Policy: Authenticated users can create shifts for their partner
CREATE POLICY "Authenticated users can create shifts for their partner"
  ON shifts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    partner_id = (
      SELECT partner_id FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- Policy: Authenticated users can update shifts for their partner
CREATE POLICY "Authenticated users can update shifts for their partner"
  ON shifts
  FOR UPDATE
  TO authenticated
  USING (
    partner_id = (
      SELECT partner_id FROM admin_users 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    partner_id = (
      SELECT partner_id FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- Policy: Anonymous users can view open shifts
CREATE POLICY "Anonymous users can view open shifts"
  ON shifts
  FOR SELECT
  TO anon
  USING (status = 'open');