/*
  # Add External Courier ETA Cleaner Cron Job

  1. Purpose
    - Creates a cron job that runs every 2 minutes to clean up expired ETA questions
    - Deletes ETA question messages from Telegram if courier hasn't responded in 5 minutes
    - Removes expired states from external_courier_states table

  2. Implementation
    - Uses pg_cron extension to schedule the job
    - Calls a PL/pgSQL function that invokes the edge function
*/

-- Create function to invoke the ETA cleaner edge function
CREATE OR REPLACE FUNCTION invoke_external_courier_eta_cleaner()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  edge_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/external-courier-eta-cleaner';
  service_role_key := current_setting('app.settings.service_role_key', true);

  IF edge_function_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'Edge function URL or service role key not configured';
    RETURN;
  END IF;

  PERFORM
    net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := '{}'::jsonb
    );
END;
$$;

-- Schedule the cron job to run every 2 minutes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('external-courier-eta-cleaner');
    PERFORM cron.schedule(
      'external-courier-eta-cleaner',
      '*/2 * * * *',
      'SELECT invoke_external_courier_eta_cleaner()'
    );
    RAISE NOTICE 'Scheduled external-courier-eta-cleaner cron job';
  ELSE
    RAISE NOTICE 'pg_cron extension not available';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule cron job: %', SQLERRM;
END;
$$;