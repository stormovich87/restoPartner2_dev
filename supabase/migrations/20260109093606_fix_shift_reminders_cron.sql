/*
  # Fix Shift Reminders Cron Job

  1. Changes
    - Remove old cron job with incorrect settings
    - Create new cron job with correct settings path
    - Uses app.supabase_url instead of app.settings.supabase_url
    - Uses app.supabase_service_role_key instead of app.settings.service_role_key

  2. Schedule
    - Runs every minute to check and send shift reminders
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing cron job if exists
SELECT cron.unschedule('shift-reminders-cron') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'shift-reminders-cron'
);

-- Create new cron job with correct settings
SELECT cron.schedule(
  'shift-reminders-cron',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/shift-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
