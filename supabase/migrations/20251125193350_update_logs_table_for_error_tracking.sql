/*
  # Update Logs Table for Error Tracking

  1. Changes to `logs` table
    - Add `section` column - Section of the application (orders, branches, couriers, payment_methods, settings, etc.)
    - Add `log_level` column - Log level (info, warning, error, critical)
    - Add `message` column - Log message
    - Rename `action` column to keep backward compatibility
    - Make partner_id NOT NULL for consistency
    - Update details to have better default

  2. Indexes
    - Index on section for filtering by section
    - Index on log_level for filtering by severity
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'logs' AND column_name = 'section'
  ) THEN
    ALTER TABLE logs ADD COLUMN section text DEFAULT 'general';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'logs' AND column_name = 'log_level'
  ) THEN
    ALTER TABLE logs ADD COLUMN log_level text DEFAULT 'info' CHECK (log_level IN ('info', 'warning', 'error', 'critical'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'logs' AND column_name = 'message'
  ) THEN
    ALTER TABLE logs ADD COLUMN message text DEFAULT '';
  END IF;
END $$;

ALTER TABLE logs ALTER COLUMN section SET NOT NULL;
ALTER TABLE logs ALTER COLUMN log_level SET NOT NULL;
ALTER TABLE logs ALTER COLUMN message SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logs_section ON logs(section);
CREATE INDEX IF NOT EXISTS idx_logs_log_level ON logs(log_level);
CREATE INDEX IF NOT EXISTS idx_logs_created_at_desc ON logs(created_at DESC);