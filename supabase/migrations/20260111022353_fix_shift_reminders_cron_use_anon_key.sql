/*
  # Fix Shift Reminders Cron - Use Anon Key

  1. Problem
    - Cron job could not access service_role_key setting
    - Edge function needs to be called but auth was failing

  2. Solution
    - Update cron job to use anon key instead
    - Edge function already uses service_role_key internally for database access
    - This allows the cron to successfully invoke the function
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing cron job
DO $$
BEGIN
  PERFORM cron.unschedule('shift-reminders-cron');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Create cron job with anon key
SELECT cron.schedule(
  'shift-reminders-cron',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://igzoxnzdqwongmyvkxww.supabase.co/functions/v1/shift-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlnem94bnpkcXdvbmdteXZreHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5Nzg0ODYsImV4cCI6MjA3OTU1NDQ4Nn0.HWNvaxTdgB4izu4ziFiaPqDciYW4bsOhL6H5O-decCk'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
