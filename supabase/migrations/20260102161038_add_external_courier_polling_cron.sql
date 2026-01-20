/*
  # Add External Courier Polling Cron Job

  1. Changes
    - Create function to check and send scheduled polls
    - Create cron job to run every minute
    - Checks partner settings for enabled polling and schedule
    - Sends polls to selected couriers at scheduled time
    - Prevents duplicate sends by checking existing responses

  2. How it works
    - Runs every minute
    - For each partner with polling enabled:
      - Checks if current day is in schedule days
      - Checks if current time matches schedule time (within 1 minute)
      - Checks if poll hasn't been sent today yet
      - Sends poll to selected couriers or all active external couriers
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to check and send scheduled polls
CREATE OR REPLACE FUNCTION send_scheduled_courier_polls()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  partner_record RECORD;
  current_day_of_week INTEGER;
  current_time_str TEXT;
  schedule_time TEXT;
  already_sent BOOLEAN;
  courier_ids_json JSONB;
BEGIN
  -- Get current day of week (0 = Sunday, 1 = Monday, etc.)
  current_day_of_week := EXTRACT(DOW FROM CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
  
  -- Get current time in HH:MI format
  current_time_str := TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'HH24:MI');
  
  -- Loop through all partners with polling enabled
  FOR partner_record IN
    SELECT 
      ps.partner_id,
      ps.external_courier_polling_schedule,
      ps.external_courier_polling_selected_couriers,
      ps.timezone
    FROM partner_settings ps
    WHERE ps.external_courier_polling_enabled = true
      AND ps.external_courier_polling_schedule IS NOT NULL
  LOOP
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
    
    -- Check if poll was already sent today for this partner
    SELECT EXISTS(
      SELECT 1 
      FROM external_courier_polling_responses
      WHERE partner_id = partner_record.partner_id
        AND response_date = CURRENT_DATE
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

-- Remove existing cron job if exists
SELECT cron.unschedule('external_courier_polling_job') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'external_courier_polling_job'
);

-- Create cron job to run every minute
SELECT cron.schedule(
  'external_courier_polling_job',
  '* * * * *', -- Every minute
  $$
    SELECT send_scheduled_courier_polls();
  $$
);