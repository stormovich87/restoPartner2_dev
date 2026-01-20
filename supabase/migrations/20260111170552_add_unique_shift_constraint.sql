/*
  # Add unique constraint for shifts

  1. Changes
    - Adds unique constraint to prevent duplicate shifts for the same employee
      in the same branch on the same date
    - This ensures only one shift per employee per branch per day

  2. Notes
    - Uses a unique index instead of constraint for better error handling
    - First removes any duplicate shifts keeping only the most recent one
*/

DO $$
DECLARE
  duplicate_record RECORD;
BEGIN
  FOR duplicate_record IN
    SELECT 
      staff_member_id,
      branch_id,
      date,
      array_agg(id ORDER BY updated_at DESC, created_at DESC) as shift_ids
    FROM schedule_shifts
    GROUP BY staff_member_id, branch_id, date
    HAVING COUNT(*) > 1
  LOOP
    DELETE FROM schedule_shifts 
    WHERE id = ANY(duplicate_record.shift_ids[2:]);
  END LOOP;
END $$;

DROP INDEX IF EXISTS idx_unique_shift_per_employee_branch_date;

CREATE UNIQUE INDEX idx_unique_shift_per_employee_branch_date 
ON schedule_shifts (staff_member_id, branch_id, date);
