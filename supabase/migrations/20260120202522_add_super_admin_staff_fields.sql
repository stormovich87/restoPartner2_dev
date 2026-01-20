/*
  # Add super admin fields to staff_members and positions

  1. New Columns
    - Add `is_super_admin` to staff_members (boolean) - indicates if staff member has super admin access
    - Add `is_hidden` to staff_members (boolean) - to hide from UI listing
    - Add `is_super_admin` to positions (boolean) - super admin role flag
  
  2. Security
    - These fields will be used to identify hidden super admin accounts
*/

DO $$
BEGIN
  -- Add is_super_admin to positions if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'positions' AND column_name = 'is_super_admin'
  ) THEN
    ALTER TABLE positions ADD COLUMN is_super_admin boolean DEFAULT false;
  END IF;

  -- Add is_super_admin to staff_members if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'is_super_admin'
  ) THEN
    ALTER TABLE staff_members ADD COLUMN is_super_admin boolean DEFAULT false;
  END IF;

  -- Add is_hidden to staff_members if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'is_hidden'
  ) THEN
    ALTER TABLE staff_members ADD COLUMN is_hidden boolean DEFAULT false;
  END IF;
END $$;
