/*
  # Schedule Planning Settings Module
  
  This migration creates a comprehensive schedule planning and confirmation system
  with responsible managers, planning horizon, and notification reminders.
  
  ## 1. Partner Settings Extensions
    - `planning_horizon_days` (integer, default 14) - minimum days schedule must be planned ahead
    - `manager_reminders_enabled` (boolean) - enable reminders to managers
    - `manager_reminders_every_n_days` (integer) - reminder frequency in days
    - `manager_reminders_times_per_day` (integer) - how many times per day to remind
    - `manager_reminders_at_times` (jsonb) - array of HH:MM times for reminders
    - `employee_confirm_reminders_enabled` (boolean) - enable confirmation reminders to employees
    - `employee_confirm_reminders_every_n_days` (integer) - reminder frequency
    - `employee_confirm_reminders_times_per_day` (integer) - times per day
    - `employee_confirm_reminders_at_times` (jsonb) - array of HH:MM times
    - `schedule_confirm_deadline_hours` (integer) - hours before shift to confirm
    - `last_published_shift_date` (date) - last date with published schedule
  
  ## 2. New Tables
  
  ### schedule_responsible_managers
    Stores managers responsible for schedule planning
    - `id` (uuid, primary key)
    - `partner_id` (uuid, references partners)
    - `employee_id` (uuid, references employees) - the responsible person
    - `is_active` (boolean, default true)
    - `created_at`, `updated_at` (timestamptz)
  
  ### schedule_responsible_branches  
    Links responsible managers to their branch zones
    - `id` (uuid, primary key)
    - `responsible_manager_id` (uuid, references schedule_responsible_managers)
    - `branch_id` (uuid, references branches)
    - Unique constraint on (responsible_manager_id, branch_id)
  
  ### schedule_manager_reminder_log
    Tracks sent reminders to managers (for edit/delete anti-spam)
    - `id` (uuid, primary key)
    - `partner_id` (uuid, references partners)
    - `responsible_manager_id` (uuid, references schedule_responsible_managers)
    - `branch_scope_hash` (text) - hash of branch_ids for grouping
    - `required_date` (date) - the date schedule should be filled to
    - `telegram_chat_id` (text)
    - `telegram_message_id` (bigint)
    - `event_id` (uuid, references employee_events)
    - `is_active` (boolean) - for upsert logic
    - `sent_at` (timestamptz)
  
  ### schedule_shift_assignments
    Tracks employee confirmations/declines for shift assignments
    - `id` (uuid, primary key)
    - `shift_id` (uuid, references schedule_shifts)
    - `employee_id` (uuid, references employees)
    - `partner_id` (uuid, references partners)
    - `assignment_status` (text) - pending_confirm, confirmed, declined
    - `confirmed_at`, `declined_at` (timestamptz)
    - `decline_reason_id` (text) - selected reason
    - `decline_comment` (text) - optional comment
    - `actor_id` (uuid) - who made the action
    - Unique constraint on (shift_id, employee_id)
  
  ### schedule_decline_reasons
    Configurable reasons for declining shifts
    - `id` (uuid, primary key)
    - `partner_id` (uuid, references partners)
    - `reason_text` (text)
    - `sort_order` (integer)
    - `is_active` (boolean)
  
  ### schedule_employee_reminder_log
    Tracks sent confirmation reminders to employees
    - `id` (uuid, primary key)
    - `partner_id` (uuid, references partners)
    - `employee_id` (uuid, references employees)
    - `schedule_period_key` (text) - period identifier for grouping
    - `telegram_chat_id` (text)
    - `telegram_message_id` (bigint)
    - `event_id` (uuid, references employee_events)
    - `is_active` (boolean)
    - `sent_at` (timestamptz)
  
  ### schedule_unfilled_shift_notifications
    Tracks notifications about unfilled shifts (after decline)
    - `id` (uuid, primary key)
    - `partner_id` (uuid)
    - `shift_id` (uuid, references schedule_shifts)
    - `responsible_manager_id` (uuid)
    - `telegram_chat_id` (text)
    - `telegram_message_id` (bigint)
    - `event_id` (uuid, references employee_events)
    - `is_active` (boolean)
    - `sent_at` (timestamptz)
  
  ### schedule_action_logs
    Audit log for all schedule-related actions
    - `id` (uuid, primary key)
    - `partner_id` (uuid)
    - `actor_type` (text) - employee, manager, system
    - `actor_id` (uuid)
    - `action_type` (text) - confirmed, declined, reminder_sent, etc.
    - `target_type` (text) - shift, assignment, reminder
    - `target_id` (uuid)
    - `details` (jsonb)
    - `created_at` (timestamptz)
  
  ## 3. Indexes
    - Performance indexes for all foreign keys
    - Composite indexes for common query patterns
  
  ## 4. Security
    - RLS enabled on all tables
    - Policies for partner isolation through app-level filtering
*/

