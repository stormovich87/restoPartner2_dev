/*
  # Add Late Threshold Minutes to KPI Indicators

  ## Summary
  Adds configuration field for minimum late minutes threshold to trigger
  the "Опоздания" (late arrivals) indicator.

  ## Changes
  1. New Column in kpi_template_indicators table:
    - `late_threshold_minutes` (integer, default 0) - Minimum minutes late required to trigger

  ## Purpose
  - Allows configuring when lateness should count as a trigger
  - Example: if set to 15, only lateness >= 15 minutes counts
  - Default 0 means any lateness counts

  ## Implementation Notes
  - Field applies only to 'late_arrivals' indicator
  - Used during KPI calculation to filter late events
*/

-- Add late_threshold_minutes field to kpi_template_indicators
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kpi_template_indicators' AND column_name = 'late_threshold_minutes'
  ) THEN
    ALTER TABLE kpi_template_indicators ADD COLUMN late_threshold_minutes integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN kpi_template_indicators.late_threshold_minutes IS 
'Minimum minutes late required to trigger the late_arrivals indicator. 
Only applies to late_arrivals indicator. 0 means any lateness counts.';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_kpi_template_indicators_late_threshold 
ON kpi_template_indicators(late_threshold_minutes) 
WHERE indicator_key = 'late_arrivals';
