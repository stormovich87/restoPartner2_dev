/*
  # Set Pending Confirmation Status for Existing Shifts
  
  This migration updates existing shifts that don't have a confirmation_status
  to set them as 'pending' so employees can confirm them.

  ## Changes
  - Sets confirmation_status = 'pending' for all shifts where:
    - confirmation_status IS NULL
    - OR confirmation_status = 'not_required'
  - Only affects shifts with assigned employees (staff_member_id IS NOT NULL)
  - Only affects future shifts (date >= current date)
*/

UPDATE schedule_shifts
SET confirmation_status = 'pending'
WHERE staff_member_id IS NOT NULL
  AND date >= CURRENT_DATE
  AND (confirmation_status IS NULL OR confirmation_status = 'not_required');
