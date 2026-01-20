/*
  # Add is_first field to payroll periods for strict period linking

  1. Changes
    - Add `is_first` boolean field to kpi_payroll_periods table
    - Add `period_order` integer field for ordering periods
    - Add unique index to ensure only one first period per partner
    - Add unique constraint for period_order per partner
    - Mark earliest existing period as first for each partner (if any exist)

  2. Purpose
    - Enable strict period linking where periods cannot overlap
    - First period is special and cannot be deleted
    - Each subsequent period starts exactly where previous period ended
    - Period order ensures chronological integrity
*/

-- Add is_first field to mark the initial period
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kpi_payroll_periods' AND column_name = 'is_first'
  ) THEN
    ALTER TABLE kpi_payroll_periods ADD COLUMN is_first boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add period_order field for strict ordering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kpi_payroll_periods' AND column_name = 'period_order'
  ) THEN
    ALTER TABLE kpi_payroll_periods ADD COLUMN period_order integer;
  END IF;
END $$;

-- Mark the earliest period as first for each partner that has periods
UPDATE kpi_payroll_periods p1
SET is_first = true
WHERE id IN (
  SELECT id FROM kpi_payroll_periods p2
  WHERE p2.partner_id = p1.partner_id
  ORDER BY p2.period_start ASC
  LIMIT 1
);

-- Set period_order based on period_start for existing periods
WITH ordered_periods AS (
  SELECT 
    id,
    partner_id,
    ROW_NUMBER() OVER (PARTITION BY partner_id ORDER BY period_start ASC) as order_num
  FROM kpi_payroll_periods
)
UPDATE kpi_payroll_periods p
SET period_order = op.order_num
FROM ordered_periods op
WHERE p.id = op.id;

-- Create unique partial index to ensure only one first period per partner
CREATE UNIQUE INDEX IF NOT EXISTS unique_first_period_per_partner 
ON kpi_payroll_periods(partner_id) 
WHERE is_first = true;

-- Add unique constraint for period_order per partner
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_period_order_per_partner'
  ) THEN
    ALTER TABLE kpi_payroll_periods
    ADD CONSTRAINT unique_period_order_per_partner 
    UNIQUE (partner_id, period_order);
  END IF;
END $$;

-- Create index for efficient period lookups
CREATE INDEX IF NOT EXISTS idx_kpi_payroll_periods_first ON kpi_payroll_periods(partner_id, is_first) WHERE is_first = true;
CREATE INDEX IF NOT EXISTS idx_kpi_payroll_periods_order ON kpi_payroll_periods(partner_id, period_order);

-- Add comment explaining the constraints
COMMENT ON COLUMN kpi_payroll_periods.is_first IS 'Marks the first period of the chain. Only one first period per partner. Cannot be deleted.';
COMMENT ON COLUMN kpi_payroll_periods.period_order IS 'Sequential order of periods. Used to maintain strict chronological ordering.';
