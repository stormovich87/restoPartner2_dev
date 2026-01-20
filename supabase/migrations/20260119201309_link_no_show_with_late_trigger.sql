/*
  # Link No-Show with Late Trigger for KPI

  ## Summary
  When an employee has a no-show (прогул), automatically mark them as late (опоздание)
  for the same day. This ensures that both KPI indicators (Прогулы and Опоздания)
  are triggered when there's a no-show.

  ## Changes
  1. Create trigger function that sets `late_minutes` to a high value (9999) when
     `attendance_status` is changed to 'no_show'
  2. This ensures that both 'no_show' and 'late' triggers are counted in KPI calculations

  ## Why 9999 minutes?
  - Makes it clear this is an exceptional value (not real lateness)
  - Ensures the trigger for "Опоздания" indicator fires
  - Can be easily identified and filtered if needed

  ## Implementation Notes
  - Trigger runs BEFORE UPDATE to ensure value is set before KPI calculation
  - Only sets late_minutes if attendance_status changes TO 'no_show'
  - Does not affect existing late_minutes values when reverting no_show status
*/

-- Create function to link no_show with late trigger
CREATE OR REPLACE FUNCTION link_no_show_with_late()
RETURNS TRIGGER AS $$
BEGIN
  -- If attendance_status is being changed to 'no_show', set late_minutes to 9999
  IF NEW.attendance_status = 'no_show' AND (OLD.attendance_status IS NULL OR OLD.attendance_status != 'no_show') THEN
    NEW.late_minutes := 9999;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_link_no_show_with_late ON schedule_shifts;
CREATE TRIGGER trigger_link_no_show_with_late
  BEFORE UPDATE ON schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION link_no_show_with_late();

-- Add comment
COMMENT ON FUNCTION link_no_show_with_late() IS 
'Automatically sets late_minutes to 9999 when attendance_status changes to no_show. 
This ensures that both "Прогулы" and "Опоздания" KPI indicators are triggered.';
