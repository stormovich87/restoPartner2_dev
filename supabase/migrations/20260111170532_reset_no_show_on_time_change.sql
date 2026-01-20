/*
  # Reset no_show status when shift time is changed

  1. Changes
    - Creates trigger function to reset attendance_status, no_show_at and reminder fields
      when shift start_time or end_time is changed
    - Only resets if the shift hasn't actually started yet (no actual_start_at)
    - Only resets if the new start time is in the future

  2. Security
    - No RLS changes needed, this is a data integrity trigger
*/

CREATE OR REPLACE FUNCTION reset_shift_status_on_time_change()
RETURNS TRIGGER AS $$
DECLARE
  partner_timezone TEXT;
  current_partner_time TIMESTAMP;
  new_shift_start TIMESTAMP;
BEGIN
  IF (OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.end_time IS DISTINCT FROM NEW.end_time) THEN
    IF NEW.status = 'scheduled' AND NEW.actual_start_at IS NULL THEN
      SELECT timezone INTO partner_timezone
      FROM partner_settings
      WHERE partner_id = NEW.partner_id;

      IF partner_timezone IS NULL THEN
        partner_timezone := 'UTC';
      END IF;

      current_partner_time := NOW() AT TIME ZONE partner_timezone;
      new_shift_start := (NEW.date || ' ' || NEW.start_time)::TIMESTAMP;

      IF new_shift_start > current_partner_time THEN
        NEW.attendance_status := NULL;
        NEW.no_show_at := NULL;
        NEW.late_minutes := 0;
        NEW.reminder_before_sent_at := NULL;
        NEW.reminder_late_sent_at := NULL;
        NEW.reminder_message_ids := '[]'::jsonb;
        NEW.reminder_chat_id := NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reset_shift_status_on_time_change ON schedule_shifts;

CREATE TRIGGER trigger_reset_shift_status_on_time_change
  BEFORE UPDATE ON schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION reset_shift_status_on_time_change();
