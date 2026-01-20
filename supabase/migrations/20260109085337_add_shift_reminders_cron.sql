/*
  # Shift Reminders Cron Job

  1. Purpose
    - Creates a cron job that runs every minute to check and send shift reminders
    - Calls the shift-reminders edge function

  2. Schedule
    - Runs every minute (* * * * *)
*/

SELECT cron.schedule(
  'shift-reminders-cron',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/shift-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);