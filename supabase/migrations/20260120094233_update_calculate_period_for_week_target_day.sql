/*
  # Update Period Calculation for Week Target Day

  ## Summary
  Updates the calculate_current_kpi_period function to support weekly periods
  that align to a specific target day of the week.

  ## Changes
  1. Modified calculate_current_kpi_period function:
    - For 'week' type, uses kpi_payroll_week_target_day
    - First period aligns from any start date to the next target day
    - Subsequent periods are exactly 7 days ending on target day

  ## Logic
  - If target is Tuesday (2):
    - First period: Today → Next Tuesday
    - Second period: Next Tuesday → Following Tuesday (7 days)
    - And so on...

  ## Example
  - Target day: Tuesday (2)
  - Today: Friday, Jan 19
  - First period: Jan 19 → Jan 23 (next Tuesday) = 5 days
  - Second period: Jan 23 → Jan 30 (next Tuesday) = 7 days
  - Third period: Jan 30 → Feb 6 (next Tuesday) = 7 days
*/

-- Drop and recreate the function with new logic
DROP FUNCTION IF EXISTS calculate_current_kpi_period(uuid);

CREATE OR REPLACE FUNCTION calculate_current_kpi_period(p_partner_id uuid)
RETURNS TABLE(period_start timestamptz, period_end timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_type text;
  v_first_day_of_week integer;
  v_week_target_day integer;
  v_month_close_day integer;
  v_custom_days integer;
  v_anchor_date timestamptz;
  v_timezone text;
  v_now timestamptz;
  v_now_local timestamp;
  v_start timestamptz;
  v_end timestamptz;
  v_current_day_of_week integer;
  v_days_until_target integer;
  v_last_period_end timestamptz;
  v_last_close_day date;
  v_next_close_day date;
  v_days_since_anchor integer;
  v_period_number integer;
BEGIN
  -- Get partner settings
  SELECT
    COALESCE(ps.kpi_payroll_period_type, 'month'),
    COALESCE(ps.kpi_payroll_first_day_of_week, 1),
    COALESCE(ps.kpi_payroll_week_target_day, 7),
    COALESCE(ps.kpi_payroll_month_close_day, 1),
    COALESCE(ps.kpi_payroll_custom_days, 14),
    ps.kpi_payroll_anchor_date,
    COALESCE(ps.timezone, 'UTC')
  INTO
    v_period_type,
    v_first_day_of_week,
    v_week_target_day,
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
    -- Weekly period: align to target day of week
    -- Check if there's a last closed period
    SELECT period_end INTO v_last_period_end
    FROM kpi_payroll_periods
    WHERE partner_id = p_partner_id
      AND status = 'closed'
    ORDER BY period_end DESC
    LIMIT 1;

    IF v_last_period_end IS NOT NULL THEN
      -- There's a previous period, start from its end
      v_start := v_last_period_end;
      -- Next period is exactly 7 days
      v_end := v_start + interval '7 days';
    ELSE
      -- First period - align to target day
      -- PostgreSQL: EXTRACT(DOW FROM date) returns 0=Sunday, 1=Monday, ..., 6=Saturday
      -- Our setting: 1=Monday, 2=Tuesday, ..., 7=Sunday
      v_current_day_of_week := EXTRACT(DOW FROM v_now_local);
      
      -- Convert to our format (1=Mon...7=Sun)
      IF v_current_day_of_week = 0 THEN
        v_current_day_of_week := 7;
      END IF;

      -- Calculate days until target day
      -- If target is Tuesday (2) and today is Friday (5): (2 - 5 + 7) % 7 = 4 days
      -- If target is Tuesday (2) and today is Tuesday (2): (2 - 2 + 7) % 7 = 0, so we use 7
      v_days_until_target := (v_week_target_day - v_current_day_of_week + 7) % 7;
      
      -- If today is the target day, set period to end in 7 days (next occurrence)
      IF v_days_until_target = 0 THEN
        v_days_until_target := 7;
      END IF;

      -- Start from today at 00:00:00
      v_start := v_now_local::date AT TIME ZONE v_timezone;
      -- End on the target day at 23:59:59
      v_end := (v_now_local::date + v_days_until_target) AT TIME ZONE v_timezone;
    END IF;

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

COMMENT ON FUNCTION calculate_current_kpi_period IS 'Calculates current active period boundaries based on partner settings. For weekly periods, aligns to target day of week.';
