/*
  # Fix shift status reset when time is changed to future

  1. Problem
    - When shift time is changed to a future time, the status should reset to "scheduled"
    - Currently, the trigger only works if status is already "scheduled"
    - This means closed shifts don't get their status reset and reminders don't send

  2. Solution
    - Remove the status check condition
    - If time is changed to future AND shift hasn't actually started, reset to "scheduled"
    - This allows editing closed/opened shifts to reschedule them

  3. Changes
    - Modified condition: removed `NEW.status = 'scheduled'` check
    - Added: reset status to 'scheduled' when time is changed to future
    - Added: reset close_reminder fields as well
*/

CREATE OR REPLACE FUNCTION reset_shift_status_on_time_change()
RETURNS TRIGGER AS $$
DECLARE
  partner_timezone TEXT;
  current_partner_time TIMESTAMP;
  new_shift_start TIMESTAMP;
BEGIN
  IF (OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.end_time IS DISTINCT FROM NEW.end_time) THEN
    IF NEW.actual_start_at IS NULL THEN
      SELECT timezone INTO partner_timezone
      FROM partner_settings
      WHERE partner_id = NEW.partner_id;

      IF partner_timezone IS NULL THEN
        partner_timezone := 'UTC';
      END IF;

      current_partner_time := NOW() AT TIME ZONE partner_timezone;
      new_shift_start := (NEW.date || ' ' || NEW.start_time)::TIMESTAMP;

      IF new_shift_start > current_partner_time THEN
        NEW.status := 'scheduled';
        NEW.attendance_status := NULL;
        NEW.no_show_at := NULL;
        NEW.no_show_notified_at := NULL;
        NEW.late_minutes := 0;
        NEW.reminder_before_sent_at := NULL;
        NEW.reminder_late_sent_at := NULL;
        NEW.reminder_message_ids := '[]'::jsonb;
        NEW.reminder_chat_id := NULL;
        NEW.close_reminder_sent_at := NULL;
        NEW.close_reminder_message_id := NULL;
        NEW.close_reminder_chat_id := NULL;
        NEW.auto_closed := false;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
