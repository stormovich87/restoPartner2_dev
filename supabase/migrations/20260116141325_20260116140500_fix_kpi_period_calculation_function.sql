/*
  # Fix KPI Period Calculation Function

  ## Summary
  This migration fixes a type casting error in the calculate_current_kpi_period function.
  
  ## Issue
  The original function had type mismatches when adding integers to timestamps.
  PostgreSQL requires explicit type casts for date arithmetic operations.

  ## Changes
  - Fixed date arithmetic by properly casting to date type before adding days
  - Added explicit interval casting for day additions
  - Improved month boundary calculations

  ## Security
  - No changes to RLS policies
  - Function remains SECURITY DEFINER
*/

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

  -- If no settings found, return NULL
  IF v_period_type IS NULL THEN
    RETURN;
  END IF;

  -- Get current time in partner timezone
  v_now := now();
  v_now_local := (v_now AT TIME ZONE v_timezone)::timestamp;

  -- Calculate based on period type
  IF v_period_type = 'week' THEN
    -- Weekly period: calculate start of current week based on first_day_of_week
    -- PostgreSQL: EXTRACT(DOW FROM date) returns 0=Sunday, 1=Monday, ..., 6=Saturday
    -- Our setting: 1=Monday, 2=Tuesday, ..., 7=Sunday
    v_current_day_of_week := EXTRACT(DOW FROM v_now_local)::integer;

    -- Convert our setting (1=Mon...7=Sun) to PostgreSQL (0=Sun...6=Sat)
    IF v_first_day_of_week = 7 THEN
      v_days_since_week_start := v_current_day_of_week;
    ELSE
      v_days_since_week_start := (v_current_day_of_week - v_first_day_of_week + 7) % 7;
    END IF;

    -- Start of week at 00:00:00
    v_start := ((v_now_local::date - v_days_since_week_start)::timestamp AT TIME ZONE v_timezone);
    v_end := v_start + interval '7 days';

  ELSIF v_period_type = 'month' THEN
    -- Monthly period: from close_day to close_day
    -- Calculate the close day in the current month
    v_last_close_day := (date_trunc('month', v_now_local::date)::date + (v_month_close_day - 1) * interval '1 day')::date;
    v_next_close_day := ((date_trunc('month', v_now_local::date) + interval '1 month')::date + (v_month_close_day - 1) * interval '1 day')::date;

    -- If we're before the close day this month, period is from last month's close day
    IF v_now_local::date < v_last_close_day THEN
      v_start := (((date_trunc('month', v_now_local::date) - interval '1 month')::date + (v_month_close_day - 1) * interval '1 day')::timestamp AT TIME ZONE v_timezone);
      v_end := (v_last_close_day::timestamp AT TIME ZONE v_timezone);
    ELSE
      v_start := (v_last_close_day::timestamp AT TIME ZONE v_timezone);
      v_end := (v_next_close_day::timestamp AT TIME ZONE v_timezone);
    END IF;

  ELSIF v_period_type = 'custom' THEN
    -- Custom N-day periods from anchor date
    -- If no anchor date set, use today as anchor
    IF v_anchor_date IS NULL THEN
      v_anchor_date := (v_now_local::date::timestamp AT TIME ZONE v_timezone);

      -- Update anchor date in settings
      UPDATE partner_settings
      SET kpi_payroll_anchor_date = v_anchor_date
      WHERE partner_id = p_partner_id;
    END IF;

    -- Calculate how many days since anchor
    v_days_since_anchor := ((v_now_local::date) - ((v_anchor_date AT TIME ZONE v_timezone)::date));

    -- Calculate which period number we're in (0-based)
    v_period_number := FLOOR(v_days_since_anchor::numeric / v_custom_days);

    -- Calculate start and end of current period
    v_start := (((v_anchor_date AT TIME ZONE v_timezone)::date + (v_period_number * v_custom_days) * interval '1 day')::timestamp AT TIME ZONE v_timezone);
    v_end := v_start + (v_custom_days * interval '1 day');

  ELSE
    -- Default to monthly if invalid type
    v_last_close_day := date_trunc('month', v_now_local::date)::date;
    v_next_close_day := (date_trunc('month', v_now_local::date) + interval '1 month')::date;

    IF v_now_local::date < v_last_close_day THEN
      v_start := ((date_trunc('month', v_now_local::date) - interval '1 month')::timestamp AT TIME ZONE v_timezone);
      v_end := (v_last_close_day::timestamp AT TIME ZONE v_timezone);
    ELSE
      v_start := (v_last_close_day::timestamp AT TIME ZONE v_timezone);
      v_end := (v_next_close_day::timestamp AT TIME ZONE v_timezone);
    END IF;
  END IF;

  RETURN QUERY SELECT v_start, v_end;
END;
$$;

-- Update the close period function as well
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
