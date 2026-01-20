/*
  # Fix work_segments table permissions

  1. Changes
    - Grant SELECT, INSERT, UPDATE permissions to anon role
    - Grant SELECT, INSERT, UPDATE permissions to authenticated role
    - Grant ALL permissions to service_role

  2. Reason
    - RLS policies exist but base table permissions were missing
    - Without GRANT, users get 401 Unauthorized even with RLS policies
*/

GRANT SELECT, INSERT, UPDATE ON work_segments TO anon;
GRANT SELECT, INSERT, UPDATE ON work_segments TO authenticated;
GRANT ALL ON work_segments TO service_role;
