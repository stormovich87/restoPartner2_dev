/*
  # Add Binotel Call Tracking Fields
  
  ## Overview
  This migration adds fields to track missed and lost calls based on Binotel data.
  
  ## New Fields for binotel_calls
  1. **Call Status Tracking**
     - `is_callback_made` (boolean) - Whether outgoing callback was made
     - `callback_at` (timestamptz) - When callback was made
     - `callback_call_id` (uuid) - Reference to callback call record
     - `is_lost` (boolean) - Whether call is considered lost (no callback within time limit)
     - `lost_at` (timestamptz) - When call became lost
     - `callback_deadline` (timestamptz) - Deadline for callback (calculated from settings)
  
  2. **Partner Settings**
     - `callback_timeout_minutes` (integer) - Minutes before call becomes lost (default 30)
  
  ## Indexes
  - Index on is_missed + is_callback_made for missed calls without callback
  - Index on is_lost for lost calls reporting
  - Index on callback_deadline for automated status updates
  
  ## Function
  - `mark_lost_calls()` - Function to mark calls as lost when callback_deadline passes
  
  ## Security
  - No RLS changes needed (already configured)
*/

-- Add fields to binotel_calls
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'is_callback_made'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN is_callback_made boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'callback_at'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN callback_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'callback_call_id'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN callback_call_id uuid REFERENCES binotel_calls(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'is_lost'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN is_lost boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'lost_at'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN lost_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'callback_deadline'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN callback_deadline timestamptz;
  END IF;
END $$;

-- Add callback_timeout_minutes to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'callback_timeout_minutes'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN callback_timeout_minutes integer DEFAULT 30;
  END IF;
END $$;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_binotel_calls_missed_no_callback 
  ON binotel_calls(partner_id, is_missed, is_callback_made, created_at DESC) 
  WHERE is_missed = true AND is_callback_made = false;

CREATE INDEX IF NOT EXISTS idx_binotel_calls_lost 
  ON binotel_calls(partner_id, is_lost, created_at DESC) 
  WHERE is_lost = true;

CREATE INDEX IF NOT EXISTS idx_binotel_calls_callback_deadline 
  ON binotel_calls(callback_deadline) 
  WHERE callback_deadline IS NOT NULL AND is_callback_made = false AND is_lost = false;

CREATE INDEX IF NOT EXISTS idx_binotel_calls_callback_call_id 
  ON binotel_calls(callback_call_id) 
  WHERE callback_call_id IS NOT NULL;

-- Function to automatically mark calls as lost when deadline passes
CREATE OR REPLACE FUNCTION mark_lost_calls()
RETURNS void AS $$
BEGIN
  UPDATE binotel_calls
  SET 
    is_lost = true,
    lost_at = NOW()
  WHERE 
    is_missed = true
    AND is_callback_made = false
    AND is_lost = false
    AND callback_deadline < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to set callback_deadline on insert/update
CREATE OR REPLACE FUNCTION set_callback_deadline()
RETURNS TRIGGER AS $$
DECLARE
  timeout_minutes integer;
BEGIN
  -- Only set deadline for missed incoming calls
  IF NEW.is_missed = true AND NEW.is_outgoing = false AND NEW.callback_deadline IS NULL THEN
    -- Get timeout from partner settings
    SELECT callback_timeout_minutes INTO timeout_minutes
    FROM partner_settings
    WHERE partner_id = NEW.partner_id;
    
    -- Default to 30 minutes if not set
    IF timeout_minutes IS NULL THEN
      timeout_minutes := 30;
    END IF;
    
    -- Set deadline based on call completed time or created time
    IF NEW.completed_at IS NOT NULL THEN
      NEW.callback_deadline := NEW.completed_at + (timeout_minutes || ' minutes')::INTERVAL;
    ELSE
      NEW.callback_deadline := NEW.created_at + (timeout_minutes || ' minutes')::INTERVAL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_callback_deadline ON binotel_calls;
CREATE TRIGGER trigger_set_callback_deadline
  BEFORE INSERT OR UPDATE ON binotel_calls
  FOR EACH ROW
  EXECUTE FUNCTION set_callback_deadline();
