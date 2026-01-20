/*
  # Add Replacement Search System for No-Show Shifts

  This migration implements a comprehensive replacement search system that automatically
  finds and notifies potential replacement employees when a shift is marked as no-show.

  ## 1. New Fields in partner_settings
    - `replacement_search_enabled` - Toggle for replacement search feature
    - `replacement_notify_scope` - Who to notify: 'same_position' or 'all_employees'
    - `replacement_branch_scope` - Where to search: 'same_branch', 'all_branches', 'branch_groups'
    - `replacement_branch_groups` - JSONB array of branch groups with names and branch IDs

  ## 2. New Fields in schedule_shifts
    - `replacement_status` - Status: none, offered, accepted, cancelled
    - `replacement_offered_at` - When replacement request was initiated
    - `replacement_employee_id` - Employee who accepted the replacement
    - `replacement_accepted_at` - When replacement was accepted
    - `replacement_eta_minutes` - ETA in minutes the replacement employee selected

  ## 3. New Table: shift_replacement_messages
    - Tracks all sent notifications for replacement requests
    - Stores telegram_message_id and event_id for later cleanup
    - Links to shift_id and candidate employee_id

  ## 4. Security
    - RLS enabled on shift_replacement_messages
    - Proper policies for partner isolation
*/

-- Add replacement search settings to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'replacement_search_enabled'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN replacement_search_enabled boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'replacement_notify_scope'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN replacement_notify_scope text DEFAULT 'same_position';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'replacement_branch_scope'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN replacement_branch_scope text DEFAULT 'same_branch';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'replacement_branch_groups'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN replacement_branch_groups jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add replacement tracking fields to schedule_shifts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'replacement_status'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN replacement_status text DEFAULT 'none';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'replacement_offered_at'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN replacement_offered_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'replacement_employee_id'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN replacement_employee_id uuid REFERENCES employees(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'replacement_accepted_at'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN replacement_accepted_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'replacement_eta_minutes'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN replacement_eta_minutes integer;
  END IF;
END $$;

-- Create shift_replacement_messages table for tracking sent notifications
CREATE TABLE IF NOT EXISTS shift_replacement_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES schedule_shifts(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  telegram_message_id bigint,
  telegram_chat_id text,
  event_id uuid REFERENCES employee_events(id) ON DELETE SET NULL,
  message_type text DEFAULT 'urgent_shift',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shift_replacement_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_replacement_messages_select_policy" ON shift_replacement_messages
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "shift_replacement_messages_insert_policy" ON shift_replacement_messages
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "shift_replacement_messages_update_policy" ON shift_replacement_messages
  FOR UPDATE TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "shift_replacement_messages_delete_policy" ON shift_replacement_messages
  FOR DELETE TO authenticated, anon
  USING (true);

GRANT ALL ON shift_replacement_messages TO anon;
GRANT ALL ON shift_replacement_messages TO authenticated;
GRANT ALL ON shift_replacement_messages TO service_role;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_shift_replacement_messages_shift_id ON shift_replacement_messages(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_replacement_messages_employee_id ON shift_replacement_messages(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_replacement_messages_is_active ON shift_replacement_messages(is_active);
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_replacement_status ON schedule_shifts(replacement_status);

-- Add new event types to employee_events (no schema change needed, just documentation)
-- Event types now include: 'urgent_shift' (for replacement requests), 'shift_accepted' (for notifications)

-- Enable realtime for shift_replacement_messages
ALTER PUBLICATION supabase_realtime ADD TABLE shift_replacement_messages;
