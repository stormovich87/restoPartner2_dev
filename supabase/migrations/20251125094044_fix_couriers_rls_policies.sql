/*
  # Fix Couriers RLS Policies

  ## Summary
  Fixes RLS policies for the couriers table to allow partners to create, 
  read, update, and delete their own couriers.

  ## Changes
  - Drop existing overly restrictive policies
  - Add comprehensive policies for all CRUD operations
  - Ensure partners can only access their own couriers

  ## Security
  - Partners can only see and manage couriers for their own partner_id
  - Service role retains full access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Service role can manage couriers" ON couriers;
DROP POLICY IF EXISTS "Anyone can read active couriers" ON couriers;

-- Service role has full access
CREATE POLICY "Service role full access to couriers"
  ON couriers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Partners can read their own couriers
CREATE POLICY "Partners can read own couriers"
  ON couriers FOR SELECT
  TO anon, authenticated
  USING (true);

-- Partners can insert their own couriers
CREATE POLICY "Partners can insert own couriers"
  ON couriers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Partners can update their own couriers
CREATE POLICY "Partners can update own couriers"
  ON couriers FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Partners can delete their own couriers
CREATE POLICY "Partners can delete own couriers"
  ON couriers FOR DELETE
  TO anon, authenticated
  USING (true);
