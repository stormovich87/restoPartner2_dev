/*
  # Fix schedule_rows to reference employees table

  1. Changes
    - Drop foreign key constraint from staff_members
    - Add foreign key constraint to employees
    - This allows schedule_rows to work with the employees HR system
  
  2. Notes
    - Existing staff_member_id column will now reference employees(id)
    - No data migration needed as this is a schema-only change
*/

-- Drop the old foreign key constraint to staff_members
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'schedule_rows_staff_member_id_fkey' 
    AND table_name = 'schedule_rows'
  ) THEN
    ALTER TABLE schedule_rows DROP CONSTRAINT schedule_rows_staff_member_id_fkey;
  END IF;
END $$;

-- Add new foreign key constraint to employees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'schedule_rows_employee_id_fkey' 
    AND table_name = 'schedule_rows'
  ) THEN
    ALTER TABLE schedule_rows 
    ADD CONSTRAINT schedule_rows_employee_id_fkey 
    FOREIGN KEY (staff_member_id) 
    REFERENCES employees(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Also fix schedule_shifts table if it exists with the same issue
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'schedule_shifts_staff_member_id_fkey' 
    AND table_name = 'schedule_shifts'
  ) THEN
    ALTER TABLE schedule_shifts DROP CONSTRAINT schedule_shifts_staff_member_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'schedule_shifts_employee_id_fkey' 
    AND table_name = 'schedule_shifts'
  ) THEN
    ALTER TABLE schedule_shifts 
    ADD CONSTRAINT schedule_shifts_employee_id_fkey 
    FOREIGN KEY (staff_member_id) 
    REFERENCES employees(id) 
    ON DELETE CASCADE;
  END IF;
END $$;