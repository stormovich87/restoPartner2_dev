/*
  # Add Auto-Close Fields for Shifts

  1. Modified Tables
    - `shifts` table - Added columns:
      - `auto_close_at` (timestamptz, nullable) - Timestamp when shift should be automatically closed

    - `partner_settings` table - Added columns:
      - `shift_duration_hours` (integer, default 24) - Duration in hours for automatic shift closing

  2. Notes
    - These fields enable automatic shift closing functionality
    - When auto_close_shifts is enabled, shifts will be automatically closed after shift_duration_hours
    - Orders in status 'in_progress' or 'en_route' will be transferred to the next shift
*/

-- Add auto_close_at column to shifts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shifts' AND column_name = 'auto_close_at'
  ) THEN
    ALTER TABLE shifts ADD COLUMN auto_close_at timestamptz;
  END IF;
END $$;

-- Add shift_duration_hours column to partner_settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'shift_duration_hours'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN shift_duration_hours integer DEFAULT 24;
  END IF;
END $$;

-- Create index for efficient auto-close queries
CREATE INDEX IF NOT EXISTS idx_shifts_auto_close_at ON shifts(auto_close_at) WHERE status = 'open' AND auto_close_at IS NOT NULL;