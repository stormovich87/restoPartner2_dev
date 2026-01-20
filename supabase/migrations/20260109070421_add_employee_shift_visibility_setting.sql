/*
  # Add employee shift visibility setting

  1. Changes
    - Add `employee_shift_visibility_days` to partner_settings table
      - Default value: 2 days
      - Controls how many days ahead to show shifts in employee cabinet
  
  2. Notes
    - This setting determines how many days in advance employees can see their upcoming shifts
    - Default is 2 days (today + 2 days forward)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'employee_shift_visibility_days'
  ) THEN
    ALTER TABLE partner_settings 
    ADD COLUMN employee_shift_visibility_days integer DEFAULT 2 NOT NULL;
  END IF;
END $$;