-- =====================================================
-- PART 1: Extend partner_settings with planning settings
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'planning_horizon_days'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN planning_horizon_days integer DEFAULT 14 NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'last_published_shift_date'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN last_published_shift_date date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'manager_reminders_enabled'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN manager_reminders_enabled boolean DEFAULT false NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'manager_reminders_every_n_days'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN manager_reminders_every_n_days integer DEFAULT 1 NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'manager_reminders_times_per_day'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN manager_reminders_times_per_day integer DEFAULT 1 NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'manager_reminders_at_times'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN manager_reminders_at_times jsonb DEFAULT '["09:00"]'::jsonb NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'employee_confirm_reminders_enabled'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN employee_confirm_reminders_enabled boolean DEFAULT false NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'employee_confirm_reminders_every_n_days'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN employee_confirm_reminders_every_n_days integer DEFAULT 1 NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'employee_confirm_reminders_times_per_day'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN employee_confirm_reminders_times_per_day integer DEFAULT 1 NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'employee_confirm_reminders_at_times'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN employee_confirm_reminders_at_times jsonb DEFAULT '["10:00"]'::jsonb NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'schedule_confirm_deadline_hours'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN schedule_confirm_deadline_hours integer DEFAULT 24 NOT NULL;
  END IF;
END $$;


-- =====================================================
-- PART 2: Create schedule_responsible_managers table
-- =====================================================

CREATE TABLE IF NOT EXISTS schedule_responsible_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, employee_id)
);

ALTER TABLE schedule_responsible_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_responsible_managers_select" ON schedule_responsible_managers
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "schedule_responsible_managers_insert" ON schedule_responsible_managers
  FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "schedule_responsible_managers_update" ON schedule_responsible_managers
  FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "schedule_responsible_managers_delete" ON schedule_responsible_managers
  FOR DELETE TO authenticated, anon USING (true);

GRANT ALL ON schedule_responsible_managers TO anon;
GRANT ALL ON schedule_responsible_managers TO authenticated;
GRANT ALL ON schedule_responsible_managers TO service_role;

CREATE INDEX IF NOT EXISTS idx_schedule_responsible_managers_partner_id ON schedule_responsible_managers(partner_id);
CREATE INDEX IF NOT EXISTS idx_schedule_responsible_managers_employee_id ON schedule_responsible_managers(employee_id);
CREATE INDEX IF NOT EXISTS idx_schedule_responsible_managers_active ON schedule_responsible_managers(is_active) WHERE is_active = true;


-- =====================================================
-- PART 3: Create schedule_responsible_branches table
-- =====================================================

CREATE TABLE IF NOT EXISTS schedule_responsible_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  responsible_manager_id uuid NOT NULL REFERENCES schedule_responsible_managers(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(responsible_manager_id, branch_id)
);

ALTER TABLE schedule_responsible_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_responsible_branches_select" ON schedule_responsible_branches
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "schedule_responsible_branches_insert" ON schedule_responsible_branches
  FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "schedule_responsible_branches_update" ON schedule_responsible_branches
  FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "schedule_responsible_branches_delete" ON schedule_responsible_branches
  FOR DELETE TO authenticated, anon USING (true);

GRANT ALL ON schedule_responsible_branches TO anon;
GRANT ALL ON schedule_responsible_branches TO authenticated;
GRANT ALL ON schedule_responsible_branches TO service_role;

CREATE INDEX IF NOT EXISTS idx_schedule_responsible_branches_manager_id ON schedule_responsible_branches(responsible_manager_id);
CREATE INDEX IF NOT EXISTS idx_schedule_responsible_branches_branch_id ON schedule_responsible_branches(branch_id);


-- =====================================================
-- PART 4: Create schedule_manager_reminder_log table
-- =====================================================

CREATE TABLE IF NOT EXISTS schedule_manager_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  responsible_manager_id uuid NOT NULL REFERENCES schedule_responsible_managers(id) ON DELETE CASCADE,
  branch_scope_hash text NOT NULL,
  required_date date NOT NULL,
  telegram_chat_id text,
  telegram_message_id bigint,
  event_id uuid,
  is_active boolean DEFAULT true NOT NULL,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE schedule_manager_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_manager_reminder_log_select" ON schedule_manager_reminder_log
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "schedule_manager_reminder_log_insert" ON schedule_manager_reminder_log
  FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "schedule_manager_reminder_log_update" ON schedule_manager_reminder_log
  FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "schedule_manager_reminder_log_delete" ON schedule_manager_reminder_log
  FOR DELETE TO authenticated, anon USING (true);

