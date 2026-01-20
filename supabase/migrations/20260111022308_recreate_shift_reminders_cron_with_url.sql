/*
  # Recreate Shift Reminders Cron Job

  1. Problem
    - Cron job for shift reminders was not properly created
    - Need to use actual Supabase URL and service role key

  2. Solution
    - Remove old cron job if exists
    - Create new cron job with correct URL
    - Use vault.decrypted_secrets for service role key or environment variable
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing cron job if exists
DO $$
BEGIN
  PERFORM cron.unschedule('shift-reminders-cron');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Create cron job that calls the edge function every minute
-- Uses the actual Supabase URL and expects SUPABASE_SERVICE_ROLE_KEY to be available
SELECT cron.schedule(
  'shift-reminders-cron',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://igzoxnzdqwongmyvkxww.supabase.co/functions/v1/shift-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
