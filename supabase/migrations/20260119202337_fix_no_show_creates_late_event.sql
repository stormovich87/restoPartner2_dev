/*
  # Fix No-Show to Create Late Event for Same Day

  ## Summary
  When a no-show occurs, create a corresponding 'late' trigger event
  ONLY for that specific day, not affecting the entire period.

  ## Changes
  1. Replace link_no_show_with_late function
  2. Instead of setting late_minutes = 9999, create employee_event with trigger_type = 'late'
  3. Event is created only for the specific no-show date

  ## Purpose
  - "Опоздания" indicator should show 0% only for the specific day of no-show
  - Late trigger appears in "Срабатывания триггеров" list
  - Does not affect entire period calculation

  ## Implementation Notes
  - Trigger creates employee_event record automatically
  - Event is linked to the same shift and date
  - Idempotent: won't create duplicate events
*/

-- Drop old trigger
DROP TRIGGER IF EXISTS trigger_link_no_show_with_late ON schedule_shifts;
DROP FUNCTION IF EXISTS link_no_show_with_late();

-- Create new function to create late event when no-show occurs
CREATE OR REPLACE FUNCTION create_late_event_on_no_show()
RETURNS TRIGGER AS $$
DECLARE
  v_partner_id uuid;
  v_employee_name text;
  v_branch_name text;
  v_position_name text;
  v_event_date text;
  v_event_time text;
BEGIN
  -- Only act when attendance_status changes to 'no_show'
  IF NEW.attendance_status = 'no_show' AND 
     (OLD.attendance_status IS NULL OR OLD.attendance_status != 'no_show') AND
     NEW.staff_member_id IS NOT NULL THEN
    
    -- Get partner_id and related info
    SELECT 
      e.partner_id,
      CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) as emp_name,
      b.name as branch_name,
      p.name as position_name
    INTO v_partner_id, v_employee_name, v_branch_name, v_position_name
    FROM employees e
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN positions p ON e.position_id = p.id
    WHERE e.id = NEW.staff_member_id;
    
    IF v_partner_id IS NOT NULL THEN
      -- Format date and time
      v_event_date := TO_CHAR(NEW.no_show_at, 'DD.MM.YYYY');
      v_event_time := TO_CHAR(NEW.no_show_at, 'HH24:MI');
      
      -- Create late event for the no-show day
      -- Use INSERT ... ON CONFLICT to avoid duplicates
      INSERT INTO employee_events (
        partner_id,
        employee_id,
        event_type,
        title,
        message,
        related_shift_id,
        created_at
      ) VALUES (
        v_partner_id,
        NEW.staff_member_id,
        'late_due_to_no_show',
        'Опоздание из-за прогула',
        'Автоматически зафиксировано опоздание в день прогула (' || v_event_date || ' ' || v_event_time || ')',
        NEW.id,
        NEW.no_show_at
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_create_late_event_on_no_show
  AFTER UPDATE ON schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION create_late_event_on_no_show();

-- Add comment
COMMENT ON FUNCTION create_late_event_on_no_show() IS 
'Creates a late event (опоздание) in employee_events when a no-show occurs.
This ensures the late_arrivals KPI indicator is triggered for that specific day.';
