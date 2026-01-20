/*
  # Add Shift Tracking Fields and Partner Settings

  1. Changes to schedule_shifts table
    - Add `actual_start_at` (timestamptz, nullable) - actual shift start time
    - Add `actual_end_at` (timestamptz, nullable) - actual shift end time
    - Add `late_minutes` (integer, default 0) - minutes employee was late
    - Add `status` (text) - shift status: scheduled/opened/closed
    - Add `start_lat` (double precision, nullable) - latitude where shift was started
    - Add `start_lng` (double precision, nullable) - longitude where shift was started

  2. Changes to partner_settings table
    - Add `shift_location_radius_meters` (integer, default 50) - radius in meters for shift location check
    - Add `shift_require_location` (boolean, default true) - whether to require location for shift start
    - Add `shift_grace_minutes` (integer, default 0) - grace period before counting as late

  3. Indexes
    - Index on schedule_shifts(status) for filtering
    - Index on schedule_shifts(date, status) for daily queries
*/

-- Add new columns to schedule_shifts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'actual_start_at'
  ) THEN
    ALTER TABLE schedule_shifts 
    ADD COLUMN actual_start_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'actual_end_at'
  ) THEN
    ALTER TABLE schedule_shifts 
    ADD COLUMN actual_end_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'late_minutes'
  ) THEN
    ALTER TABLE schedule_shifts 
    ADD COLUMN late_minutes integer DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'status'
  ) THEN
    ALTER TABLE schedule_shifts 
    ADD COLUMN status text DEFAULT 'scheduled' NOT NULL 
    CHECK (status IN ('scheduled', 'opened', 'closed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'start_lat'
  ) THEN
    ALTER TABLE schedule_shifts 
    ADD COLUMN start_lat double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'start_lng'
  ) THEN
    ALTER TABLE schedule_shifts 
    ADD COLUMN start_lng double precision;
  END IF;
END $$;

-- Add new columns to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'shift_location_radius_meters'
  ) THEN
    ALTER TABLE partner_settings 
    ADD COLUMN shift_location_radius_meters integer DEFAULT 50 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'shift_require_location'
  ) THEN
    ALTER TABLE partner_settings 
    ADD COLUMN shift_require_location boolean DEFAULT true NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'shift_grace_minutes'
  ) THEN
    ALTER TABLE partner_settings 
    ADD COLUMN shift_grace_minutes integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_status ON schedule_shifts(status);
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_date_status ON schedule_shifts(date, status);
