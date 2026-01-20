/*
  # Add Shift Confirmation Indicator to KPI System

  ## Overview
  This migration adds documentation for the "Shift Confirmation" indicator type.
  The indicator tracks employees' shift confirmation behavior.

  ## Shift Confirmation Indicator

  ### Purpose
  Tracks whether employees confirm their shifts in a timely manner.

  ### Triggers
  - `unconfirmed_open_shift` - Open shift without confirmation (within active and past periods)
  - `unconfirmed_closed_shift` - Closed shift without confirmation (within active and past periods)

  ### Configuration (stored in kpi_indicator_rank_settings.config)
  - `unconfirmed_limit_shifts` (int) - Maximum number of unconfirmed shifts allowed per period
    - Each trigger reduces the indicator score by: 100 / unconfirmed_limit_shifts
    - Example: If limit is 5, each unconfirmed shift reduces score by 20%

  ### Minimum Passing Percent
  - If the indicator score falls below the minimum percent, the indicator is set to 0%

  ### Section Calculation
  The HR Indicator section percent is calculated as:
  - If both "Punctuality" and "Shift Confirmation" are enabled: average of both indicators
  - If only one is enabled: that indicator's percent
  - Each indicator can be enabled/disabled independently

  ## Implementation Notes
  - Uses existing table structure (kpi_indicator_catalog, kpi_template_indicators, kpi_indicator_rank_settings)
  - Frontend will handle the logic for calculating indicator scores based on triggers
  - Database stores the configuration, frontend calculates the results
*/

-- Add comment to catalog table to document the new indicator type
COMMENT ON TABLE kpi_indicator_catalog IS
'Catalog of available KPI indicators.

Supported indicators:
- punctuality: Tracks employee punctuality (late arrivals, no-shows)
- shift_confirmation: Tracks shift confirmation behavior (unconfirmed open/closed shifts)';

-- Add comment to rank settings config field
COMMENT ON COLUMN kpi_indicator_rank_settings.config IS
'Indicator-specific configuration stored as JSONB.

For punctuality indicator:
{
  "late_limit_shifts": <number> - Maximum allowed late shifts per period
}

For shift_confirmation indicator:
{
  "unconfirmed_limit_shifts": <number> - Maximum allowed unconfirmed shifts per period
}';