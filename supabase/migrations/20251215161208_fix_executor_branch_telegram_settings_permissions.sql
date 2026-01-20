/*
  # Fix permissions for executor_branch_telegram_settings table

  This migration fixes RLS policies for the executor_branch_telegram_settings table
  to allow proper access for both authenticated and anonymous users.

  1. Security Changes:
    - Drop existing restrictive policies
    - Add new permissive policies matching the executors table pattern
    - Ensure anon role has full access (consistent with other tables)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow anon to view executor_branch_telegram_settings" ON executor_branch_telegram_settings;
DROP POLICY IF EXISTS "Allow anon to insert executor_branch_telegram_settings" ON executor_branch_telegram_settings;
DROP POLICY IF EXISTS "Allow anon to update executor_branch_telegram_settings" ON executor_branch_telegram_settings;
DROP POLICY IF EXISTS "Allow anon to delete executor_branch_telegram_settings" ON executor_branch_telegram_settings;
DROP POLICY IF EXISTS "Users can view executor_branch_telegram_settings" ON executor_branch_telegram_settings;
DROP POLICY IF EXISTS "Users can insert executor_branch_telegram_settings" ON executor_branch_telegram_settings;
DROP POLICY IF EXISTS "Users can update executor_branch_telegram_settings" ON executor_branch_telegram_settings;
DROP POLICY IF EXISTS "Users can delete executor_branch_telegram_settings" ON executor_branch_telegram_settings;

-- Create new permissive policies for anon role
CREATE POLICY "Anon can select executor_branch_telegram_settings"
  ON executor_branch_telegram_settings FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert executor_branch_telegram_settings"
  ON executor_branch_telegram_settings FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update executor_branch_telegram_settings"
  ON executor_branch_telegram_settings FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete executor_branch_telegram_settings"
  ON executor_branch_telegram_settings FOR DELETE
  TO anon
  USING (true);

-- Grant necessary permissions to anon role
GRANT ALL ON executor_branch_telegram_settings TO anon;
GRANT USAGE ON SCHEMA public TO anon;