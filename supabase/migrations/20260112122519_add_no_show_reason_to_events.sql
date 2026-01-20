/*
  # Add no_show_reason_text to employee_events

  1. Changes
    - Add `no_show_reason_text` field to employee_events table
    - This field stores the reason text for no-show events so responsible persons can see it

  2. Security
    - No RLS changes needed - inherits existing policies
*/

-- Add no_show_reason_text to employee_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_events' AND column_name = 'no_show_reason_text'
  ) THEN
    ALTER TABLE employee_events ADD COLUMN no_show_reason_text text;
  END IF;
END $$;
