/*
  # Admin Users and Permissions System

  ## Overview
  This migration adds a comprehensive system for managing admin users who can access the partner management panel.

  ## New Tables
  
  ### `admin_users`
  Stores admin users with login credentials and metadata
  - `id` (uuid, primary key) - Unique identifier
  - `login` (text, unique, not null) - Username for login
  - `password_hash` (text, not null) - Hashed password
  - `name` (text) - Display name of admin user
  - `is_super_admin` (boolean, default false) - Super admin flag (login=1, password=1)
  - `active` (boolean, default true) - Account active status
  - `created_at` (timestamptz, default now()) - Creation timestamp
  - `updated_at` (timestamptz, default now()) - Last update timestamp

  ### `admin_permissions`
  Defines granular permissions for each admin user
  - `id` (uuid, primary key) - Unique identifier
  - `admin_user_id` (uuid, foreign key) - References admin_users.id
  - `can_pause_partners` (boolean, default false) - Can pause/unpause partners
  - `can_delete_partners` (boolean, default false) - Can delete partners
  - `can_create_partners` (boolean, default false) - Can create new partners
  - `can_edit_partners` (boolean, default false) - Can edit partner details
  - `access_all_partners` (boolean, default true) - Access to all partners or specific ones
  - `created_at` (timestamptz, default now()) - Creation timestamp
  - `updated_at` (timestamptz, default now()) - Last update timestamp

  ### `admin_partner_access`
  Junction table for specific partner access when access_all_partners is false
  - `id` (uuid, primary key) - Unique identifier
  - `admin_user_id` (uuid, foreign key) - References admin_users.id
  - `partner_id` (uuid, foreign key) - References partners.id
  - `created_at` (timestamptz, default now()) - Creation timestamp

  ## Initial Data
  Creates the default super admin user (login: 1, password: 1) with full permissions

  ## Security
  - RLS enabled on all new tables
  - Policies restrict access to authenticated users only
  - Super admin cannot be deleted or edited (enforced by application logic)
*/

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text,
  is_super_admin boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create admin_permissions table
CREATE TABLE IF NOT EXISTS admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE NOT NULL,
  can_pause_partners boolean DEFAULT false,
  can_delete_partners boolean DEFAULT false,
  can_create_partners boolean DEFAULT false,
  can_edit_partners boolean DEFAULT false,
  access_all_partners boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(admin_user_id)
);

-- Create admin_partner_access junction table
CREATE TABLE IF NOT EXISTS admin_partner_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE NOT NULL,
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(admin_user_id, partner_id)
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_partner_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_users
CREATE POLICY "Admin users can view all admin users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can insert new admin users"
  ON admin_users FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin users can update admin users"
  ON admin_users FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin users can delete admin users"
  ON admin_users FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for admin_permissions
CREATE POLICY "Admin users can view all permissions"
  ON admin_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can insert permissions"
  ON admin_permissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin users can update permissions"
  ON admin_permissions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin users can delete permissions"
  ON admin_permissions FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for admin_partner_access
CREATE POLICY "Admin users can view partner access"
  ON admin_partner_access FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can insert partner access"
  ON admin_partner_access FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin users can delete partner access"
  ON admin_partner_access FOR DELETE
  TO authenticated
  USING (true);

-- Insert default super admin user
DO $$
DECLARE
  v_super_admin_id uuid;
BEGIN
  -- Check if super admin already exists
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE login = '1') THEN
    -- Insert super admin
    INSERT INTO admin_users (login, password_hash, name, is_super_admin, active)
    VALUES ('1', '1', 'Super Admin', true, true)
    RETURNING id INTO v_super_admin_id;
    
    -- Insert full permissions for super admin
    INSERT INTO admin_permissions (
      admin_user_id,
      can_pause_partners,
      can_delete_partners,
      can_create_partners,
      can_edit_partners,
      access_all_partners
    )
    VALUES (
      v_super_admin_id,
      true,
      true,
      true,
      true,
      true
    );
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_users_login ON admin_users(login);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_admin_user_id ON admin_permissions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_partner_access_admin_user_id ON admin_partner_access(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_partner_access_partner_id ON admin_partner_access(partner_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_permissions_updated_at ON admin_permissions;
CREATE TRIGGER update_admin_permissions_updated_at
  BEFORE UPDATE ON admin_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();