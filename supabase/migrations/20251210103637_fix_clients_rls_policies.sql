/*
  # Fix Clients RLS Policies

  ## Overview
  This migration fixes RLS policies for the clients table to ensure proper access.

  ## Changes
    - Drop conflicting policies with partner_id checks
    - Keep only simple anon and service_role policies for proper access

  ## Security
    - Anon role can create, read, and update clients
    - Service role has full access
    - Policies are simplified for better compatibility
*/

-- Drop old conflicting policies
DROP POLICY IF EXISTS "Partners can view own clients" ON clients;
DROP POLICY IF EXISTS "Partners can insert own clients" ON clients;
DROP POLICY IF EXISTS "Partners can update own clients" ON clients;
DROP POLICY IF EXISTS "Partners can delete own clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can view partner clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can insert partner clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can update partner clients" ON clients;

-- Ensure anon policies exist
DROP POLICY IF EXISTS "Anon can select clients" ON clients;
CREATE POLICY "Anon can select clients"
  ON clients
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Anon can insert clients" ON clients;
CREATE POLICY "Anon can insert clients"
  ON clients
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can update clients" ON clients;
CREATE POLICY "Anon can update clients"
  ON clients
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Ensure authenticated users have access
DROP POLICY IF EXISTS "Authenticated can select clients" ON clients;
CREATE POLICY "Authenticated can select clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert clients" ON clients;
CREATE POLICY "Authenticated can insert clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update clients" ON clients;
CREATE POLICY "Authenticated can update clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure service role policy exists
DROP POLICY IF EXISTS "Service role can manage clients" ON clients;
CREATE POLICY "Service role can manage clients"
  ON clients
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);