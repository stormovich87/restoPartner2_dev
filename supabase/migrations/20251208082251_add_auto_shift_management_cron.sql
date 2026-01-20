/*
  # Add Automatic Shift Management Cron Job

  1. Setup
    - Enable pg_cron extension if not already enabled
    - Create cron job to call auto-manage-shifts edge function every 5 minutes

  2. Notes
    - The cron job runs every 5 minutes to check if shifts need to be opened or closed
    - Uses pg_net to make HTTP requests to the edge function
    - Only processes partners with auto_close_shifts enabled
*/

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Get Supabase URL from environment (will be replaced with actual URL)
-- Note: You need to manually update this SQL with your actual Supabase URL and service role key

-- Schedule the auto-manage-shifts function to run every 5 minutes
-- This is a placeholder - you need to configure this via Supabase Dashboard or using the actual cron.schedule function

-- Example (to be run manually or via Supabase Dashboard):
-- SELECT cron.schedule(
--   'auto-manage-shifts',
--   '*/5 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-manage-shifts',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--     )
--   );
--   $$
-- );

-- To check scheduled cron jobs:
-- SELECT * FROM cron.job;

-- To unschedule the job:
-- SELECT cron.unschedule('auto-manage-shifts');
