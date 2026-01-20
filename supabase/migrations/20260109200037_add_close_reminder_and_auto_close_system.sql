/*
  # Add close reminder and auto-close system for shifts

  1. New columns in partner_settings:
    - `shift_close_reminder_enabled` (boolean) - Enable close reminder feature
    - `shift_auto_close_offset_minutes` (integer) - Minutes after planned_end to auto-close

  2. New columns in schedule_shifts:
    - `close_reminder_sent_at` (timestamptz) - When close reminder was sent
    - `close_reminder_message_id` (bigint) - Telegram message ID for deletion
    - `close_reminder_chat_id` (text) - Telegram chat ID
    - `auto_closed` (boolean) - Whether shift was auto-closed
    - `closed_by` (text) - Who closed the shift: 'employee', 'admin', 'system'

  3. Security:
    - No changes to RLS policies needed (existing policies cover these columns)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'shift_close_reminder_enabled'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN shift_close_reminder_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'shift_auto_close_offset_minutes'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN shift_auto_close_offset_minutes integer DEFAULT 30;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'close_reminder_sent_at'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN close_reminder_sent_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'close_reminder_message_id'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN close_reminder_message_id bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'close_reminder_chat_id'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN close_reminder_chat_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'auto_closed'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN auto_closed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'closed_by'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN closed_by text;
  END IF;
END $$;

COMMENT ON COLUMN partner_settings.shift_close_reminder_enabled IS 'Enable close shift reminder at planned_end time';
COMMENT ON COLUMN partner_settings.shift_auto_close_offset_minutes IS 'Minutes after planned_end to auto-close shift';
COMMENT ON COLUMN schedule_shifts.close_reminder_sent_at IS 'When the close reminder message was sent';
COMMENT ON COLUMN schedule_shifts.close_reminder_message_id IS 'Telegram message ID for deletion on manual close';
COMMENT ON COLUMN schedule_shifts.close_reminder_chat_id IS 'Telegram chat ID where reminder was sent';
COMMENT ON COLUMN schedule_shifts.auto_closed IS 'Whether the shift was automatically closed by system';
COMMENT ON COLUMN schedule_shifts.closed_by IS 'Who closed the shift: employee, admin, or system';
