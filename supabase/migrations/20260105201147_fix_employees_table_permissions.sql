/*
  # Fix permissions for employees table

  1. Changes
    - Grant all permissions on employees table to anon, authenticated, and service_role
    - Grant all permissions on employment_history table to anon, authenticated, and service_role
  
  2. Notes
    - Required for edge functions using service_role key to insert/update employees
*/

-- Grant permissions on employees table
GRANT ALL ON employees TO anon;
GRANT ALL ON employees TO authenticated;
GRANT ALL ON employees TO service_role;

-- Grant permissions on employment_history table
GRANT ALL ON employment_history TO anon;
GRANT ALL ON employment_history TO authenticated;
GRANT ALL ON employment_history TO service_role;
