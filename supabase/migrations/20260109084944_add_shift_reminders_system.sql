/*
  # Shift Reminders System

  1. New Settings in partner_settings
    - `shift_reminders_enabled` (bool) - Enable/disable shift reminders
    - `shift_reminder_offset_minutes` (int) - Minutes before shift to send reminder
    - `shift_reminder_comment` (text) - Optional comment to include in reminders

  2. New Fields in schedule_shifts
    - `reminder_before_sent_at` (timestamptz) - When the "before shift" reminder was sent
    - `reminder_late_sent_at` (timestamptz) - When the "shift not opened" reminder was sent
    - `reminder_message_ids` (jsonb) - Array of message IDs for cleanup
    - `reminder_chat_id` (text) - Telegram chat ID for message deletion

  3. Purpose
    - Allow partners to configure automatic shift reminders
    - Track which reminders have been sent to avoid duplicates
    - Store message IDs for deletion when shift is opened
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'shift_reminders_enabled'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN shift_reminders_enabled boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'shift_reminder_offset_minutes'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN shift_reminder_offset_minutes integer NOT NULL DEFAULT 15;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'shift_reminder_comment'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN shift_reminder_comment text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'reminder_before_sent_at'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN reminder_before_sent_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'reminder_late_sent_at'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN reminder_late_sent_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'reminder_message_ids'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN reminder_message_ids jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'reminder_chat_id'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN reminder_chat_id text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedule_shifts_reminder_pending
ON schedule_shifts (partner_id, date, status)
WHERE reminder_before_sent_at IS NULL OR reminder_late_sent_at IS NULL;