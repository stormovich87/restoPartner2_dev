/*
  # Add No-Show Cleanup Triggers

  1. Changes
    - Add trigger to delete employee_events when no_show reason is approved
    - Add trigger to reset no_show when shift start_time is changed
    - Clean up orphaned no_show events without related shifts

  2. Security
    - Triggers run with SECURITY DEFINER to ensure proper permissions
*/

-- Delete orphaned no_show events (no related_shift_id)
DELETE FROM employee_events 
WHERE event_type = 'no_show' 
AND related_shift_id IS NULL;

-- Function to delete no_show employee_events when reason is approved
CREATE OR REPLACE FUNCTION delete_no_show_event_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.no_show_reason_status = 'approved' AND 
     (OLD.no_show_reason_status IS NULL OR OLD.no_show_reason_status != 'approved') THEN
    DELETE FROM employee_events 
    WHERE related_shift_id = NEW.id 
    AND event_type = 'no_show';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_delete_no_show_on_approval ON schedule_shifts;
CREATE TRIGGER trigger_delete_no_show_on_approval
  AFTER UPDATE OF no_show_reason_status ON schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION delete_no_show_event_on_approval();

-- Function to reset no_show when shift start_time is changed
CREATE OR REPLACE FUNCTION reset_no_show_on_time_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.start_time IS DISTINCT FROM NEW.start_time AND 
     OLD.no_show_at IS NOT NULL AND
     NEW.attendance_status = 'no_show' THEN
    NEW.no_show_at := NULL;
    NEW.no_show_reason_status := NULL;
    NEW.no_show_reason_text := NULL;
    NEW.no_show_reason_selected_at := NULL;
    NEW.no_show_approved_by := NULL;
    NEW.no_show_approved_at := NULL;
    NEW.no_show_rejected_by := NULL;
    NEW.no_show_rejected_at := NULL;
    NEW.attendance_status := 'scheduled';
    
    DELETE FROM employee_events 
    WHERE related_shift_id = NEW.id 
    AND event_type IN ('no_show', 'no_show_alert', 'no_show_approved', 'no_show_rejected');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one  
DROP TRIGGER IF EXISTS trigger_reset_no_show_on_time_change ON schedule_shifts;
CREATE TRIGGER trigger_reset_no_show_on_time_change
  BEFORE UPDATE OF start_time ON schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION reset_no_show_on_time_change();
