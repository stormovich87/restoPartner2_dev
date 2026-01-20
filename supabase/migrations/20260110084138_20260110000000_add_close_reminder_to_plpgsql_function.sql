/*
  # Add Close Reminder and Auto-Close Logic to PL/pgSQL Function

  1. Problem
    - The PL/pgSQL function `send_shift_reminders()` only handles:
      - Before-shift reminders
      - Late reminders (when shift is not opened)
    - BUT it does NOT handle:
      - Close reminders (when shift ends and needs to be closed)
      - Auto-close functionality
    - These features exist only in the unused edge function

  2. Solution
    - Update `send_shift_reminders()` to also:
      - Query for opened shifts
      - Send close reminders when shift end time is reached
      - Auto-close shifts after offset time has passed
      - Delete reminder messages when shift is closed
    - Update partner query to also check for `shift_close_reminder_enabled`
    - Add helper function to delete Telegram messages

  3. Changes
    - New function: `delete_telegram_message()` - delete Telegram messages
    - Updated: `send_shift_reminders()` - add close reminder and auto-close logic
*/

-- Helper function to delete a Telegram message
CREATE OR REPLACE FUNCTION delete_telegram_message(
  p_bot_token TEXT,
  p_chat_id TEXT,
  p_message_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response http_response;
  response_data JSONB;
BEGIN
  BEGIN
    SELECT INTO response * FROM http((
      'POST',
      'https://api.telegram.org/bot' || p_bot_token || '/deleteMessage',
      ARRAY[http_header('Content-Type', 'application/json')],
      'application/json',
      jsonb_build_object(
        'chat_id', p_chat_id,
        'message_id', p_message_id
      )::text
    )::http_request);

    IF response.status = 200 THEN
      response_data := response.content::jsonb;
      IF response_data->>'ok' = 'true' THEN
        RAISE NOTICE 'Telegram message deleted successfully, message_id: %', p_message_id;
        RETURN TRUE;
      END IF;
    ELSE
      RAISE NOTICE 'Telegram API error deleting message, status: %, response: %', response.status, response.content;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error deleting Telegram message: %', SQLERRM;
  END;

  RETURN FALSE;
END;
$$;

-- Update main function to handle close reminders and auto-close
CREATE OR REPLACE FUNCTION send_shift_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  partner_record RECORD;
  shift_record RECORD;
  partner_tz TEXT;
  partner_now TIMESTAMPTZ;
  today_date DATE;
  current_time_minutes INTEGER;
  shift_start_minutes INTEGER;
  shift_end_minutes INTEGER;
  auto_close_time_minutes INTEGER;
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
  open_segment_record RECORD;
BEGIN
  RAISE NOTICE 'Starting shift reminders processing at %', NOW();

  -- Loop through all partners with shift reminders OR close reminders enabled
  FOR partner_record IN
    SELECT
      ps.partner_id,
      ps.shift_reminders_enabled,
      ps.shift_reminder_offset_minutes,
      ps.shift_reminder_comment,
      ps.shift_close_reminder_enabled,
      ps.shift_auto_close_offset_minutes,
      ps.employee_bot_token,
      ps.employee_bot_enabled,
      ps.app_url,
      ps.employee_cabinet_url,
      COALESCE(ps.timezone, 'Europe/Kiev') as timezone
    FROM partner_settings ps
    WHERE (ps.shift_reminders_enabled = true OR ps.shift_close_reminder_enabled = true)
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

    -- Base URL for cabinet links
    base_url := COALESCE(partner_record.employee_cabinet_url, partner_record.app_url, 'https://restopresto.org');

    -- Find scheduled shifts for today (for start reminders)
    IF partner_record.shift_reminders_enabled THEN
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

        -- Build cabinet URL
        IF shift_record.employee_cabinet_slug IS NOT NULL AND shift_record.employee_cabinet_slug != '' THEN
          cabinet_url := base_url || '/employee/' || shift_record.employee_cabinet_slug;
        ELSE
          cabinet_url := NULL;
        END IF;

        -- Current message IDs array
        current_message_ids := COALESCE(shift_record.reminder_message_ids, '[]'::jsonb);

        -- Check if we need to send "before shift" reminder
        IF shift_record.reminder_before_sent_at IS NULL
           AND current_time_minutes >= reminder_time_minutes
           AND current_time_minutes < shift_start_minutes THEN

          RAISE NOTICE 'Shift %: sending before-shift reminder', shift_record.id;

          -- Build message
          message_text := '<b>Напоминание: у вас назначена смена</b>' || E'\n\n';
          message_text := message_text || 'Филиал: ' || branch_name || E'\n';
          message_text := message_text || 'Время начала: ' || TO_CHAR(shift_record.start_time, 'HH24:MI') || E'\n\n';
          message_text := message_text || 'Не забудьте вовремя открыть смену в кабинете';

          IF partner_record.shift_reminder_comment IS NOT NULL AND partner_record.shift_reminder_comment != '' THEN
            message_text := message_text || E'\n\n' || partner_record.shift_reminder_comment;
          END IF;

          -- Send message
          sent_message_id := send_telegram_shift_reminder(
            partner_record.employee_bot_token,
            shift_record.employee_telegram_id,
            message_text,
            cabinet_url
          );

          IF sent_message_id IS NOT NULL THEN
            current_message_ids := current_message_ids || to_jsonb(sent_message_id);

            UPDATE schedule_shifts
            SET
              reminder_before_sent_at = NOW(),
              reminder_message_ids = current_message_ids,
              reminder_chat_id = shift_record.employee_telegram_id
            WHERE id = shift_record.id;

            reminders_sent := reminders_sent + 1;
            RAISE NOTICE 'Shift %: before-shift reminder sent successfully', shift_record.id;
          ELSE
            errors_count := errors_count + 1;
            RAISE NOTICE 'Shift %: failed to send before-shift reminder', shift_record.id;
          END IF;
        END IF;

        -- Check if we need to send "late" reminder
        IF shift_record.reminder_late_sent_at IS NULL
           AND current_time_minutes >= shift_start_minutes THEN

          RAISE NOTICE 'Shift %: sending late reminder', shift_record.id;

          -- Build message
          message_text := '<b>Смена не открыта</b>' || E'\n\n';
          message_text := message_text || 'Филиал: ' || branch_name || E'\n';
          message_text := message_text || 'Плановое время начала: ' || TO_CHAR(shift_record.start_time, 'HH24:MI') || E'\n\n';
          message_text := message_text || 'Пожалуйста, откройте смену как можно скорее';

          IF partner_record.shift_reminder_comment IS NOT NULL AND partner_record.shift_reminder_comment != '' THEN
            message_text := message_text || E'\n\n' || partner_record.shift_reminder_comment;
          END IF;

          -- Re-fetch current message IDs
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
            current_message_ids := current_message_ids || to_jsonb(sent_message_id);

            UPDATE schedule_shifts
            SET
              reminder_late_sent_at = NOW(),
              reminder_message_ids = current_message_ids,
              reminder_chat_id = shift_record.employee_telegram_id
            WHERE id = shift_record.id;

            reminders_sent := reminders_sent + 1;
            RAISE NOTICE 'Shift %: late reminder sent successfully', shift_record.id;
          ELSE
            errors_count := errors_count + 1;
            RAISE NOTICE 'Shift %: failed to send late reminder', shift_record.id;
          END IF;
        END IF;
      END LOOP;
    END IF;

    -- Find opened shifts for today (for close reminders and auto-close)
    IF partner_record.shift_close_reminder_enabled THEN
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
          ss.close_reminder_sent_at,
          ss.close_reminder_message_id,
          ss.close_reminder_chat_id,
          ss.auto_closed,
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
          AND ss.status = 'opened'
      LOOP
        shifts_found := shifts_found + 1;

        -- Skip if employee has no telegram_user_id
        IF shift_record.employee_telegram_id IS NULL OR shift_record.employee_telegram_id = '' THEN
          RAISE NOTICE 'Shift %: employee has no telegram_user_id, skipping', shift_record.id;
          CONTINUE;
        END IF;

        -- Calculate times
        shift_end_minutes := EXTRACT(HOUR FROM shift_record.end_time)::INTEGER * 60 + EXTRACT(MINUTE FROM shift_record.end_time)::INTEGER;
        auto_close_time_minutes := shift_end_minutes + COALESCE(partner_record.shift_auto_close_offset_minutes, 30);

        -- Get names
        branch_name := COALESCE(shift_record.branch_name, 'Не указан');

        -- Build cabinet URL
        IF shift_record.employee_cabinet_slug IS NOT NULL AND shift_record.employee_cabinet_slug != '' THEN
          cabinet_url := base_url || '/employee/' || shift_record.employee_cabinet_slug;
        ELSE
          cabinet_url := NULL;
        END IF;

        -- Check if we need to send close reminder
        IF shift_record.close_reminder_sent_at IS NULL
           AND current_time_minutes >= shift_end_minutes THEN

          RAISE NOTICE 'Shift %: sending close reminder (end time reached)', shift_record.id;

          -- Build message
          message_text := '<b>Смена завершена по графику</b>' || E'\n\n';
          message_text := message_text || 'Пожалуйста, не забудьте закрыть смену.' || E'\n\n';
          message_text := message_text || 'Филиал: ' || branch_name || E'\n';
          message_text := message_text || 'Плановое окончание: ' || TO_CHAR(shift_record.end_time, 'HH24:MI');

          -- Send message with cabinet link button
          sent_message_id := send_telegram_shift_reminder(
            partner_record.employee_bot_token,
            shift_record.employee_telegram_id,
            message_text,
            cabinet_url
          );

          IF sent_message_id IS NOT NULL THEN
            UPDATE schedule_shifts
            SET
              close_reminder_sent_at = NOW(),
              close_reminder_message_id = sent_message_id,
              close_reminder_chat_id = shift_record.employee_telegram_id
            WHERE id = shift_record.id;

            reminders_sent := reminders_sent + 1;
            RAISE NOTICE 'Shift %: close reminder sent successfully, message_id: %', shift_record.id, sent_message_id;
          ELSE
            errors_count := errors_count + 1;
            RAISE NOTICE 'Shift %: failed to send close reminder', shift_record.id;
          END IF;
        END IF;

        -- Check if we need to auto-close the shift
        IF shift_record.auto_closed = false
           AND current_time_minutes >= auto_close_time_minutes THEN

          RAISE NOTICE 'Shift %: auto-closing shift (auto-close time reached)', shift_record.id;

          -- Close any open work segments
          FOR open_segment_record IN
            SELECT id, segment_start_at
            FROM work_segments
            WHERE shift_id = shift_record.id
              AND segment_end_at IS NULL
          LOOP
            UPDATE work_segments
            SET segment_end_at = NOW()
            WHERE id = open_segment_record.id;

            RAISE NOTICE 'Shift %: closed open segment %', shift_record.id, open_segment_record.id;
          END LOOP;

          -- Close the shift
          UPDATE schedule_shifts
          SET
            status = 'closed',
            actual_end_at = NOW(),
            auto_closed = true,
            closed_by = 'system'
          WHERE id = shift_record.id;

          reminders_sent := reminders_sent + 1;
          RAISE NOTICE 'Shift %: shift auto-closed successfully', shift_record.id;

          -- Delete close reminder message if it exists
          IF shift_record.close_reminder_message_id IS NOT NULL
             AND shift_record.close_reminder_chat_id IS NOT NULL THEN
            PERFORM delete_telegram_message(
              partner_record.employee_bot_token,
              shift_record.close_reminder_chat_id,
              shift_record.close_reminder_message_id
            );
            RAISE NOTICE 'Shift %: close reminder message deletion attempted', shift_record.id;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE 'Shift reminders completed. Shifts found: %, Reminders sent: %, Errors: %',
    shifts_found, reminders_sent, errors_count;
END;
$$;

COMMENT ON FUNCTION delete_telegram_message(TEXT, TEXT, BIGINT) IS
'Deletes a Telegram message using the bot API';

COMMENT ON FUNCTION send_shift_reminders() IS
'Sends shift reminders to employees via Telegram. Handles: before-shift reminders, late reminders, close reminders, and auto-close. Uses employee_bot_token from partner_settings. Called every minute by cron job.';
