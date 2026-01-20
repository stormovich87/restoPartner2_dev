/*
  # Full shift reset when time is changed to future

  1. Problem
    - When user changes shift time to future, they want to "reschedule" the shift
    - Previous trigger didn't reset if shift was already started (actual_start_at not null)
    - This prevented reminders from being sent for rescheduled shifts

  2. Solution
    - Remove the actual_start_at check
    - When time is changed to future, reset ALL fields including actual_start_at
    - This treats the shift as a completely new scheduled shift

  3. Changes
    - Removed `NEW.actual_start_at IS NULL` condition
    - Added reset of actual_start_at and actual_end_at
    - Added reset of all work segments for this shift
*/

CREATE OR REPLACE FUNCTION reset_shift_status_on_time_change()
RETURNS TRIGGER AS $$
DECLARE
  partner_timezone TEXT;
  current_partner_time TIMESTAMP;
  new_shift_start TIMESTAMP;
BEGIN
  IF (OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.end_time IS DISTINCT FROM NEW.end_time) THEN
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
      NEW.actual_start_at := NULL;
      NEW.actual_end_at := NULL;
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
      NEW.start_lat := NULL;
      NEW.start_lng := NULL;
      
      DELETE FROM work_segments WHERE shift_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
