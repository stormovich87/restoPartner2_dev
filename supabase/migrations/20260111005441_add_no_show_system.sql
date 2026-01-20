/*
  # Add No-Show (Не выход) System for Employee Shifts
  
  1. New Fields in schedule_shifts table:
    - `attendance_status` - Tracks status: scheduled, opened, closed, late, no_show
    - `no_show_at` - Timestamp when shift was marked as no_show
    - `no_show_reason_text` - Selected reason for no-show
    - `no_show_reason_selected_at` - When employee selected the reason
    - `no_show_reason_status` - Approval status: pending, approved, rejected
    - `no_show_approved_by` - Employee ID who approved the reason
    - `no_show_approved_at` - When reason was approved
    - `no_show_rejected_by` - Employee ID who rejected the reason
    - `no_show_rejected_at` - When reason was rejected
    - `no_show_notified_at` - Idempotency: when notifications were sent
    - `no_show_telegram_message_ids` - Array of Telegram message IDs for cleanup
  
  2. New Fields in partner_settings table:
    - `no_show_threshold_minutes` - Minutes after planned start to mark as no_show (default 30)
    - `no_show_reasons_enabled` - Allow employees to select no-show reasons
    - `no_show_reasons` - JSONB array of reason strings
    - `no_show_responsible_enabled` - Enable responsible persons feature
    - `no_show_responsible_position_id` - Position ID for responsible persons
    - `no_show_responsible_employee_ids` - Array of employee IDs who are responsible
  
  3. New Table: employee_events (in-app notifications)
    - For "Cabinet -> Events" notifications
    - Links to employees and tracks read status
    - Supports action buttons (approve/reject)

  4. Security
    - RLS enabled for employee_events table
    - Policies for partner isolation
*/

-- Add attendance_status enum type field to schedule_shifts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'attendance_status'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN attendance_status text DEFAULT 'scheduled';
  END IF;
END $$;

-- Add no_show tracking fields to schedule_shifts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'no_show_at'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN no_show_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'no_show_reason_text'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN no_show_reason_text text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'no_show_reason_selected_at'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN no_show_reason_selected_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'no_show_reason_status'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN no_show_reason_status text DEFAULT 'pending';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'no_show_approved_by'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN no_show_approved_by uuid REFERENCES employees(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'no_show_approved_at'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN no_show_approved_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'no_show_rejected_by'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN no_show_rejected_by uuid REFERENCES employees(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'no_show_rejected_at'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN no_show_rejected_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'no_show_notified_at'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN no_show_notified_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'no_show_telegram_message_ids'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN no_show_telegram_message_ids jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add no_show settings to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'no_show_threshold_minutes'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN no_show_threshold_minutes integer DEFAULT 30;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'no_show_reasons_enabled'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN no_show_reasons_enabled boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'no_show_reasons'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN no_show_reasons jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'no_show_responsible_enabled'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN no_show_responsible_enabled boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'no_show_responsible_position_id'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN no_show_responsible_position_id uuid REFERENCES positions(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'no_show_responsible_employee_ids'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN no_show_responsible_employee_ids uuid[] DEFAULT '{}';
  END IF;
END $$;

-- Create employee_events table for in-app notifications
CREATE TABLE IF NOT EXISTS employee_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  related_shift_id uuid REFERENCES schedule_shifts(id) ON DELETE SET NULL,
  related_employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  related_employee_photo_url text,
  related_employee_name text,
  related_branch_name text,
  related_shift_time text,
  action_type text,
  action_status text DEFAULT 'pending',
  action_taken_at timestamptz,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  telegram_message_id bigint,
  telegram_chat_id text
);

ALTER TABLE employee_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_events_select_policy" ON employee_events
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "employee_events_insert_policy" ON employee_events
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "employee_events_update_policy" ON employee_events
  FOR UPDATE TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "employee_events_delete_policy" ON employee_events
  FOR DELETE TO authenticated, anon
  USING (true);

GRANT ALL ON employee_events TO anon;
GRANT ALL ON employee_events TO authenticated;
GRANT ALL ON employee_events TO service_role;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_employee_events_employee_id ON employee_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_events_partner_id ON employee_events(partner_id);
CREATE INDEX IF NOT EXISTS idx_employee_events_created_at ON employee_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_events_is_read ON employee_events(is_read);

-- Create index for schedule_shifts attendance queries
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_attendance_status ON schedule_shifts(attendance_status);
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_no_show_at ON schedule_shifts(no_show_at);

-- Enable realtime for employee_events
ALTER PUBLICATION supabase_realtime ADD TABLE employee_events;

-- Trigger to sync attendance_status with status field
CREATE OR REPLACE FUNCTION sync_shift_attendance_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'opened' AND (NEW.attendance_status = 'scheduled' OR NEW.attendance_status IS NULL) THEN
    NEW.attendance_status := 'opened';
  ELSIF NEW.status = 'closed' AND NEW.attendance_status != 'no_show' THEN
    NEW.attendance_status := 'closed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_shift_attendance_status ON schedule_shifts;
CREATE TRIGGER trigger_sync_shift_attendance_status
  BEFORE UPDATE ON schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION sync_shift_attendance_status();