GRANT ALL ON schedule_manager_reminder_log TO anon;
GRANT ALL ON schedule_manager_reminder_log TO authenticated;
GRANT ALL ON schedule_manager_reminder_log TO service_role;

CREATE INDEX IF NOT EXISTS idx_schedule_manager_reminder_log_partner_id ON schedule_manager_reminder_log(partner_id);
CREATE INDEX IF NOT EXISTS idx_schedule_manager_reminder_log_manager_id ON schedule_manager_reminder_log(responsible_manager_id);
CREATE INDEX IF NOT EXISTS idx_schedule_manager_reminder_log_active ON schedule_manager_reminder_log(is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_manager_reminder_log_unique_active 
  ON schedule_manager_reminder_log(partner_id, responsible_manager_id, branch_scope_hash) 
  WHERE is_active = true;


-- =====================================================
-- PART 5: Create schedule_decline_reasons table
-- =====================================================

CREATE TABLE IF NOT EXISTS schedule_decline_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  reason_text text NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE schedule_decline_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_decline_reasons_select" ON schedule_decline_reasons
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "schedule_decline_reasons_insert" ON schedule_decline_reasons
  FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "schedule_decline_reasons_update" ON schedule_decline_reasons
  FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "schedule_decline_reasons_delete" ON schedule_decline_reasons
  FOR DELETE TO authenticated, anon USING (true);

GRANT ALL ON schedule_decline_reasons TO anon;
GRANT ALL ON schedule_decline_reasons TO authenticated;
GRANT ALL ON schedule_decline_reasons TO service_role;

CREATE INDEX IF NOT EXISTS idx_schedule_decline_reasons_partner_id ON schedule_decline_reasons(partner_id);
CREATE INDEX IF NOT EXISTS idx_schedule_decline_reasons_active ON schedule_decline_reasons(is_active) WHERE is_active = true;


-- =====================================================
-- PART 6: Create schedule_shift_assignments table
-- =====================================================

CREATE TABLE IF NOT EXISTS schedule_shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES schedule_shifts(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  assignment_status text DEFAULT 'pending_confirm' NOT NULL 
    CHECK (assignment_status IN ('pending_confirm', 'confirmed', 'declined')),
  confirmed_at timestamptz,
  declined_at timestamptz,
  decline_reason_id uuid REFERENCES schedule_decline_reasons(id) ON DELETE SET NULL,
  decline_comment text,
  actor_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  notification_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shift_id, employee_id)
);

ALTER TABLE schedule_shift_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_shift_assignments_select" ON schedule_shift_assignments
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "schedule_shift_assignments_insert" ON schedule_shift_assignments
  FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "schedule_shift_assignments_update" ON schedule_shift_assignments
  FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "schedule_shift_assignments_delete" ON schedule_shift_assignments
  FOR DELETE TO authenticated, anon USING (true);

GRANT ALL ON schedule_shift_assignments TO anon;
GRANT ALL ON schedule_shift_assignments TO authenticated;
GRANT ALL ON schedule_shift_assignments TO service_role;

CREATE INDEX IF NOT EXISTS idx_schedule_shift_assignments_shift_id ON schedule_shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_schedule_shift_assignments_employee_id ON schedule_shift_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_schedule_shift_assignments_partner_id ON schedule_shift_assignments(partner_id);
CREATE INDEX IF NOT EXISTS idx_schedule_shift_assignments_status ON schedule_shift_assignments(assignment_status);
CREATE INDEX IF NOT EXISTS idx_schedule_shift_assignments_pending 
  ON schedule_shift_assignments(partner_id, employee_id) 
  WHERE assignment_status = 'pending_confirm';


-- =====================================================
-- PART 7: Create schedule_employee_reminder_log table
-- =====================================================

CREATE TABLE IF NOT EXISTS schedule_employee_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  schedule_period_key text NOT NULL,
  telegram_chat_id text,
  telegram_message_id bigint,
  event_id uuid,
  is_active boolean DEFAULT true NOT NULL,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE schedule_employee_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_employee_reminder_log_select" ON schedule_employee_reminder_log
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "schedule_employee_reminder_log_insert" ON schedule_employee_reminder_log
  FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "schedule_employee_reminder_log_update" ON schedule_employee_reminder_log
  FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "schedule_employee_reminder_log_delete" ON schedule_employee_reminder_log
  FOR DELETE TO authenticated, anon USING (true);

GRANT ALL ON schedule_employee_reminder_log TO anon;
GRANT ALL ON schedule_employee_reminder_log TO authenticated;
GRANT ALL ON schedule_employee_reminder_log TO service_role;

