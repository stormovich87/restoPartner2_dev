/*
  # Add missing fields to binotel_calls table
  
  ## Overview
  This migration adds missing fields to the binotel_calls table that are being used
  by edge functions but were not present in the schema.
  
  ## Changes
  1. Add `client_phone` field (copy of external_number for compatibility)
  2. Add `branch_id` field (reference to branches)
  3. Add `notification_phone` field (for UI notifications)
  4. Add `notification_shown` field (tracking if notification was displayed)
  5. Add `staff_internal_number` field (staff member's internal number)
  6. Add `answered_at` field (when call was answered)
  7. Add `duration_seconds` field (call duration)
  8. Add `external_id` field (Binotel's call identifier)
  9. Create trigger to auto-sync client_phone from external_number
  
  ## Security
  - No RLS changes needed (already configured)
*/

-- Add missing fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'client_phone'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN client_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'notification_phone'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN notification_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'notification_shown'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN notification_shown boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'staff_internal_number'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN staff_internal_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'answered_at'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN answered_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN duration_seconds integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN external_id text;
  END IF;
END $$;

-- Sync existing data: copy external_number to client_phone
UPDATE binotel_calls 
SET client_phone = external_number 
WHERE client_phone IS NULL AND external_number IS NOT NULL;

-- Create function to auto-sync client_phone from external_number
CREATE OR REPLACE FUNCTION sync_binotel_client_phone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.external_number IS NOT NULL THEN
    NEW.client_phone := NEW.external_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-sync on insert and update
DROP TRIGGER IF EXISTS trigger_sync_binotel_client_phone ON binotel_calls;
CREATE TRIGGER trigger_sync_binotel_client_phone
  BEFORE INSERT OR UPDATE ON binotel_calls
  FOR EACH ROW
  EXECUTE FUNCTION sync_binotel_client_phone();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_binotel_calls_branch_id ON binotel_calls(branch_id);
CREATE INDEX IF NOT EXISTS idx_binotel_calls_client_phone ON binotel_calls(client_phone);
CREATE INDEX IF NOT EXISTS idx_binotel_calls_notification ON binotel_calls(partner_id, notification_shown, created_at DESC) 
  WHERE notification_shown = false;
CREATE INDEX IF NOT EXISTS idx_binotel_calls_external_id ON binotel_calls(external_id);
