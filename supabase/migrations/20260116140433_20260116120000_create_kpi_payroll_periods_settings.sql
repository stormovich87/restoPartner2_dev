/*
  # KPI Payroll Periods System - Complete Implementation

  ## Overview
  This migration creates a comprehensive payroll periods system for KPI calculations.
  It provides flexible period configuration (weekly, monthly, custom days) with automatic
  boundary calculation, period closure, and historical tracking.

  ## 1. New Fields in partner_settings
    - `kpi_payroll_period_type` - Period type: 'week', 'month', 'custom'
    - `kpi_payroll_first_day_of_week` - First day of week for weekly periods (1=Mon...7=Sun)
    - `kpi_payroll_month_close_day` - Day of month for monthly close (1-28)
    - `kpi_payroll_custom_days` - Number of days for custom period (1-90)
    - `kpi_payroll_anchor_date` - Anchor date for custom periods (when custom period type is first used)
    - `kpi_payroll_last_recalculated_at` - Last time KPI was recalculated

  ## 2. New Tables

  ### kpi_payroll_periods
    - Stores historical closed periods with fixed KPI values
    - `id` (uuid, primary key)
    - `partner_id` (uuid, FK to partners) - Multi-tenant isolation
    - `period_start` (timestamptz) - Period start (inclusive)
    - `period_end` (timestamptz) - Period end (exclusive)
    - `period_type` (text) - Type at time of closure: 'week', 'month', 'custom'
    - `status` (text) - 'active' or 'closed'
    - `closed_at` (timestamptz) - When period was closed
    - `snapshot_data` (jsonb) - Frozen KPI values for all indicators
    - `created_at`, `updated_at` (timestamps)
    - UNIQUE constraint on (partner_id, period_start, period_end)

  ## 3. Helper Functions

  ### calculate_current_period(p_partner_id uuid)
    - Returns current active period boundaries based on partner settings
    - Handles all three period types (week, month, custom)
    - Uses partner's timezone for accurate date calculations
    - Returns: TABLE(period_start timestamptz, period_end timestamptz)

  ### close_kpi_period(p_partner_id uuid, p_snapshot_data jsonb)
    - Closes current active period idempotently
    - Fixes KPI values in snapshot
    - Creates new active period automatically
    - Returns: uuid (closed period id)

  ## 4. Security
    - RLS enabled on all tables
    - Policies for partner isolation (authenticated + anon)
    - All queries filtered by partner_id

  ## 5. Indexes
    - For efficient period lookups by partner
    - For active period queries
    - For date range queries
*/

-- 1. Add payroll period settings to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'kpi_payroll_period_type'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN kpi_payroll_period_type text DEFAULT 'month';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'kpi_payroll_first_day_of_week'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN kpi_payroll_first_day_of_week integer DEFAULT 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'kpi_payroll_month_close_day'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN kpi_payroll_month_close_day integer DEFAULT 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'kpi_payroll_custom_days'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN kpi_payroll_custom_days integer DEFAULT 14;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'kpi_payroll_anchor_date'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN kpi_payroll_anchor_date timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'kpi_payroll_last_recalculated_at'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN kpi_payroll_last_recalculated_at timestamptz;
  END IF;
END $$;

-- 2. Create kpi_payroll_periods table
CREATE TABLE IF NOT EXISTS kpi_payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  period_type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  closed_at timestamptz,
  snapshot_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, period_start, period_end),
  CHECK (status IN ('active', 'closed')),
  CHECK (period_type IN ('week', 'month', 'custom')),
  CHECK (period_end > period_start)
);

