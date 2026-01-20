/*
  # Make staff_member_id nullable in schedule_shifts
  
  1. Changes
    - Make `staff_member_id` nullable in schedule_shifts table
    - This allows removing employee from a shift when late cancel is approved
  
  2. Purpose
    - Enable late decline workflow where shift is removed from employee
    - Support flexibility in shift management
  
  3. Security
    - No RLS changes needed - existing policies apply
*/

-- Make staff_member_id nullable
DO $$
BEGIN
  ALTER TABLE schedule_shifts 
  ALTER COLUMN staff_member_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN
    NULL; -- Column might already be nullable
END $$;