CREATE INDEX IF NOT EXISTS idx_schedule_employee_reminder_log_partner_id ON schedule_employee_reminder_log(partner_id);
CREATE INDEX IF NOT EXISTS idx_schedule_employee_reminder_log_employee_id ON schedule_employee_reminder_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_schedule_employee_reminder_log_active ON schedule_employee_reminder_log(is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_employee_reminder_log_unique_active 
  ON schedule_employee_reminder_log(partner_id, employee_id, schedule_period_key) 
  WHERE is_active = true;


-- =====================================================
-- PART 8: Create schedule_unfilled_shift_notifications table
-- =====================================================

CREATE TABLE IF NOT EXISTS schedule_unfilled_shift_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES schedule_shifts(id) ON DELETE CASCADE,
  responsible_manager_id uuid REFERENCES schedule_responsible_managers(id) ON DELETE SET NULL,
  telegram_chat_id text,
  telegram_message_id bigint,
  event_id uuid,
  is_active boolean DEFAULT true NOT NULL,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE schedule_unfilled_shift_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_unfilled_shift_notifications_select" ON schedule_unfilled_shift_notifications
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "schedule_unfilled_shift_notifications_insert" ON schedule_unfilled_shift_notifications
  FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "schedule_unfilled_shift_notifications_update" ON schedule_unfilled_shift_notifications
  FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "schedule_unfilled_shift_notifications_delete" ON schedule_unfilled_shift_notifications
  FOR DELETE TO authenticated, anon USING (true);

GRANT ALL ON schedule_unfilled_shift_notifications TO anon;
GRANT ALL ON schedule_unfilled_shift_notifications TO authenticated;
GRANT ALL ON schedule_unfilled_shift_notifications TO service_role;

CREATE INDEX IF NOT EXISTS idx_schedule_unfilled_shift_notifications_partner_id ON schedule_unfilled_shift_notifications(partner_id);
CREATE INDEX IF NOT EXISTS idx_schedule_unfilled_shift_notifications_shift_id ON schedule_unfilled_shift_notifications(shift_id);
CREATE INDEX IF NOT EXISTS idx_schedule_unfilled_shift_notifications_active ON schedule_unfilled_shift_notifications(is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_unfilled_shift_notifications_unique_active 
  ON schedule_unfilled_shift_notifications(partner_id, shift_id, responsible_manager_id) 
  WHERE is_active = true;


-- =====================================================
-- PART 9: Create schedule_action_logs table
-- =====================================================

CREATE TABLE IF NOT EXISTS schedule_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  actor_type text NOT NULL CHECK (actor_type IN ('employee', 'manager', 'system')),
  actor_id uuid,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE schedule_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_action_logs_select" ON schedule_action_logs
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "schedule_action_logs_insert" ON schedule_action_logs
  FOR INSERT TO authenticated, anon WITH CHECK (true);

GRANT ALL ON schedule_action_logs TO anon;
GRANT ALL ON schedule_action_logs TO authenticated;
GRANT ALL ON schedule_action_logs TO service_role;

CREATE INDEX IF NOT EXISTS idx_schedule_action_logs_partner_id ON schedule_action_logs(partner_id);
CREATE INDEX IF NOT EXISTS idx_schedule_action_logs_actor_id ON schedule_action_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_schedule_action_logs_action_type ON schedule_action_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_schedule_action_logs_target ON schedule_action_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_schedule_action_logs_created_at ON schedule_action_logs(created_at DESC);


-- =====================================================
-- PART 10: Add is_published and publish_status to schedule_shifts
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'is_published'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN is_published boolean DEFAULT false NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN published_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'confirmation_status'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN confirmation_status text DEFAULT 'not_required'
      CHECK (confirmation_status IN ('not_required', 'pending', 'confirmed', 'declined', 'partially_confirmed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedule_shifts_is_published ON schedule_shifts(is_published);
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_confirmation_status ON schedule_shifts(confirmation_status);


-- =====================================================
-- PART 11: Enable realtime for new tables
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE schedule_responsible_managers;
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_responsible_branches;
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_shift_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_decline_reasons;


-- =====================================================
-- PART 12: Insert default decline reasons for existing partners
-- =====================================================

INSERT INTO schedule_decline_reasons (partner_id, reason_text, sort_order)
SELECT p.id, reason.text, reason.ord
FROM partners p
CROSS JOIN (
  VALUES 
    ('Болею', 1),
    ('Семейные обстоятельства', 2),
    ('Учеба/экзамены', 3),
    ('Другая работа', 4),
    ('Другая причина', 5)
) AS reason(text, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM schedule_decline_reasons sdr 
  WHERE sdr.partner_id = p.id
)
ON CONFLICT DO NOTHING;
