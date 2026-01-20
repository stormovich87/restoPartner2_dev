/*
  # Add Last Name and Phone to Admin Users

  ## Changes
  - Add `last_name` column to `admin_users` table to store admin user's last name
  - Add `phone` column to `admin_users` table to store admin user's phone number

  ## Columns Added
  - `last_name` (text) - Admin user's last name
  - `phone` (text) - Admin user's phone number
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN last_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'phone'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN phone text;
  END IF;
END $$;