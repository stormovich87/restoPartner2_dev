/*
  # Shift Confirmation Workflow Enhancement
  
  This migration adds fields to support a comprehensive shift confirmation 
  workflow with employee confirmations, cancellations, and late decline handling.

  ## 1. New Fields in schedule_shifts Table
  
  ### Confirmation Fields
    - `confirmation_requested_at` (timestamptz) - when confirmation was requested
    - `confirmed_at` (timestamptz) - when employee confirmed the shift
    - `declined_at` (timestamptz) - when employee declined the shift
    - `decline_reason` (text) - reason for declining
    - `decline_is_late` (boolean) - whether decline was too late (past deadline)
  
  ### Responsible Decision Fields (for late declines)
    - `decided_by_responsible_id` (uuid) - manager who made decision
    - `decided_at` (timestamptz) - when decision was made
    - `responsible_decision` (text) - 'approved_cancel' or 'rejected_cancel'

  ## 2. Updated Confirmation Status
    - Added 'late_decline_pending' status to confirmation_status check constraint

  ## 3. Indexes
    - Index on confirmation_status for filtering
    - Index on decline_is_late for late decline queries

  ## 4. Notes
    - Uses existing schedule_confirm_deadline_hours from partner_settings
      as the threshold for late cancellations
    - When decline is late, requires responsible manager approval
*/

-- Add confirmation_requested_at to track when confirmation was requested
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'confirmation_requested_at'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN confirmation_requested_at timestamptz;
  END IF;
END $$;

-- Add confirmed_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN confirmed_at timestamptz;
  END IF;
END $$;

-- Add declined_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'declined_at'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN declined_at timestamptz;
  END IF;
END $$;

-- Add decline_reason text field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'decline_reason'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN decline_reason text;
  END IF;
END $$;

-- Add decline_is_late flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'decline_is_late'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN decline_is_late boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add decided_by_responsible_id for late decline decisions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'decided_by_responsible_id'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN decided_by_responsible_id uuid REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add decided_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'decided_at'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN decided_at timestamptz;
  END IF;
END $$;

-- Add responsible_decision field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'responsible_decision'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN responsible_decision text 
      CHECK (responsible_decision IS NULL OR responsible_decision IN ('approved_cancel', 'rejected_cancel'));
  END IF;
END $$;

-- Update confirmation_status check constraint to include 'late_decline_pending'
DO $$
BEGIN
  ALTER TABLE schedule_shifts DROP CONSTRAINT IF EXISTS schedule_shifts_confirmation_status_check;
  ALTER TABLE schedule_shifts ADD CONSTRAINT schedule_shifts_confirmation_status_check
    CHECK (confirmation_status IN ('not_required', 'pending', 'confirmed', 'declined', 'late_decline_pending', 'partially_confirmed'));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_decline_is_late 
  ON schedule_shifts(decline_is_late) WHERE decline_is_late = true;

CREATE INDEX IF NOT EXISTS idx_schedule_shifts_late_decline_pending 
  ON schedule_shifts(partner_id, confirmation_status) 
  WHERE confirmation_status = 'late_decline_pending';

CREATE INDEX IF NOT EXISTS idx_schedule_shifts_pending_confirmation 
  ON schedule_shifts(partner_id, date, confirmation_status) 
  WHERE confirmation_status = 'pending';
