/*
  # Add Week Target Day for Payroll Periods

  ## Summary
  Adds a new field to partner_settings for configuring which day of the week 
  payroll periods should end on for weekly period type.

  ## Changes
  1. New Column in partner_settings table:
    - `kpi_payroll_week_target_day` (integer, default 7) - Target day of week for period end (1=Mon...7=Sun)

  ## Purpose
  - Allows partners to select which day of the week their weekly periods should end on
  - First period is "aligning" - from current date to the target weekday
  - Subsequent periods are exactly 7 days, ending on the target weekday
  - Example: If target is Tuesday, periods end every Tuesday

  ## Implementation Notes
  - Field only applies when kpi_payroll_period_type = 'week'
  - Default is 7 (Sunday) to maintain backward compatibility
  - Used by calculate_current_kpi_period function to determine period boundaries
*/

-- Add week target day field to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'kpi_payroll_week_target_day'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN kpi_payroll_week_target_day integer DEFAULT 7;
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN partner_settings.kpi_payroll_week_target_day IS 
'Target day of week for weekly period end (1=Monday...7=Sunday). 
First period aligns to this day, subsequent periods are 7 days ending on this day.';

-- Add constraint to ensure valid day (1-7)
ALTER TABLE partner_settings 
ADD CONSTRAINT check_kpi_payroll_week_target_day 
CHECK (kpi_payroll_week_target_day >= 1 AND kpi_payroll_week_target_day <= 7);
