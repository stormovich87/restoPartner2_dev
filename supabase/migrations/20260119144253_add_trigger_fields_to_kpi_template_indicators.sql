/*
  # Add Trigger Fields to KPI Template Indicators

  ## Changes
  Adds trigger_types and trigger_limit fields to kpi_template_indicators table
  to support indicator-level trigger configuration.

  ## New Fields
  - `minimum_indicator_percent` (int) - Minimum passing percent for the indicator
  - `trigger_types` (text[]) - Array of trigger types that this indicator tracks
  - `trigger_limit` (int) - Maximum number of triggers allowed per period

  ## Implementation Notes
  - These fields are added to support both "Punctuality" and "Shift Confirmation" indicators
  - Each indicator can have different trigger types and limits
  - The trigger_limit determines the step size for score reduction: 100 / trigger_limit
*/

-- Add new fields to kpi_template_indicators if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kpi_template_indicators' AND column_name = 'minimum_indicator_percent'
  ) THEN
    ALTER TABLE kpi_template_indicators ADD COLUMN minimum_indicator_percent int NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kpi_template_indicators' AND column_name = 'trigger_types'
  ) THEN
    ALTER TABLE kpi_template_indicators ADD COLUMN trigger_types text[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kpi_template_indicators' AND column_name = 'trigger_limit'
  ) THEN
    ALTER TABLE kpi_template_indicators ADD COLUMN trigger_limit int NOT NULL DEFAULT 4;
  END IF;
END $$;

-- Add index on trigger_types for faster queries
CREATE INDEX IF NOT EXISTS idx_kpi_template_indicators_trigger_types ON kpi_template_indicators USING GIN(trigger_types);

-- Add comments
COMMENT ON COLUMN kpi_template_indicators.minimum_indicator_percent IS 'Minimum percent required to pass this indicator. If score falls below, indicator is set to 0%.';
COMMENT ON COLUMN kpi_template_indicators.trigger_types IS 'Array of trigger types tracked by this indicator (e.g., no_show, late, unconfirmed_open_shift, unconfirmed_closed_shift)';
COMMENT ON COLUMN kpi_template_indicators.trigger_limit IS 'Maximum number of triggers allowed per period. Each trigger reduces score by: 100 / trigger_limit.';