/*
  # Fix Shift Reminders - Use PL/pgSQL Function Instead of Edge Function

  1. Problem
    - The cron job was trying to call an edge function using `current_setting('app.supabase_url')`
    - These database settings were not configured, causing the cron job to fail
    - Reminders were not being sent

  2. Solution
    - Create a PL/pgSQL function that sends Telegram messages directly using the `http` extension
    - This is the same approach used by `send_scheduled_courier_polls()` which works correctly
    - The function reads `employee_bot_token` from `partner_settings`
    - Sends messages using synchronous HTTP calls (http extension)

  3. New Functions
    - `send_telegram_shift_reminder`: Helper function to send a single Telegram message
    - `send_shift_reminders`: Main function called by cron job

  4. Changes
    - Removes the old cron job that tried to call edge function
    - Creates new cron job that calls `send_shift_reminders()` directly

  5. Security
    - Functions use SECURITY DEFINER to access data
    - Bot token is read from partner_settings (same source as employee-registration-bot UI)
*/

-- Ensure http extension is enabled (should already be enabled)
CREATE EXTENSION IF NOT EXISTS http;

-- Helper function to send a Telegram message for shift reminder
CREATE OR REPLACE FUNCTION send_telegram_shift_reminder(
  p_bot_token TEXT,
  p_chat_id TEXT,
  p_message_text TEXT,
  p_keyboard_url TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response http_response;
  response_data JSONB;
  message_id BIGINT;
  request_body JSONB;
BEGIN
  -- Build request body
  IF p_keyboard_url IS NOT NULL THEN
    request_body := jsonb_build_object(
      'chat_id', p_chat_id,
      'text', p_message_text,
      'parse_mode', 'HTML',
      'reply_markup', jsonb_build_object(
        'inline_keyboard', jsonb_build_array(
          jsonb_build_array(
            jsonb_build_object(
              'text', 'Открыть кабинет',
              'url', p_keyboard_url
            )
          )
        )
      )
    );
  ELSE
    request_body := jsonb_build_object(
      'chat_id', p_chat_id,
      'text', p_message_text,
      'parse_mode', 'HTML'
    );
  END IF;

  -- Send message via Telegram API using http extension
  BEGIN
    SELECT INTO response * FROM http((
      'POST',
      'https://api.telegram.org/bot' || p_bot_token || '/sendMessage',
      ARRAY[http_header('Content-Type', 'application/json')],
      'application/json',
      request_body::text
    )::http_request);

    -- Parse response
    IF response.status = 200 THEN
      response_data := response.content::jsonb;
      
      -- Extract message_id from response
      IF response_data->'result'->'message_id' IS NOT NULL THEN
        message_id := (response_data->'result'->>'message_id')::BIGINT;
        RAISE NOTICE 'Telegram message sent successfully, message_id: %', message_id;
        RETURN message_id;
      END IF;
    ELSE
      RAISE NOTICE 'Telegram API error, status: %, response: %', response.status, response.content;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error sending Telegram message: %', SQLERRM;
  END;

  RETURN NULL;
END;
$$;

-- Main function to send shift reminders
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

    -- Base URL for cabinet links
    base_url := COALESCE(partner_record.employee_cabinet_url, partner_record.app_url, 'https://restopresto.org');

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
      
      -- Build cabinet URL
      IF shift_record.employee_cabinet_slug IS NOT NULL AND shift_record.employee_cabinet_slug != '' THEN
        cabinet_url := base_url || '/employee/' || shift_record.employee_cabinet_slug;
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
        message_text := '<b>Смена не открыта</b>' || E'\n\n';
        message_text := message_text || 'Филиал: ' || branch_name || E'\n';
        message_text := message_text || 'Плановое время начала: ' || TO_CHAR(shift_record.start_time, 'HH24:MI') || E'\n\n';
        message_text := message_text || 'Пожалуйста, откройте смену как можно скорее';
        
        IF partner_record.shift_reminder_comment IS NOT NULL AND partner_record.shift_reminder_comment != '' THEN
          message_text := message_text || E'\n\n' || partner_record.shift_reminder_comment;
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
$$;

-- Remove old cron job
SELECT cron.unschedule('shift-reminders-cron') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'shift-reminders-cron');

-- Create new cron job that calls the PL/pgSQL function directly
SELECT cron.schedule(
  'shift-reminders-cron',
  '* * * * *',
  $$SELECT send_shift_reminders();$$
);

-- Add comment to explain the job
COMMENT ON FUNCTION send_shift_reminders() IS 
'Sends shift reminders to employees via Telegram. Uses employee_bot_token from partner_settings (same bot as employee-registration-bot). Called every minute by cron job.';