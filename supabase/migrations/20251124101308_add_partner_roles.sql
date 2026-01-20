/*
  # Add Partner Roles

  ## Summary
  Creates additional roles for partner users

  ## New Roles
  1. **partner_admin** - Administrator for a partner organization
     - Full access to partner's data
     - Can manage partner users and branches
  
  2. **partner_manager** - Manager for a partner organization
     - Can view and manage orders
     - Can view reports
     - Cannot manage users
  
  3. **partner_user** - Regular user for a partner organization
     - Can view and create orders
     - Limited access to reports

  ## Notes
  - These roles are created with ON CONFLICT DO NOTHING to allow safe re-running
  - Super admin (founder) role already exists from initial migration
*/

-- Insert partner roles
INSERT INTO roles (name, display_name) VALUES
  ('partner_admin', 'Администратор партнёра'),
  ('partner_manager', 'Менеджер партнёра'),
  ('partner_user', 'Пользователь партнёра')
ON CONFLICT (name) DO NOTHING;