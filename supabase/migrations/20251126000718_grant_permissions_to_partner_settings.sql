/*
  # Grant permissions to partner_settings table

  ## Overview
  This migration grants necessary permissions to the partner_settings table for anon, authenticated, and service_role users.

  ## Changes
    - Grant ALL privileges on `partner_settings` to anon role
    - Grant ALL privileges on `partner_settings` to authenticated role
    - Grant ALL privileges on `partner_settings` to service_role

  ## Security
    - These grants work in conjunction with existing RLS policies
    - RLS policies still control which rows users can access
    - Without these grants, users cannot access the table at all

  ## Important Notes
    1. GRANT statements provide table-level access
    2. RLS policies provide row-level access control
    3. Both are required for users to interact with the table
*/

-- Grant permissions to anon role
GRANT ALL ON partner_settings TO anon;

-- Grant permissions to authenticated role
GRANT ALL ON partner_settings TO authenticated;

-- Grant permissions to service_role
GRANT ALL ON partner_settings TO service_role;