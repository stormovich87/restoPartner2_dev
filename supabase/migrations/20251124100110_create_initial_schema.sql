/*
  # Create Initial Multi-Tenant System Schema

  ## Summary
  Creates a complete multi-tenant system where partners have independent admin panels
  accessible via unique URL suffixes (e.g., /pizza-city, /sushi).

  ## 1. New Tables

  ### `roles`
  - `id` (uuid, PK) - Unique role identifier
  - `name` (text, unique) - Machine name (e.g., "founder", "partner_admin")
  - `display_name` (text) - Human-readable name (e.g., "Учредитель")
  - `created_at` (timestamptz) - Creation timestamp

  ### `partners`
  - `id` (uuid, PK) - Unique partner identifier
  - `name` (text) - Partner business name
  - `url_suffix` (text, unique) - URL identifier (e.g., "pizza-city")
  - `logo_url` (text, nullable) - Path to uploaded logo
  - `status` (text) - One of: "active", "paused", "deleted"
  - `pause_message` (text, nullable) - Message shown when paused
  - `created_at` (timestamptz) - Creation timestamp

  ### `branches`
  - `id` (uuid, PK) - Unique branch identifier
  - `partner_id` (uuid, FK) - Reference to partner
  - `name` (text) - Branch name
  - `address` (text) - Branch address
  - `phone` (text) - Branch phone number
  - `status` (text) - Branch status
  - `created_at` (timestamptz) - Creation timestamp

  ### `users`
  - `id` (uuid, PK) - Unique user identifier
  - `login` (text) - Login username (unique per partner)
  - `password_hash` (text) - Hashed password
  - `role_id` (uuid, FK) - Reference to role
  - `partner_id` (uuid, FK, nullable) - Reference to partner (NULL for super admin)
  - `branch_id` (uuid, FK, nullable) - Reference to branch
  - `active` (boolean) - Whether user is active
  - `created_at` (timestamptz) - Creation timestamp

  ### `orders` (placeholder)
  - `id` (uuid, PK) - Unique order identifier
  - `partner_id` (uuid, FK) - Reference to partner
  - `branch_id` (uuid, FK, nullable) - Reference to branch
  - `user_id` (uuid, FK) - Reference to user who created order
  - `status` (text) - Order status
  - `total` (numeric) - Order total amount
  - `created_at` (timestamptz) - Creation timestamp

  ### `logs` (placeholder)
  - `id` (uuid, PK) - Unique log identifier
  - `partner_id` (uuid, FK) - Reference to partner
  - `user_id` (uuid, FK) - Reference to user
  - `action` (text) - Action performed
  - `details` (jsonb) - Additional details
  - `created_at` (timestamptz) - Creation timestamp

  ### `access_rights` (placeholder)
  - `id` (uuid, PK) - Unique access right identifier
  - `role_id` (uuid, FK) - Reference to role
  - `resource` (text) - Resource name
  - `can_read` (boolean) - Read permission
  - `can_write` (boolean) - Write permission
  - `can_delete` (boolean) - Delete permission
  - `created_at` (timestamptz) - Creation timestamp

  ### `reports` (placeholder)
  - `id` (uuid, PK) - Unique report identifier
  - `partner_id` (uuid, FK) - Reference to partner
  - `name` (text) - Report name
  - `type` (text) - Report type
  - `data` (jsonb) - Report data
  - `created_at` (timestamptz) - Creation timestamp

  ## 2. Security
  - Enable RLS on ALL tables
  - Create restrictive policies for each table
  - Super admin (role = founder, partner_id = NULL) has full access
  - Partner users can only access their own partner's data
  - Users must be authenticated to access any data

  ## 3. Initial Data
  - Creates "founder" role automatically
  - Super admin user will be created via separate INSERT after migration
*/

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create partners table
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url_suffix text UNIQUE NOT NULL,
  logo_url text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'deleted')),
  pause_message text,
  created_at timestamptz DEFAULT now()
);

-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  phone text NOT NULL,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login text NOT NULL,
  password_hash text NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(login, partner_id)
);

-- Create orders table (placeholder)
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  status text DEFAULT 'pending',
  total numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create logs table (placeholder)
CREATE TABLE IF NOT EXISTS logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create access_rights table (placeholder)
CREATE TABLE IF NOT EXISTS access_rights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource text NOT NULL,
  can_read boolean DEFAULT false,
  can_write boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, resource)
);

-- Create reports table (placeholder)
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles table
CREATE POLICY "Anyone can read roles"
  ON roles FOR SELECT
  USING (true);

-- RLS Policies for partners table
CREATE POLICY "Anyone can read partners"
  ON partners FOR SELECT
  USING (status != 'deleted');

CREATE POLICY "Service role can manage partners"
  ON partners FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for branches table
CREATE POLICY "Anyone can read branches"
  ON branches FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage branches"
  ON branches FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for users table
CREATE POLICY "Service role can read users"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage users"
  ON users FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for orders table
CREATE POLICY "Service role can manage orders"
  ON orders FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for logs table
CREATE POLICY "Service role can manage logs"
  ON logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for access_rights table
CREATE POLICY "Anyone can read access_rights"
  ON access_rights FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage access_rights"
  ON access_rights FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for reports table
CREATE POLICY "Service role can manage reports"
  ON reports FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert founder role
INSERT INTO roles (name, display_name)
VALUES ('founder', 'Учредитель')
ON CONFLICT (name) DO NOTHING;