/*
  # Fix polling to allow schedule time changes during the day

  1. Changes
    - Check if poll was already sent within ±2 minutes of current scheduled time
    - This allows changing schedule time during the day
    - Prevents duplicate sends for the same scheduled time

  2. Logic
    - If scheduled time is 18:39, check if poll was sent between 18:37-18:41 today
    - If no poll in this time window, send
    - If poll already sent in this window, skip
*/

CREATE OR REPLACE FUNCTION send_scheduled_courier_polls()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  partner_record RECORD;
  courier_record RECORD;
  current_day_of_week INTEGER;
  current_time_str TEXT;
  partner_current_time TIMESTAMPTZ;
  schedule_time TEXT;
  schedule_timestamp TIMESTAMPTZ;
  poll_sent_in_time_window BOOLEAN;
  partner_tz TEXT;
  sent_message_id BIGINT;
  bot_token TEXT;
  target_courier_ids UUID[];
BEGIN
  -- Loop through all partners with polling enabled
  FOR partner_record IN
    SELECT 
      ps.partner_id,
      ps.external_courier_polling_schedule,
      ps.external_courier_polling_selected_couriers,
      ps.external_courier_bot_token,
      ps.external_courier_polling_message,
      ps.external_courier_polling_agree_button,
      ps.external_courier_polling_decline_button,
      COALESCE(ps.timezone, 'UTC') as timezone
    FROM partner_settings ps
    WHERE ps.external_courier_polling_enabled = true
      AND ps.external_courier_polling_schedule IS NOT NULL
      AND ps.external_courier_bot_token IS NOT NULL
  LOOP
    -- Get partner's timezone
    partner_tz := partner_record.timezone;
    
    -- Get current time in partner's timezone
    partner_current_time := CURRENT_TIMESTAMP AT TIME ZONE partner_tz;
    
    -- Get current day of week (0 = Sunday, 1 = Monday, etc.) in partner's timezone
    current_day_of_week := EXTRACT(DOW FROM partner_current_time);
    
    -- Get current time in HH:MI format in partner's timezone
    current_time_str := TO_CHAR(partner_current_time, 'HH24:MI');
    
    -- Get schedule time
    schedule_time := partner_record.external_courier_polling_schedule->>'time';
    
    -- Check if current day is in schedule days
    IF NOT (partner_record.external_courier_polling_schedule->'days' @> to_jsonb(current_day_of_week)) THEN
      CONTINUE;
    END IF;
    
    -- Check if current time matches schedule time
    IF current_time_str != schedule_time THEN
      CONTINUE;
    END IF;
    
    -- Calculate the scheduled timestamp for today
    schedule_timestamp := (DATE(partner_current_time) || ' ' || schedule_time || ':00')::timestamp AT TIME ZONE partner_tz;
    
    -- Determine target couriers
    IF partner_record.external_courier_polling_selected_couriers IS NOT NULL AND 
       array_length(partner_record.external_courier_polling_selected_couriers, 1) > 0 THEN
      target_courier_ids := partner_record.external_courier_polling_selected_couriers;
    ELSE
      target_courier_ids := NULL;
    END IF;
    
    -- Send polls to couriers (check each courier individually)
    FOR courier_record IN
      SELECT c.id, c.telegram_user_id
      FROM couriers c
      WHERE c.partner_id = partner_record.partner_id
        AND c.is_own = false
        AND c.is_active = true
        AND c.telegram_user_id IS NOT NULL
        AND (target_courier_ids IS NULL OR c.id = ANY(target_courier_ids))
    LOOP
      -- Check if poll was already sent within ±2 minutes of scheduled time today
      SELECT EXISTS(
        SELECT 1 
        FROM external_courier_polling_responses
        WHERE partner_id = partner_record.partner_id
          AND courier_id = courier_record.id
          AND is_scheduled = true
          AND created_at >= schedule_timestamp - interval '2 minutes'
          AND created_at <= schedule_timestamp + interval '2 minutes'
      ) INTO poll_sent_in_time_window;
      
      -- Skip if poll already sent in this time window
      IF poll_sent_in_time_window THEN
        CONTINUE;
      END IF;
      
      -- Send Telegram message
      sent_message_id := send_telegram_poll_message(
        partner_record.external_courier_bot_token,
        courier_record.telegram_user_id::BIGINT,
        COALESCE(partner_record.external_courier_polling_message, 'Вы сегодня готовы принимать заказы?'),
        COALESCE(partner_record.external_courier_polling_agree_button, 'Да, готов'),
        COALESCE(partner_record.external_courier_polling_decline_button, 'Нет, не сегодня'),
        courier_record.id
      );
      
      -- Create response record with is_scheduled = true
      IF sent_message_id IS NOT NULL THEN
        INSERT INTO external_courier_polling_responses (
          partner_id,
          courier_id,
          response_date,
          is_active,
          message_id,
          is_scheduled,
          created_at
        ) VALUES (
          partner_record.partner_id,
          courier_record.id,
          DATE(partner_current_time),
          false,
          sent_message_id,
          true,
          CURRENT_TIMESTAMP
        );
      END IF;
    END LOOP;
    
  END LOOP;
END;
$$;