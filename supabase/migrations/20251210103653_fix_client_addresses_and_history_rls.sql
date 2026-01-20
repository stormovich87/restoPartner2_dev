/*
  # Fix Client Addresses and History RLS Policies

  ## Overview
  This migration fixes RLS policies for client_addresses and client_orders_history tables.

  ## Changes
    - Simplify policies for client_addresses
    - Simplify policies for client_orders_history
    - Ensure anon and authenticated users have proper access

  ## Security
    - Anon role can create, read, and update client data
    - Service role has full access
    - Policies are simplified for better compatibility
*/

-- Fix client_addresses policies
DROP POLICY IF EXISTS "Service role can manage all client addresses" ON client_addresses;
DROP POLICY IF EXISTS "Authenticated users can view client addresses" ON client_addresses;
DROP POLICY IF EXISTS "Authenticated users can insert client addresses" ON client_addresses;
DROP POLICY IF EXISTS "Authenticated users can update client addresses" ON client_addresses;
DROP POLICY IF EXISTS "Anon users can view client addresses" ON client_addresses;
DROP POLICY IF EXISTS "Anon users can insert client addresses" ON client_addresses;
DROP POLICY IF EXISTS "Anon users can update client addresses" ON client_addresses;

CREATE POLICY "Anon can manage client addresses"
  ON client_addresses
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can manage client addresses"
  ON client_addresses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage client addresses"
  ON client_addresses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix client_orders_history policies
DROP POLICY IF EXISTS "Service role can manage all client order history" ON client_orders_history;
DROP POLICY IF EXISTS "Authenticated users can view client order history" ON client_orders_history;
DROP POLICY IF EXISTS "Authenticated users can insert client order history" ON client_orders_history;
DROP POLICY IF EXISTS "Anon users can view client order history" ON client_orders_history;
DROP POLICY IF EXISTS "Anon users can insert client order history" ON client_orders_history;

CREATE POLICY "Anon can manage client order history"
  ON client_orders_history
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can manage client order history"
  ON client_orders_history
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage client order history"
  ON client_orders_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);