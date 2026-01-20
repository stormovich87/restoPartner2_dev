/*
  # Reset no-show reason on new no-show event

  1. Changes
    - Add trigger to automatically reset no_show_reason fields when attendance_status is set to 'no_show'
    - This ensures each new no-show event requires a fresh reason selection
    - Resets: no_show_reason_text, no_show_reason_status, no_show_reason_selected_at
    - Preserves historical approval data for audit trail

  2. Security
    - Trigger runs automatically on schedule_shifts updates
    - Only affects no-show reason fields
*/

-- Create function to reset no-show reason when marking as no_show
CREATE OR REPLACE FUNCTION reset_no_show_reason_on_new_no_show()
RETURNS TRIGGER AS $$
BEGIN
  -- If attendance_status is being set to 'no_show' from something else, reset the reason fields
  IF NEW.attendance_status = 'no_show' AND 
     (OLD.attendance_status IS NULL OR OLD.attendance_status != 'no_show') THEN
    
    NEW.no_show_reason_text := NULL;
    NEW.no_show_reason_status := NULL;
    NEW.no_show_reason_selected_at := NULL;
    
    -- Don't reset approval/rejection fields to preserve audit trail
    -- no_show_approved_by, no_show_approved_at, no_show_rejected_by, no_show_rejected_at remain unchanged
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_reset_no_show_reason_on_new_no_show ON schedule_shifts;

-- Create trigger
CREATE TRIGGER trigger_reset_no_show_reason_on_new_no_show
  BEFORE UPDATE ON schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION reset_no_show_reason_on_new_no_show();