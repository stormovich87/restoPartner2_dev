/*
  # Add Positions and Staff Management System

  1. New Tables
    - `positions`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, foreign key to partners)
      - `name` (text) - position name
      - `can_delete_orders` (boolean) - permission to delete orders
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `position_permissions`
      - `id` (uuid, primary key)
      - `position_id` (uuid, foreign key to positions)
      - `section` (text) - section identifier (orders, branches, couriers, etc.)
      - `created_at` (timestamptz)
    
    - `staff_members`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, foreign key to partners)
      - `position_id` (uuid, foreign key to positions)
      - `first_name` (text)
      - `last_name` (text)
      - `phone` (text)
      - `telegram_user_id` (text, nullable)
      - `telegram_username` (text, nullable)
      - `login` (text, unique)
      - `password_hash` (text)
      - `is_active` (boolean) - true = working, false = fired
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated and anonymous users
*/

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  can_delete_orders boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on positions"
  ON positions FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Create position_permissions table
CREATE TABLE IF NOT EXISTS position_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  section text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(position_id, section)
);

ALTER TABLE position_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on position_permissions"
  ON position_permissions FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Create staff_members table
CREATE TABLE IF NOT EXISTS staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  telegram_user_id text,
  telegram_username text,
  login text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on staff_members"
  ON staff_members FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_positions_partner_id ON positions(partner_id);
CREATE INDEX IF NOT EXISTS idx_position_permissions_position_id ON position_permissions(position_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_partner_id ON staff_members(partner_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_position_id ON staff_members(position_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_login ON staff_members(login);
CREATE INDEX IF NOT EXISTS idx_staff_members_is_active ON staff_members(is_active);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE positions;
ALTER PUBLICATION supabase_realtime ADD TABLE position_permissions;
ALTER PUBLICATION supabase_realtime ADD TABLE staff_members;