/*
  # Add Cabinet Login/Password to Employees

  1. New Columns
    - `cabinet_login` (text, unique per partner) - login for employee cabinet
    - `cabinet_password` (text) - password for employee cabinet
    - `cabinet_slug` (text, unique) - URL slug for employee cabinet

  2. Notes
    - Login is auto-generated from transliterated firstname.lastname
    - If duplicate, suffix -2, -3 etc. is added
    - Slug is used for unique cabinet URL
*/

-- Add cabinet_login column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'cabinet_login'
  ) THEN
    ALTER TABLE employees ADD COLUMN cabinet_login text;
  END IF;
END $$;

-- Add cabinet_password column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'cabinet_password'
  ) THEN
    ALTER TABLE employees ADD COLUMN cabinet_password text;
  END IF;
END $$;

-- Add cabinet_slug column for unique URL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'cabinet_slug'
  ) THEN
    ALTER TABLE employees ADD COLUMN cabinet_slug text UNIQUE;
  END IF;
END $$;

-- Add unique constraint on login per partner
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'employees_partner_login_unique'
    AND table_name = 'employees'
  ) THEN
    ALTER TABLE employees ADD CONSTRAINT employees_partner_login_unique UNIQUE (partner_id, cabinet_login);
  END IF;
END $$;

-- Add index for login lookups
CREATE INDEX IF NOT EXISTS idx_employees_cabinet_login ON employees(partner_id, cabinet_login);
CREATE INDEX IF NOT EXISTS idx_employees_cabinet_slug ON employees(cabinet_slug);

-- Also add employee cabinet settings to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'employee_cabinet_url'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN employee_cabinet_url text DEFAULT 'https://restopresto.org/employee';
  END IF;
END $$;
