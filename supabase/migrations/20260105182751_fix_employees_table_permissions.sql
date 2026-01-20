/*
  # Fix Employees Table Permissions

  1. Changes
    - Grant SELECT, INSERT, UPDATE, DELETE permissions to anon and authenticated roles for employees table
    - Grant SELECT, INSERT, UPDATE permissions to anon and authenticated roles for employment_history table

  2. Security
    - RLS policies are already in place and will filter data appropriately
*/

-- Grant permissions for employees table
GRANT SELECT, INSERT, UPDATE, DELETE ON employees TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON employees TO authenticated;

-- Grant permissions for employment_history table
GRANT SELECT, INSERT, UPDATE ON employment_history TO anon;
GRANT SELECT, INSERT, UPDATE ON employment_history TO authenticated;
