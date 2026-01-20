/*
  # Add is_outgoing column to binotel_calls

  1. Changes
    - Add `is_outgoing` boolean column to `binotel_calls` table
    - Default value is false
    - Calculated based on call_type (1 = outgoing, 0 = incoming)
    
  2. Notes
    - This column is needed for BinotelContext to distinguish between incoming and outgoing calls
    - Edge function already tries to insert this field
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'is_outgoing'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN is_outgoing boolean DEFAULT false;
    
    -- Update existing records based on call_type
    UPDATE binotel_calls SET is_outgoing = (call_type = 1);
  END IF;
END $$;
