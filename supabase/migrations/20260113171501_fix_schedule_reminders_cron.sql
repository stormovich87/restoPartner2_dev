/*
  # Fix Schedule Reminders Cron Job

  Updates the cron job to use direct URL instead of vault secrets
  which were not configured.
*/

-- Drop existing cron job
SELECT cron.unschedule('schedule-reminders-cron');

-- Recreate with direct URL
SELECT cron.schedule(
  'schedule-reminders-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://igzoxnzdqwongmyvkxww.supabase.co/functions/v1/schedule-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlnem94bnpkcXdvbmdteXZreHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5Nzg0ODYsImV4cCI6MjA3OTU1NDQ4Nn0.HWNvaxTdgB4izu4ziFiaPqDciYW4bsOhL6H5O-decCk'
    ),
    body := '{}'::jsonb
  );
  $$
);
