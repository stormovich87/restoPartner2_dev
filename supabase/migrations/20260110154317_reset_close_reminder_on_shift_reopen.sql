/*
  # Reset close reminder fields when shift is reopened

  1. Problem
    - When employee closes and then reopens shift, status changes back to 'opened'
    - BUT close_reminder_sent_at and auto_closed fields are NOT reset
    - This causes send_shift_reminders() to skip the shift (it checks these fields are NULL/false)
    - Result: no close reminder is sent and no auto-close happens

  2. Solution
    - Add trigger that resets close reminder fields when shift status changes from 'closed' to 'opened'
    - Reset fields: close_reminder_sent_at, close_reminder_message_id, close_reminder_chat_id, auto_closed

  3. Changes
    - New function: reset_close_reminder_on_reopen()
    - New trigger: trigger_reset_close_reminder_on_reopen
*/

-- Function to reset close reminder fields when shift is reopened
CREATE OR REPLACE FUNCTION reset_close_reminder_on_reopen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bot_token TEXT;
BEGIN
  -- Check if status changed from 'closed' to 'opened'
  IF OLD.status = 'closed' AND NEW.status = 'opened' THEN
    
    -- Get bot token for message deletion
    SELECT employee_bot_token INTO bot_token
    FROM partner_settings
    WHERE partner_id = NEW.partner_id;
    
    -- Delete close reminder message if it exists
    IF OLD.close_reminder_message_id IS NOT NULL 
       AND OLD.close_reminder_chat_id IS NOT NULL 
       AND bot_token IS NOT NULL THEN
      
      BEGIN
        PERFORM delete_telegram_message(
          bot_token,
          OLD.close_reminder_chat_id,
          OLD.close_reminder_message_id
        );
        RAISE NOTICE 'Shift %: deleted close reminder message on reopen', NEW.id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Shift %: failed to delete close reminder message: %', NEW.id, SQLERRM;
      END;
    END IF;
    
    -- Reset close reminder fields
    NEW.close_reminder_sent_at := NULL;
    NEW.close_reminder_message_id := NULL;
    NEW.close_reminder_chat_id := NULL;
    NEW.auto_closed := false;
    NEW.closed_by := NULL;
    
    RAISE NOTICE 'Shift %: reset close reminder fields on reopen', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_reset_close_reminder_on_reopen ON schedule_shifts;
CREATE TRIGGER trigger_reset_close_reminder_on_reopen
  BEFORE UPDATE ON schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION reset_close_reminder_on_reopen();

COMMENT ON FUNCTION reset_close_reminder_on_reopen() IS
'Resets close reminder fields when shift status changes from closed to opened. This ensures reminders work correctly for reopened shifts.';
