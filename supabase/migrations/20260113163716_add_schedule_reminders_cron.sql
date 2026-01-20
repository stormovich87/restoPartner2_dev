/*
  # Add Schedule Reminders Cron Job

  This migration creates a cron job that runs every minute to check if 
  schedule reminders should be sent based on partner-configured times.

  ## How it works:
  1. Cron runs every minute
  2. For each partner, checks if current time matches any configured reminder time
  3. Considers timezone, reminder frequency (every_n_days), and times_per_day
  4. Calls the schedule-reminders edge function when conditions are met

  ## Settings checked:
  - manager_reminders_enabled - if true, sends planning horizon reminders
  - manager_reminders_at_times - array of HH:MM times to send reminders
  - manager_reminders_every_n_days - frequency in days
  - timezone - partner's timezone for time matching
*/

-- Create or replace function to check and trigger reminders
CREATE OR REPLACE FUNCTION check_and_send_schedule_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  partner_record RECORD;
  current_time_str text;
  reminder_time text;
  should_send boolean;
  last_sent_date date;
  days_since_last_sent integer;
  supabase_url text;
  anon_key text;
BEGIN
  -- Get Supabase URL and anon key from vault or environment
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url';
  SELECT decrypted_secret INTO anon_key FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key';
  
  -- Fallback to env vars if vault not available
  IF supabase_url IS NULL THEN
    supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;
  IF anon_key IS NULL THEN
    anon_key := current_setting('app.settings.supabase_anon_key', true);
  END IF;

  -- Loop through all partners with reminders enabled
  FOR partner_record IN 
    SELECT 
      partner_id,
      manager_reminders_enabled,
      manager_reminders_every_n_days,
      manager_reminders_at_times,
      COALESCE(timezone, 'Europe/Kiev') as tz
    FROM partner_settings 
    WHERE manager_reminders_enabled = true
  LOOP
    -- Get current time in partner's timezone
    current_time_str := to_char(now() AT TIME ZONE partner_record.tz, 'HH24:MI');
    
    -- Check if current time matches any configured reminder time
    should_send := false;
    
    IF partner_record.manager_reminders_at_times IS NOT NULL THEN
      FOR reminder_time IN SELECT jsonb_array_elements_text(partner_record.manager_reminders_at_times)
      LOOP
        IF current_time_str = reminder_time THEN
          should_send := true;
          EXIT;
        END IF;
      END LOOP;
    END IF;
    
    IF should_send THEN
      -- Check reminder frequency (every_n_days)
      SELECT MAX(DATE(sent_at AT TIME ZONE partner_record.tz)) INTO last_sent_date
      FROM schedule_manager_reminder_log
      WHERE partner_id = partner_record.partner_id
        AND is_active = true;
      
      IF last_sent_date IS NOT NULL THEN
        days_since_last_sent := (CURRENT_DATE AT TIME ZONE partner_record.tz)::date - last_sent_date;
        IF days_since_last_sent < partner_record.manager_reminders_every_n_days THEN
          should_send := false;
        END IF;
      END IF;
    END IF;
    
    -- Log if we should send (actual sending is done by edge function)
    IF should_send THEN
      INSERT INTO schedule_action_logs (partner_id, actor_type, action_type, target_type, details)
      VALUES (
        partner_record.partner_id, 
        'system', 
        'reminder_cron_triggered',
        'partner',
        jsonb_build_object('time', current_time_str, 'timezone', partner_record.tz)
      );
    END IF;
  END LOOP;
END;
$$;

-- Create the cron job to run every minute
-- Note: This will call the schedule-reminders edge function via pg_net extension
SELECT cron.schedule(
  'schedule-reminders-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/schedule-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