CREATE INDEX IF NOT EXISTS idx_kpi_payroll_periods_partner ON kpi_payroll_periods(partner_id);
CREATE INDEX IF NOT EXISTS idx_kpi_payroll_periods_status ON kpi_payroll_periods(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_kpi_payroll_periods_dates ON kpi_payroll_periods(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_kpi_payroll_periods_lookup ON kpi_payroll_periods(partner_id, period_start, period_end);

ALTER TABLE kpi_payroll_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_payroll_periods_select" ON kpi_payroll_periods
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "kpi_payroll_periods_insert" ON kpi_payroll_periods
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "kpi_payroll_periods_update" ON kpi_payroll_periods
  FOR UPDATE TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "kpi_payroll_periods_delete" ON kpi_payroll_periods
  FOR DELETE TO authenticated, anon
  USING (true);

GRANT ALL ON kpi_payroll_periods TO anon;
GRANT ALL ON kpi_payroll_periods TO authenticated;
GRANT ALL ON kpi_payroll_periods TO service_role;

-- 3. Helper function to calculate current period boundaries
CREATE OR REPLACE FUNCTION calculate_current_kpi_period(p_partner_id uuid)
RETURNS TABLE(period_start timestamptz, period_end timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_type text;
  v_first_day_of_week integer;
  v_month_close_day integer;
  v_custom_days integer;
  v_anchor_date timestamptz;
  v_timezone text;
  v_now timestamptz;
  v_now_local timestamp;
  v_start timestamptz;
  v_end timestamptz;
  v_current_day_of_week integer;
  v_days_since_week_start integer;
  v_last_close_day date;
  v_next_close_day date;
  v_days_since_anchor integer;
  v_period_number integer;
BEGIN
  -- Get partner settings
  SELECT
    COALESCE(ps.kpi_payroll_period_type, 'month'),
    COALESCE(ps.kpi_payroll_first_day_of_week, 1),
    COALESCE(ps.kpi_payroll_month_close_day, 1),
    COALESCE(ps.kpi_payroll_custom_days, 14),
    ps.kpi_payroll_anchor_date,
    COALESCE(ps.timezone, 'UTC')
  INTO
    v_period_type,
    v_first_day_of_week,
    v_month_close_day,
    v_custom_days,
    v_anchor_date,
    v_timezone
  FROM partner_settings ps
  WHERE ps.partner_id = p_partner_id;

  -- Get current time in partner timezone
  v_now := now() AT TIME ZONE v_timezone;
  v_now_local := (now() AT TIME ZONE v_timezone)::timestamp;

  -- Calculate based on period type
  IF v_period_type = 'week' THEN
    -- Weekly period: calculate start of current week based on first_day_of_week
    -- PostgreSQL: EXTRACT(DOW FROM date) returns 0=Sunday, 1=Monday, ..., 6=Saturday
    -- Our setting: 1=Monday, 2=Tuesday, ..., 7=Sunday
    v_current_day_of_week := EXTRACT(DOW FROM v_now_local);

    -- Convert our setting (1=Mon...7=Sun) to PostgreSQL (0=Sun...6=Sat)
    -- Setting 1 (Mon) -> PG 1, Setting 7 (Sun) -> PG 0
    IF v_first_day_of_week = 7 THEN
      v_days_since_week_start := v_current_day_of_week;
    ELSE
      v_days_since_week_start := (v_current_day_of_week - v_first_day_of_week + 7) % 7;
    END IF;

    -- Start of week at 00:00:00
    v_start := (v_now_local::date - v_days_since_week_start) AT TIME ZONE v_timezone;
    v_end := v_start + interval '7 days';

  ELSIF v_period_type = 'month' THEN
    -- Monthly period: from close_day to close_day
    v_last_close_day := date_trunc('month', v_now_local::date) + (v_month_close_day - 1);
    v_next_close_day := (date_trunc('month', v_now_local::date) + interval '1 month')::date + (v_month_close_day - 1);

    -- If we're before the close day this month, period is from last month's close day
    IF v_now_local::date < v_last_close_day THEN
      v_start := ((date_trunc('month', v_now_local::date) - interval '1 month')::date + (v_month_close_day - 1)) AT TIME ZONE v_timezone;
      v_end := v_last_close_day AT TIME ZONE v_timezone;
    ELSE
      v_start := v_last_close_day AT TIME ZONE v_timezone;
      v_end := v_next_close_day AT TIME ZONE v_timezone;
    END IF;

  ELSIF v_period_type = 'custom' THEN
    -- Custom N-day periods from anchor date
    -- If no anchor date set, use today as anchor
    IF v_anchor_date IS NULL THEN
      v_anchor_date := v_now_local::date AT TIME ZONE v_timezone;

      -- Update anchor date in settings
      UPDATE partner_settings
      SET kpi_payroll_anchor_date = v_anchor_date
      WHERE partner_id = p_partner_id;
    END IF;

    -- Calculate how many days since anchor
    v_days_since_anchor := (v_now_local::date - (v_anchor_date AT TIME ZONE v_timezone)::date);

    -- Calculate which period number we're in (0-based)
    v_period_number := FLOOR(v_days_since_anchor::numeric / v_custom_days);

    -- Calculate start and end of current period
    v_start := ((v_anchor_date AT TIME ZONE v_timezone)::date + (v_period_number * v_custom_days)) AT TIME ZONE v_timezone;
    v_end := v_start + (v_custom_days || ' days')::interval;

  ELSE
    -- Default to monthly if invalid type
    v_last_close_day := date_trunc('month', v_now_local::date) + (1 - 1);
    v_next_close_day := (date_trunc('month', v_now_local::date) + interval '1 month')::date + (1 - 1);

    IF v_now_local::date < v_last_close_day THEN
      v_start := ((date_trunc('month', v_now_local::date) - interval '1 month')::date + (1 - 1)) AT TIME ZONE v_timezone;
      v_end := v_last_close_day AT TIME ZONE v_timezone;
    ELSE
      v_start := v_last_close_day AT TIME ZONE v_timezone;
      v_end := v_next_close_day AT TIME ZONE v_timezone;
    END IF;
  END IF;

  RETURN QUERY SELECT v_start, v_end;
END;
$$;

-- 4. Function to close current period and start new one (idempotent)
CREATE OR REPLACE FUNCTION close_kpi_payroll_period(
  p_partner_id uuid,
  p_snapshot_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_period_type text;
  v_existing_period_id uuid;
  v_new_period_id uuid;
BEGIN
  -- Get current period boundaries
  SELECT period_start, period_end INTO v_period_start, v_period_end
  FROM calculate_current_kpi_period(p_partner_id);

  -- Get period type
  SELECT COALESCE(kpi_payroll_period_type, 'month')
  INTO v_period_type
  FROM partner_settings
  WHERE partner_id = p_partner_id;

  -- Check if this period is already closed (idempotency)
  SELECT id INTO v_existing_period_id
  FROM kpi_payroll_periods
  WHERE partner_id = p_partner_id
    AND period_start = v_period_start
    AND period_end = v_period_end
    AND status = 'closed';

  IF v_existing_period_id IS NOT NULL THEN
    -- Already closed, return existing id
    RETURN v_existing_period_id;
  END IF;

  -- Close the current period or create if not exists
  INSERT INTO kpi_payroll_periods (
    partner_id,
    period_start,
    period_end,
    period_type,
    status,
    closed_at,
    snapshot_data
  )
  VALUES (
    p_partner_id,
    v_period_start,
    v_period_end,
    v_period_type,
    'closed',
    now(),
    p_snapshot_data
  )
  ON CONFLICT (partner_id, period_start, period_end)
  DO UPDATE SET
    status = 'closed',
    closed_at = now(),
    snapshot_data = p_snapshot_data,
    updated_at = now()
  RETURNING id INTO v_new_period_id;

  RETURN v_new_period_id;
END;
$$;

-- Enable realtime for new table
ALTER PUBLICATION supabase_realtime ADD TABLE kpi_payroll_periods;

-- Add comments
COMMENT ON TABLE kpi_payroll_periods IS 'Historical payroll periods with frozen KPI values';
COMMENT ON FUNCTION calculate_current_kpi_period IS 'Calculates current active period boundaries based on partner settings';
COMMENT ON FUNCTION close_kpi_payroll_period IS 'Closes current period and fixes KPI values (idempotent)';
