/*
  # Grant Permissions to Shifts Table

  ## Changes
  - Grant all necessary permissions to anon and authenticated roles for shifts table
  
  ## Security
  - RLS policies will control access at row level
  - Base table permissions are required for RLS to work
*/

-- Grant permissions to anon role
GRANT SELECT, INSERT, UPDATE, DELETE ON shifts TO anon;

-- Grant permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON shifts TO authenticated;