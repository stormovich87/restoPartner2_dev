/*
  # Remove Automatic Shift Management

  1. Changes
    - Drop cron job for auto-managing shifts (if exists)
    - Remove auto_close_at column from shifts table
    - Remove shift_duration_hours and auto_close_shifts columns from partner_settings table
    - Drop related index

  2. Notes
    - Shifts will now be managed manually only
    - All automatic shift closing functionality is removed
*/

-- Unschedule the auto-manage-shifts cron job if it exists
DO $$
BEGIN
  -- Check if pg_cron extension exists and if the job exists
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Try to unschedule the job (it may not exist, that's ok)
    PERFORM cron.unschedule('auto-manage-shifts');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if job doesn't exist or extension not installed
    NULL;
END $$;

-- Drop the index for auto-close queries
DROP INDEX IF EXISTS idx_shifts_auto_close_at;

-- Remove auto_close_at column from shifts table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shifts' AND column_name = 'auto_close_at'
  ) THEN
    ALTER TABLE shifts DROP COLUMN auto_close_at;
  END IF;
END $$;

-- Remove shift_duration_hours column from partner_settings table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'shift_duration_hours'
  ) THEN
    ALTER TABLE partner_settings DROP COLUMN shift_duration_hours;
  END IF;
END $$;

-- Remove auto_close_shifts column from partner_settings table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'auto_close_shifts'
  ) THEN
    ALTER TABLE partner_settings DROP COLUMN auto_close_shifts;
  END IF;
END $$;
