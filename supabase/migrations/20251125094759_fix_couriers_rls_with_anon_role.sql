/*
  # Fix Couriers RLS - Explicit Anon Role

  ## Summary
  Explicitly grants permissions to the anon role for the couriers table.
  Previous policies used "public" which might not work correctly.

  ## Changes
  - Drop all existing policies
  - Create policies specifically for anon and authenticated roles
  - Ensure INSERT permission is explicitly granted

  ## Security
  - Anon and authenticated users can perform all CRUD operations
  - Application handles partner_id filtering
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow delete access to couriers" ON couriers;
DROP POLICY IF EXISTS "Allow insert access to couriers" ON couriers;
DROP POLICY IF EXISTS "Allow read access to couriers" ON couriers;
DROP POLICY IF EXISTS "Allow update access to couriers" ON couriers;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant permissions on table
GRANT ALL ON TABLE couriers TO anon, authenticated;

-- Grant usage on sequence for id generation
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Create policies for SELECT
CREATE POLICY "anon_select_couriers"
  ON couriers FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create policies for INSERT
CREATE POLICY "anon_insert_couriers"
  ON couriers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Create policies for UPDATE
CREATE POLICY "anon_update_couriers"
  ON couriers FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for DELETE
CREATE POLICY "anon_delete_couriers"
  ON couriers FOR DELETE
  TO anon, authenticated
  USING (true);
