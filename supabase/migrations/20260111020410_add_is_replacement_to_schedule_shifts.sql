/*
  # Add replacement tracking fields to schedule_shifts

  1. New Fields
    - `is_replacement` - Boolean flag indicating if this shift is a replacement shift
    - `original_shift_id` - UUID reference to the original no-show shift being replaced

  2. Purpose
    - Track replacement shifts in the schedule
    - Link replacement shifts to their original no-show shifts
    - Enable visual indication of replacement shifts in UI
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'is_replacement'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN is_replacement boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_shifts' AND column_name = 'original_shift_id'
  ) THEN
    ALTER TABLE schedule_shifts ADD COLUMN original_shift_id uuid REFERENCES schedule_shifts(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedule_shifts_is_replacement ON schedule_shifts(is_replacement) WHERE is_replacement = true;
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_original_shift_id ON schedule_shifts(original_shift_id) WHERE original_shift_id IS NOT NULL;
