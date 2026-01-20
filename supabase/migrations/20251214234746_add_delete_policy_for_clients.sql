/*
  # Add DELETE policy for clients table

  1. Changes
    - Add DELETE policy for anon role to allow deleting clients
    - Add DELETE policy for authenticated role to allow deleting clients
  
  2. Security
    - Allows deletion of client records
    - Maintains existing RLS security model
*/

-- Add DELETE policy for anon role
DROP POLICY IF EXISTS "Anon can delete clients" ON clients;
CREATE POLICY "Anon can delete clients"
  ON clients
  FOR DELETE
  TO anon
  USING (true);

-- Add DELETE policy for authenticated role
DROP POLICY IF EXISTS "Authenticated can delete clients" ON clients;
CREATE POLICY "Authenticated can delete clients"
  ON clients
  FOR DELETE
  TO authenticated
  USING (true);
