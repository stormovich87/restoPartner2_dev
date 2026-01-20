/*
  # Grant permissions to position-related tables

  1. Changes
    - Grant permissions to position_permissions table
    - Grant permissions to position_branches table
    - Grant permissions to staff_members table
    - This ensures all position-related operations work correctly

  2. Security
    - RLS policies control what data users can access
    - Base table permissions enable operations
*/

-- Grant permissions to position_permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON position_permissions TO anon, authenticated;

-- Grant permissions to position_branches
GRANT SELECT, INSERT, UPDATE, DELETE ON position_branches TO anon, authenticated;

-- Grant permissions to staff_members if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'staff_members'
  ) THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON staff_members TO anon, authenticated;
  END IF;
END $$;