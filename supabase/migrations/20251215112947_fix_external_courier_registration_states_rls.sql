/*
  # Fix External Courier Registration States RLS

  1. Changes
    - Drop existing restrictive policy
    - Add permissive policies for service_role and anon (edge functions use anon by default)
    - Ensure edge functions can read/write registration states

  2. Security
    - Service role has full access
    - Anon role has full access (needed for edge functions)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Service role has full access to registration states" ON external_courier_registration_states;

-- Allow service_role full access
CREATE POLICY "Service role full access"
  ON external_courier_registration_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anon role full access (edge functions)
CREATE POLICY "Anon role full access for edge functions"
  ON external_courier_registration_states
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Grant permissions to anon role
GRANT ALL ON external_courier_registration_states TO anon;
GRANT ALL ON external_courier_registration_states TO service_role;
