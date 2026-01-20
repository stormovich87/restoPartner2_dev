/*
  # Add History Cleanup Cron Job

  1. Changes
    - Enable pg_cron extension if not already enabled
    - Create cron job to run history cleanup daily at 3:00 AM
    - Calls cleanup-archived-orders edge function in auto mode

  2. Security
    - Uses pg_net extension for HTTP requests
    - Runs with appropriate permissions
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing cron job if exists
SELECT cron.unschedule('history_cleanup_job') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'history_cleanup_job'
);

-- Create cron job to run daily at 3:00 AM
SELECT cron.schedule(
  'history_cleanup_job',
  '0 3 * * *', -- Every day at 3:00 AM
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/cleanup-archived-orders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object('mode', 'auto')
    );
  $$
);