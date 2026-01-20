/*
  # Fix cabinet URL formation in shift reminders

  1. Changes
    - Update `send_shift_reminders()` function to form cabinet URL exactly like in /kabinet command
    - Use employee_cabinet_url as first priority, then app_url, then default
    - Format: baseUrl/employee/{cabinet_slug} -> baseUrl/{cabinet_slug}
    
  2. Notes
    - Cabinet URL formation matches employee-registration-bot /kabinet command
*/

CREATE OR REPLACE FUNCTION public.send_shift_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  partner_record RECORD;
  shift_record RECORD;
  partner_tz TEXT;
  partner_now TIMESTAMPTZ;
  today_date DATE;
  current_time_minutes INTEGER;
  shift_start_minutes INTEGER;
  reminder_time_minutes INTEGER;
  branch_name TEXT;
  employee_name TEXT;
  cabinet_url TEXT;
  base_url TEXT;
  message_text TEXT;
  sent_message_id BIGINT;
  current_message_ids JSONB;
  shifts_found INTEGER := 0;
  reminders_sent INTEGER := 0;
  errors_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting shift reminders processing at %', NOW();

  -- Loop through all partners with shift reminders enabled
  FOR partner_record IN
    SELECT 
      ps.partner_id,
      ps.shift_reminders_enabled,
      ps.shift_reminder_offset_minutes,
      ps.shift_reminder_comment,
      ps.employee_bot_token,
      ps.employee_bot_enabled,
      ps.app_url,
      ps.employee_cabinet_url,
      COALESCE(ps.timezone, 'Europe/Kiev') as timezone
    FROM partner_settings ps
    WHERE ps.shift_reminders_enabled = true
      AND ps.employee_bot_token IS NOT NULL
      AND ps.employee_bot_token != ''
  LOOP
    -- Check if bot is enabled
    IF partner_record.employee_bot_enabled = false THEN
      RAISE NOTICE 'Partner %: employee bot is disabled, skipping', partner_record.partner_id;
      CONTINUE;
    END IF;

    -- Get partner's timezone
    partner_tz := partner_record.timezone;

    -- Get current time in partner's timezone
    partner_now := CURRENT_TIMESTAMP AT TIME ZONE partner_tz;
    today_date := DATE(partner_now);
    current_time_minutes := EXTRACT(HOUR FROM partner_now)::INTEGER * 60 + EXTRACT(MINUTE FROM partner_now)::INTEGER;

    RAISE NOTICE 'Processing partner %, timezone: %, today: %, current time: %:%', 
      partner_record.partner_id, partner_tz, today_date, 
      EXTRACT(HOUR FROM partner_now)::INTEGER, EXTRACT(MINUTE FROM partner_now)::INTEGER;

    -- Find scheduled shifts for today
    FOR shift_record IN
      SELECT 
        ss.id,
        ss.partner_id,
        ss.branch_id,
        ss.staff_member_id,
        ss.date,
        ss.start_time,
        ss.end_time,
        ss.status,
        ss.reminder_before_sent_at,
        ss.reminder_late_sent_at,
        ss.reminder_message_ids,
        ss.reminder_chat_id,
        b.name as branch_name,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        e.telegram_user_id as employee_telegram_id,
        e.cabinet_slug as employee_cabinet_slug
      FROM schedule_shifts ss
      LEFT JOIN branches b ON b.id = ss.branch_id
      LEFT JOIN employees e ON e.id = ss.staff_member_id
      WHERE ss.partner_id = partner_record.partner_id
        AND ss.date = today_date
        AND ss.status = 'scheduled'
    LOOP
      shifts_found := shifts_found + 1;

      -- Skip if employee has no telegram_user_id
      IF shift_record.employee_telegram_id IS NULL OR shift_record.employee_telegram_id = '' THEN
        RAISE NOTICE 'Shift %: employee has no telegram_user_id, skipping', shift_record.id;
        CONTINUE;
      END IF;

      -- Calculate times
      shift_start_minutes := EXTRACT(HOUR FROM shift_record.start_time)::INTEGER * 60 + EXTRACT(MINUTE FROM shift_record.start_time)::INTEGER;
      reminder_time_minutes := shift_start_minutes - COALESCE(partner_record.shift_reminder_offset_minutes, 15);

      -- Get names
      branch_name := COALESCE(shift_record.branch_name, 'Не указан');
      employee_name := COALESCE(shift_record.employee_first_name, 'Сотрудник');

      -- Build cabinet URL (exactly like in /kabinet command)
      IF shift_record.employee_cabinet_slug IS NOT NULL AND shift_record.employee_cabinet_slug != '' THEN
        base_url := COALESCE(partner_record.employee_cabinet_url, partner_record.app_url, 'https://restopresto.org/employee');
        cabinet_url := base_url || '/' || shift_record.employee_cabinet_slug;
      ELSE
        cabinet_url := NULL;
      END IF;

      -- Current message IDs array
      current_message_ids := COALESCE(shift_record.reminder_message_ids, '[]'::jsonb);

      -- Check if we need to send "before shift" reminder
      -- Condition: not sent yet, current time >= reminder time, current time < shift start
      IF shift_record.reminder_before_sent_at IS NULL 
         AND current_time_minutes >= reminder_time_minutes 
         AND current_time_minutes < shift_start_minutes THEN

        RAISE NOTICE 'Shift %: sending before-shift reminder (current: %, reminder: %, start: %)', 
          shift_record.id, current_time_minutes, reminder_time_minutes, shift_start_minutes;

        -- Build message
        message_text := '<b>Напоминание: у вас назначена смена</b>' || E'\\n\\n';
        message_text := message_text || 'Филиал: ' || branch_name || E'\\n';
        message_text := message_text || 'Время начала: ' || TO_CHAR(shift_record.start_time, 'HH24:MI') || E'\\n\\n';
        message_text := message_text || 'Не забудьте вовремя открыть смену в кабинете';

        IF partner_record.shift_reminder_comment IS NOT NULL AND partner_record.shift_reminder_comment != '' THEN
          message_text := message_text || E'\\n\\n' || partner_record.shift_reminder_comment;
        END IF;

        -- Send message
        sent_message_id := send_telegram_shift_reminder(
          partner_record.employee_bot_token,
          shift_record.employee_telegram_id,
          message_text,
          cabinet_url
        );

        IF sent_message_id IS NOT NULL THEN
          -- Update shift record
          current_message_ids := current_message_ids || to_jsonb(sent_message_id);

          UPDATE schedule_shifts
          SET 
            reminder_before_sent_at = NOW(),
            reminder_message_ids = current_message_ids,
            reminder_chat_id = shift_record.employee_telegram_id
          WHERE id = shift_record.id;

          reminders_sent := reminders_sent + 1;
          RAISE NOTICE 'Shift %: before-shift reminder sent successfully, message_id: %', shift_record.id, sent_message_id;
        ELSE
          errors_count := errors_count + 1;
          RAISE NOTICE 'Shift %: failed to send before-shift reminder', shift_record.id;
        END IF;
      END IF;

      -- Check if we need to send "late" reminder (shift not opened)
      -- Condition: not sent yet, current time >= shift start time
      IF shift_record.reminder_late_sent_at IS NULL 
         AND current_time_minutes >= shift_start_minutes THEN

        RAISE NOTICE 'Shift %: sending late reminder (current: %, start: %)', 
          shift_record.id, current_time_minutes, shift_start_minutes;

        -- Build message
        message_text := '<b>Смена не открыта</b>' || E'\\n\\n';
        message_text := message_text || 'Филиал: ' || branch_name || E'\\n';
        message_text := message_text || 'Плановое время начала: ' || TO_CHAR(shift_record.start_time, 'HH24:MI') || E'\\n\\n';
        message_text := message_text || 'Пожалуйста, откройте смену как можно скорее';

        IF partner_record.shift_reminder_comment IS NOT NULL AND partner_record.shift_reminder_comment != '' THEN
          message_text := message_text || E'\\n\\n' || partner_record.shift_reminder_comment;
        END IF;

        -- Re-fetch current message IDs (might have been updated above)
        SELECT reminder_message_ids INTO current_message_ids 
        FROM schedule_shifts WHERE id = shift_record.id;
        current_message_ids := COALESCE(current_message_ids, '[]'::jsonb);

        -- Send message
        sent_message_id := send_telegram_shift_reminder(
          partner_record.employee_bot_token,
          shift_record.employee_telegram_id,
          message_text,
          cabinet_url
        );

        IF sent_message_id IS NOT NULL THEN
          -- Update shift record
          current_message_ids := current_message_ids || to_jsonb(sent_message_id);

          UPDATE schedule_shifts
          SET 
            reminder_late_sent_at = NOW(),
            reminder_message_ids = current_message_ids,
            reminder_chat_id = shift_record.employee_telegram_id
          WHERE id = shift_record.id;

          reminders_sent := reminders_sent + 1;
          RAISE NOTICE 'Shift %: late reminder sent successfully, message_id: %', shift_record.id, sent_message_id;
        ELSE
          errors_count := errors_count + 1;
          RAISE NOTICE 'Shift %: failed to send late reminder', shift_record.id;
        END IF;
      END IF;

    END LOOP; -- shifts loop
  END LOOP; -- partners loop

  RAISE NOTICE 'Shift reminders completed. Shifts found: %, Reminders sent: %, Errors: %', 
    shifts_found, reminders_sent, errors_count;
END;
$function$;