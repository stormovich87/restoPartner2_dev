/*
  # Add Callback Detection Function
  
  ## Overview
  This migration adds a function to automatically detect callbacks for missed calls
  based on Binotel data.
  
  ## Function: detect_callbacks_for_call
  When an outgoing call is made, this function checks if it's a callback to a missed call:
  - Finds missed incoming calls from the same phone number
  - Within the callback timeout period
  - Marks them as having received a callback
  - Prevents them from becoming "lost"
  
  ## Trigger
  - Automatically runs when a new outgoing call (is_outgoing=true) is inserted
  - Or when a call is updated to outgoing status
  
  ## Logic
  1. Check if call is outgoing
  2. Find recent missed calls to same number
  3. Check if within callback timeout
  4. Mark missed call as callback_made
  5. Link calls together
*/

-- Function to detect if outgoing call is a callback
CREATE OR REPLACE FUNCTION detect_callbacks_for_call()
RETURNS TRIGGER AS $$
DECLARE
  missed_call_record RECORD;
  timeout_minutes integer;
BEGIN
  -- Only process outgoing calls
  IF NEW.is_outgoing = false THEN
    RETURN NEW;
  END IF;
  
  -- Get callback timeout from partner settings
  SELECT callback_timeout_minutes INTO timeout_minutes
  FROM partner_settings
  WHERE partner_id = NEW.partner_id;
  
  IF timeout_minutes IS NULL THEN
    timeout_minutes := 30;
  END IF;
  
  -- Find recent missed incoming calls from same number
  FOR missed_call_record IN
    SELECT id, created_at, completed_at
    FROM binotel_calls
    WHERE partner_id = NEW.partner_id
      AND client_phone = NEW.client_phone
      AND is_missed = true
      AND is_callback_made = false
      AND is_outgoing = false
      AND (
        completed_at IS NOT NULL AND completed_at < NEW.created_at
        OR completed_at IS NULL AND created_at < NEW.created_at
      )
    ORDER BY COALESCE(completed_at, created_at) DESC
    LIMIT 1
  LOOP
    -- Check if callback is within timeout period
    IF NEW.created_at <= COALESCE(missed_call_record.completed_at, missed_call_record.created_at) + (timeout_minutes || ' minutes')::INTERVAL THEN
      -- Mark missed call as having callback
      UPDATE binotel_calls
      SET 
        is_callback_made = true,
        callback_at = NEW.created_at,
        callback_call_id = NEW.id,
        is_lost = false
      WHERE id = missed_call_record.id;
      
      -- Log the callback detection
      RAISE NOTICE 'Callback detected: outgoing call % is callback for missed call %', NEW.id, missed_call_record.id;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to detect callbacks on insert/update
DROP TRIGGER IF EXISTS trigger_detect_callbacks ON binotel_calls;
CREATE TRIGGER trigger_detect_callbacks
  AFTER INSERT OR UPDATE ON binotel_calls
  FOR EACH ROW
  WHEN (NEW.is_outgoing = true)
  EXECUTE FUNCTION detect_callbacks_for_call();

-- Function to get missed calls count
CREATE OR REPLACE FUNCTION get_missed_calls_count(p_partner_id uuid)
RETURNS integer AS $$
DECLARE
  count_result integer;
BEGIN
  SELECT COUNT(*) INTO count_result
  FROM binotel_calls
  WHERE partner_id = p_partner_id
    AND is_missed = true
    AND is_callback_made = false
    AND is_lost = false
    AND is_outgoing = false;
  
  RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get lost calls count
CREATE OR REPLACE FUNCTION get_lost_calls_count(p_partner_id uuid)
RETURNS integer AS $$
DECLARE
  count_result integer;
BEGIN
  SELECT COUNT(*) INTO count_result
  FROM binotel_calls
  WHERE partner_id = p_partner_id
    AND is_lost = true
    AND is_outgoing = false;
  
  RETURN COALESCE(count_result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_missed_calls_count(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_lost_calls_count(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mark_lost_calls() TO authenticated, anon, service_role;
