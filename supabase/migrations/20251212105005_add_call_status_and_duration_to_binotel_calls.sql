/*
  # Add call status and duration tracking
  
  1. Changes
    - Add call_status column (active, completed, missed)
    - Add call_started_at timestamp
    - Add call_ended_at timestamp
    - Add call_duration_seconds
    
  2. Security
    - No RLS changes needed (already configured)
*/

-- Add call status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'call_status'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN call_status text DEFAULT 'active';
  END IF;
END $$;

-- Add call timestamps
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'call_started_at'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN call_started_at timestamptz DEFAULT now();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'call_ended_at'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN call_ended_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'call_duration_seconds'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN call_duration_seconds integer;
  END IF;
END $$;

-- Create index for filtering by status
CREATE INDEX IF NOT EXISTS idx_binotel_calls_status ON binotel_calls(call_status);
CREATE INDEX IF NOT EXISTS idx_binotel_calls_partner_status ON binotel_calls(partner_id, call_status);
