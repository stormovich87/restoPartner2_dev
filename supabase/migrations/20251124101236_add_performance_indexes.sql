/*
  # Add Performance Indexes

  ## Summary
  Creates indexes on frequently queried columns to improve database performance

  ## Indexes Created

  1. **partners table**
     - Index on `url_suffix` for fast lookup by URL
     - Index on `status` for filtering active/paused partners

  2. **users table**
     - Index on `login` for authentication queries
     - Index on `partner_id` for filtering partner users
     - Index on `role_id` for role-based queries
     - Composite index on `(login, partner_id)` for unique constraint performance

  3. **branches table**
     - Index on `partner_id` for partner-branch lookups
     - Index on `status` for filtering active branches

  4. **orders table**
     - Index on `partner_id` for partner order filtering
     - Index on `user_id` for user order history
     - Index on `status` for filtering orders by status
     - Index on `created_at` for date-based queries

  5. **logs table**
     - Index on `partner_id` for partner log filtering
     - Index on `user_id` for user activity tracking
     - Index on `created_at` for time-based log queries

  6. **access_rights table**
     - Index on `role_id` for permission checks

  7. **reports table**
     - Index on `partner_id` for partner report filtering
     - Index on `type` for filtering by report type
*/

-- Partners table indexes
CREATE INDEX IF NOT EXISTS idx_partners_url_suffix ON partners(url_suffix);
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);
CREATE INDEX IF NOT EXISTS idx_users_partner_id ON users(partner_id);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_login_partner ON users(login, partner_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active) WHERE active = true;

-- Branches table indexes
CREATE INDEX IF NOT EXISTS idx_branches_partner_id ON branches(partner_id);
CREATE INDEX IF NOT EXISTS idx_branches_status ON branches(status);

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_partner_id ON orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_partner_created ON orders(partner_id, created_at DESC);

-- Logs table indexes
CREATE INDEX IF NOT EXISTS idx_logs_partner_id ON logs(partner_id);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_partner_created ON logs(partner_id, created_at DESC);

-- Access rights table indexes
CREATE INDEX IF NOT EXISTS idx_access_rights_role_id ON access_rights(role_id);

-- Reports table indexes
CREATE INDEX IF NOT EXISTS idx_reports_partner_id ON reports(partner_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_partner_type ON reports(partner_id, type);