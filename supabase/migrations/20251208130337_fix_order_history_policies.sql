/*
  # Fix Order History RLS Policies

  1. Changes
    - Add INSERT policy for anon role to allow creating history records
    - Update SELECT policy to check both orders and archived_orders tables
    - Ensure order_history can be created from frontend
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Service role can insert order history" ON order_history;
DROP POLICY IF EXISTS "Anon can view order history" ON order_history;
DROP POLICY IF EXISTS "Users can view order history for their partner" ON order_history;

-- Allow anon to insert order history
CREATE POLICY "Anon can insert order history"
  ON order_history FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to view all order history
CREATE POLICY "Anon can view order history"
  ON order_history FOR SELECT
  TO anon
  USING (true);

-- Allow authenticated users to view their partner's order history
CREATE POLICY "Users can view order history for their partner"
  ON order_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN branches b ON o.branch_id = b.id
      JOIN admin_partner_access apa ON apa.partner_id = b.partner_id
      WHERE o.id = order_history.order_id
      AND apa.admin_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM archived_orders ao
      JOIN branches b ON ao.branch_id = b.id
      JOIN admin_partner_access apa ON apa.partner_id = b.partner_id
      WHERE ao.id = order_history.order_id
      AND apa.admin_user_id = auth.uid()
    )
  );

-- Allow authenticated users to insert order history
CREATE POLICY "Users can insert order history"
  ON order_history FOR INSERT
  TO authenticated
  WITH CHECK (true);
