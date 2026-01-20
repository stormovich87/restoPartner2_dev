/*
  # Grant permissions to executors tables

  1. Changes
    - Grant all permissions on executors table to anon and authenticated roles
    - Grant all permissions on order_executors table to anon and authenticated roles
    - This ensures full access to these tables
*/

-- Grant permissions on executors table
GRANT ALL ON executors TO anon, authenticated;
GRANT ALL ON order_executors TO anon, authenticated;