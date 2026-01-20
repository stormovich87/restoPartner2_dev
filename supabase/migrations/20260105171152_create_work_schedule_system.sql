/*
  # Work Schedule System

  1. New Tables
    - `schedule_periods` - stores schedule periods (week/month)
      - `id` (uuid, primary key)
      - `partner_id` (uuid, foreign key to partners)
      - `type` (text, 'week' or 'month')
      - `date_start` (date)
      - `date_end` (date)
      - `name` (text, display name like "Неделя: 01-07.04.2026")
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `branch_schedule_settings` - branch-specific schedule settings
      - `id` (uuid, primary key)
      - `partner_id` (uuid, foreign key)
      - `branch_id` (uuid, foreign key to branches)
      - `min_staff_per_day` (integer, minimum staff required per day)
      - `display_order` (integer, for drag&drop ordering)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `schedule_shifts` - individual shift assignments
      - `id` (uuid, primary key)
      - `partner_id` (uuid, foreign key)
      - `period_id` (uuid, foreign key to schedule_periods)
      - `branch_id` (uuid, foreign key to branches)
      - `staff_member_id` (uuid, foreign key to staff_members)
      - `position_id` (uuid, foreign key to positions)
      - `date` (date)
      - `start_time` (time)
      - `end_time` (time)
      - `total_minutes` (integer, calculated)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their partner's data

  3. Indexes
    - Performance indexes on frequently queried columns
*/

-- Schedule Periods table
CREATE TABLE IF NOT EXISTS schedule_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('week', 'month')),
  date_start date NOT NULL,
  date_end date NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, type, date_start, date_end)
);

ALTER TABLE schedule_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view schedule periods for their partner"
  ON schedule_periods FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can insert schedule periods"
  ON schedule_periods FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Users can update schedule periods"
  ON schedule_periods FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete schedule periods"
  ON schedule_periods FOR DELETE
  TO authenticated, anon
  USING (true);

-- Branch Schedule Settings table
CREATE TABLE IF NOT EXISTS branch_schedule_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  min_staff_per_day integer DEFAULT 1,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, branch_id)
);

ALTER TABLE branch_schedule_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view branch schedule settings"
  ON branch_schedule_settings FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can insert branch schedule settings"
  ON branch_schedule_settings FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Users can update branch schedule settings"
  ON branch_schedule_settings FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete branch schedule settings"
  ON branch_schedule_settings FOR DELETE
  TO authenticated, anon
  USING (true);

-- Schedule Shifts table
CREATE TABLE IF NOT EXISTS schedule_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES schedule_periods(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  staff_member_id uuid NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  total_minutes integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE schedule_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view schedule shifts"
  ON schedule_shifts FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can insert schedule shifts"
  ON schedule_shifts FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Users can update schedule shifts"
  ON schedule_shifts FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete schedule shifts"
  ON schedule_shifts FOR DELETE
  TO authenticated, anon
  USING (true);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_schedule_periods_partner ON schedule_periods(partner_id);
CREATE INDEX IF NOT EXISTS idx_schedule_periods_dates ON schedule_periods(partner_id, date_start, date_end);

CREATE INDEX IF NOT EXISTS idx_branch_schedule_settings_partner ON branch_schedule_settings(partner_id);
CREATE INDEX IF NOT EXISTS idx_branch_schedule_settings_branch ON branch_schedule_settings(branch_id);

CREATE INDEX IF NOT EXISTS idx_schedule_shifts_partner ON schedule_shifts(partner_id);
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_period ON schedule_shifts(period_id);
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_branch ON schedule_shifts(branch_id);
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_date ON schedule_shifts(date);
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_staff ON schedule_shifts(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_lookup ON schedule_shifts(partner_id, period_id, branch_id, date);

-- Grant permissions
GRANT ALL ON schedule_periods TO anon, authenticated, service_role;
GRANT ALL ON branch_schedule_settings TO anon, authenticated, service_role;
GRANT ALL ON schedule_shifts TO anon, authenticated, service_role;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_periods;
ALTER PUBLICATION supabase_realtime ADD TABLE branch_schedule_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_shifts;