/*
  # Fix External Courier Polling Cron with Timezone Support

  1. Changes
    - Update send_scheduled_courier_polls function to respect partner timezone
    - Convert current time to partner's timezone before comparison
    - Use partner's local date for checking if poll was already sent
*/

-- Update function to respect partner timezone
CREATE OR REPLACE FUNCTION send_scheduled_courier_polls()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  partner_record RECORD;
  current_day_of_week INTEGER;
  current_time_str TEXT;
  partner_current_time TIMESTAMPTZ;
  schedule_time TEXT;
  already_sent BOOLEAN;
  courier_ids_json JSONB;
  partner_tz TEXT;
BEGIN
  -- Loop through all partners with polling enabled
  FOR partner_record IN
    SELECT 
      ps.partner_id,
      ps.external_courier_polling_schedule,
      ps.external_courier_polling_selected_couriers,
      COALESCE(ps.timezone, 'UTC') as timezone
    FROM partner_settings ps
    WHERE ps.external_courier_polling_enabled = true
      AND ps.external_courier_polling_schedule IS NOT NULL
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
    
    -- Check if current time matches schedule time (within 1 minute tolerance)
    IF current_time_str != schedule_time THEN
      CONTINUE;
    END IF;
    
    -- Check if poll was already sent today for this partner (in partner's timezone)
    SELECT EXISTS(
      SELECT 1 
      FROM external_courier_polling_responses
      WHERE partner_id = partner_record.partner_id
        AND response_date = DATE(partner_current_time)
    ) INTO already_sent;
    
    IF already_sent THEN
      CONTINUE;
    END IF;
    
    -- Prepare courier_ids JSON
    IF partner_record.external_courier_polling_selected_couriers IS NULL OR 
       array_length(partner_record.external_courier_polling_selected_couriers, 1) IS NULL THEN
      courier_ids_json := 'null'::jsonb;
    ELSE
      courier_ids_json := to_jsonb(partner_record.external_courier_polling_selected_couriers);
    END IF;
    
    -- Send poll via edge function
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/external-courier-polling',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'partner_id', partner_record.partner_id,
        'courier_ids', courier_ids_json,
        'action', 'send_poll'
      )
    );
    
  END LOOP;
END;
$$;