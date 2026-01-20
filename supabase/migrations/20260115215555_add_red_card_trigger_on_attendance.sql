/*
  # Add Red Card Trigger on Attendance Status Change

  1. New Function
    - `issue_red_card_on_attendance()` - Trigger function that issues red cards when:
      - attendance_status changes to 'no_show' or 'late'
      - The employee's position has red_card_enabled = true for the relevant KPI indicator

  2. New Trigger
    - `trigger_issue_red_card_on_attendance` - Fires after update on schedule_shifts

  3. Notes
    - Red cards are issued per-shift, not per-day
    - The trigger checks if red_card_enabled is true for the position/branch combination
*/

CREATE OR REPLACE FUNCTION issue_red_card_on_attendance()
RETURNS TRIGGER AS $$
DECLARE
  v_partner_id uuid;
  v_red_card_enabled boolean := false;
  v_reason text;
BEGIN
  IF NEW.attendance_status IN ('no_show', 'late') AND 
     (OLD.attendance_status IS NULL OR OLD.attendance_status NOT IN ('no_show', 'late') OR OLD.attendance_status != NEW.attendance_status) THEN
    
    v_partner_id := NEW.partner_id;
    
    SELECT kis.red_card_enabled INTO v_red_card_enabled
    FROM kpi_indicator_settings kis
    JOIN kpi_template_indicators kti ON kis.template_indicator_id = kti.id
    JOIN kpi_template_sections kts ON kti.section_id = kts.id
    JOIN kpi_templates kt ON kts.template_id = kt.id
    WHERE kt.partner_id = v_partner_id
      AND kt.branch_id = NEW.branch_id
      AND kt.position_id = NEW.position_id
      AND kti.indicator_key = 'punctuality'
      AND kis.red_card_enabled = true
    LIMIT 1;
    
    IF v_red_card_enabled THEN
      IF NEW.attendance_status = 'no_show' THEN
        v_reason := 'Не выход на смену ' || NEW.date::text;
      ELSE
        v_reason := 'Опоздание на смену ' || NEW.date::text || ' (' || COALESCE(NEW.late_minutes, 0) || ' мин.)';
      END IF;
      
      INSERT INTO employee_red_cards (partner_id, employee_id, indicator_key, reason, shift_id, issued_at)
      VALUES (v_partner_id, NEW.staff_member_id, 'punctuality', v_reason, NEW.id, now())
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_issue_red_card_on_attendance ON schedule_shifts;

CREATE TRIGGER trigger_issue_red_card_on_attendance
  AFTER UPDATE ON schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION issue_red_card_on_attendance();

ALTER TABLE employee_red_cards ADD CONSTRAINT unique_red_card_per_shift 
  UNIQUE (employee_id, shift_id) DEFERRABLE INITIALLY DEFERRED;
