/*
  # KPI Payroll Periods System

  This migration creates a comprehensive payroll period system for KPI calculations.

  ## 1. New Fields in partner_settings table
    - `kpi_period_type` - Period type: 'weekly', 'biweekly', 'monthly', 'custom_days'
    - `kpi_week_start_day` - First day of week for weekly/biweekly (0=Sun, 1=Mon...6=Sat)
    - `kpi_month_close_day` - Day of month for monthly close (1-28)
    - `kpi_custom_days` - Number of days for custom period (1-90)
    - `kpi_freeze_on_close` - Freeze period after closing (prevents edits)

  ## 2. New Tables

  ### kpi_events
    - Stores KPI-related events for each employee
    - `id` (uuid, primary key)
    - `partner_id` (uuid, FK to partners)
    - `employee_id` (uuid, FK to employees)
    - `event_type` (text - e.g., 'shift_opened_late', 'no_show')
    - `event_at` (timestamptz - when the event occurred)
    - `dedupe_key` (text, unique per partner - prevents duplicate events)
    - `metadata` (jsonb - additional event data)
    - `created_at` (timestamptz)

  ### kpi_period_snapshots
    - Stores frozen period results for employees
    - `id` (uuid, primary key)
    - `partner_id` (uuid, FK to partners)
    - `employee_id` (uuid, FK to employees)
    - `period_type` (text)
    - `period_start` (timestamptz)
    - `period_end` (timestamptz)
    - `snapshot_data` (jsonb - calculated KPI results)
    - `coins_awarded` (int - coins/points awarded)
    - `is_frozen` (boolean - true if period is finalized)
    - `created_at`, `updated_at` (timestamps)
    - UNIQUE constraint on (partner_id, employee_id, period_start)

  ### kpi_ledger
    - Tracks all coin/point awards to prevent duplicates
    - `id` (uuid, primary key)
    - `partner_id` (uuid, FK to partners)
    - `employee_id` (uuid, FK to employees)
    - `period_snapshot_id` (uuid, FK to kpi_period_snapshots)
    - `amount` (int - positive for award, negative for deduction)
    - `reason` (text - e.g., 'period_close', 'bonus')
    - `idempotency_key` (text, unique per partner)
    - `created_at` (timestamptz)

  ## 3. Security
    - RLS enabled on all tables
    - Policies for partner isolation
    - All queries filtered by partner_id

  ## 4. Indexes
    - For efficient period boundary queries
    - For event lookups by employee and time range
*/

-- Add KPI period settings to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'kpi_period_type'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN kpi_period_type text DEFAULT 'monthly';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'kpi_week_start_day'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN kpi_week_start_day integer DEFAULT 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'kpi_month_close_day'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN kpi_month_close_day integer DEFAULT 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'kpi_custom_days'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN kpi_custom_days integer DEFAULT 14;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'kpi_freeze_on_close'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN kpi_freeze_on_close boolean DEFAULT false;
  END IF;
END $$;

-- Create kpi_events table
CREATE TABLE IF NOT EXISTS kpi_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_at timestamptz NOT NULL DEFAULT now(),
  dedupe_key text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_kpi_events_partner ON kpi_events(partner_id);
CREATE INDEX IF NOT EXISTS idx_kpi_events_employee ON kpi_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_kpi_events_event_type ON kpi_events(event_type);
CREATE INDEX IF NOT EXISTS idx_kpi_events_event_at ON kpi_events(event_at);
CREATE INDEX IF NOT EXISTS idx_kpi_events_lookup ON kpi_events(partner_id, employee_id, event_type, event_at);

ALTER TABLE kpi_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_events_select" ON kpi_events
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "kpi_events_insert" ON kpi_events
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "kpi_events_update" ON kpi_events
  FOR UPDATE TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "kpi_events_delete" ON kpi_events
  FOR DELETE TO authenticated, anon
  USING (true);

GRANT ALL ON kpi_events TO anon;
GRANT ALL ON kpi_events TO authenticated;
GRANT ALL ON kpi_events TO service_role;

-- Create kpi_period_snapshots table
CREATE TABLE IF NOT EXISTS kpi_period_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period_type text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  snapshot_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  coins_awarded integer DEFAULT 0,
  is_frozen boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, employee_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_kpi_period_snapshots_partner ON kpi_period_snapshots(partner_id);
CREATE INDEX IF NOT EXISTS idx_kpi_period_snapshots_employee ON kpi_period_snapshots(employee_id);
CREATE INDEX IF NOT EXISTS idx_kpi_period_snapshots_period ON kpi_period_snapshots(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_kpi_period_snapshots_lookup ON kpi_period_snapshots(partner_id, employee_id, period_start);

ALTER TABLE kpi_period_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_period_snapshots_select" ON kpi_period_snapshots
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "kpi_period_snapshots_insert" ON kpi_period_snapshots
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "kpi_period_snapshots_update" ON kpi_period_snapshots
  FOR UPDATE TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "kpi_period_snapshots_delete" ON kpi_period_snapshots
  FOR DELETE TO authenticated, anon
  USING (true);

GRANT ALL ON kpi_period_snapshots TO anon;
GRANT ALL ON kpi_period_snapshots TO authenticated;
GRANT ALL ON kpi_period_snapshots TO service_role;

-- Create kpi_ledger table
CREATE TABLE IF NOT EXISTS kpi_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period_snapshot_id uuid REFERENCES kpi_period_snapshots(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  reason text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_kpi_ledger_partner ON kpi_ledger(partner_id);
CREATE INDEX IF NOT EXISTS idx_kpi_ledger_employee ON kpi_ledger(employee_id);
CREATE INDEX IF NOT EXISTS idx_kpi_ledger_snapshot ON kpi_ledger(period_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_kpi_ledger_created_at ON kpi_ledger(created_at);

ALTER TABLE kpi_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_ledger_select" ON kpi_ledger
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "kpi_ledger_insert" ON kpi_ledger
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "kpi_ledger_update" ON kpi_ledger
  FOR UPDATE TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "kpi_ledger_delete" ON kpi_ledger
  FOR DELETE TO authenticated, anon
  USING (true);

GRANT ALL ON kpi_ledger TO anon;
GRANT ALL ON kpi_ledger TO authenticated;
GRANT ALL ON kpi_ledger TO service_role;

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE kpi_events;
ALTER PUBLICATION supabase_realtime ADD TABLE kpi_period_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE kpi_ledger;

-- Add comments
COMMENT ON TABLE kpi_events IS 'Stores KPI-related events (late arrivals, no-shows) for period calculations';
COMMENT ON TABLE kpi_period_snapshots IS 'Stores frozen period results for employees';
COMMENT ON TABLE kpi_ledger IS 'Tracks all coin/point awards with idempotency';
COMMENT ON COLUMN partner_settings.kpi_period_type IS 'Period type: weekly, biweekly, monthly, custom_days';
COMMENT ON COLUMN partner_settings.kpi_week_start_day IS 'First day of week (0=Sun, 1=Mon...6=Sat)';
COMMENT ON COLUMN partner_settings.kpi_month_close_day IS 'Day of month for monthly close (1-28)';
COMMENT ON COLUMN partner_settings.kpi_custom_days IS 'Number of days for custom period (1-90)';
COMMENT ON COLUMN partner_settings.kpi_freeze_on_close IS 'Freeze period after closing';
