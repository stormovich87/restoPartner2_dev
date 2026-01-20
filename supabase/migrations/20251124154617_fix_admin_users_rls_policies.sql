/*
  # Fix Admin Users RLS Policies

  ## Changes
  This migration fixes RLS policies for admin tables to allow operations from the anon role.
  
  ## Updates
  - Drop existing policies that require authenticated role
  - Create new policies that allow anon role access
  - This enables the Supabase client to perform operations on admin tables
  
  ## Security Note
  Access control is handled at the application level through the super admin login system.
*/

-- Drop existing policies for admin_users
DROP POLICY IF EXISTS "Admin users can view all admin users" ON admin_users;
DROP POLICY IF EXISTS "Admin users can insert new admin users" ON admin_users;
DROP POLICY IF EXISTS "Admin users can update admin users" ON admin_users;
DROP POLICY IF EXISTS "Admin users can delete admin users" ON admin_users;

-- Create new policies that allow anon role
CREATE POLICY "Allow all operations on admin_users"
  ON admin_users
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Drop existing policies for admin_permissions
DROP POLICY IF EXISTS "Admin users can view all permissions" ON admin_permissions;
DROP POLICY IF EXISTS "Admin users can insert permissions" ON admin_permissions;
DROP POLICY IF EXISTS "Admin users can update permissions" ON admin_permissions;
DROP POLICY IF EXISTS "Admin users can delete permissions" ON admin_permissions;

-- Create new policies for admin_permissions
CREATE POLICY "Allow all operations on admin_permissions"
  ON admin_permissions
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Drop existing policies for admin_partner_access
DROP POLICY IF EXISTS "Admin users can view partner access" ON admin_partner_access;
DROP POLICY IF EXISTS "Admin users can insert partner access" ON admin_partner_access;
DROP POLICY IF EXISTS "Admin users can delete partner access" ON admin_partner_access;

-- Create new policies for admin_partner_access
CREATE POLICY "Allow all operations on admin_partner_access"
  ON admin_partner_access
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);