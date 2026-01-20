/*
  # Trigger to Reset Shift Reminders on Time Change

  1. Purpose
    - When shift start_time or end_time changes, delete old reminder messages
    - Reset reminder flags (reminder_before_sent_at, reminder_late_sent_at)
    - Clear reminder_message_ids array
    - This allows new reminders to be sent at the updated time

  2. Functionality
    - Triggers on UPDATE of schedule_shifts
    - Checks if start_time or end_time changed
    - Deletes old Telegram messages if chat_id and message_ids exist
    - Resets all reminder-related fields
*/

-- Function to delete reminder messages and reset flags
CREATE OR REPLACE FUNCTION reset_shift_reminders_on_time_change()
RETURNS TRIGGER AS $$
DECLARE
  bot_token TEXT;
  message_id BIGINT;
BEGIN
  -- Check if start_time or end_time changed
  IF OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.end_time IS DISTINCT FROM NEW.end_time THEN
    
    -- Get bot token for this partner
    SELECT employee_bot_token INTO bot_token
    FROM partner_settings
    WHERE partner_id = NEW.partner_id;
    
    -- Delete old reminder messages if they exist
    IF OLD.reminder_chat_id IS NOT NULL AND OLD.reminder_message_ids IS NOT NULL AND jsonb_array_length(OLD.reminder_message_ids) > 0 AND bot_token IS NOT NULL THEN
      
      -- Loop through message IDs and delete each one
      FOR message_id IN SELECT jsonb_array_elements_text(OLD.reminder_message_ids)::BIGINT
      LOOP
        BEGIN
          -- Call Telegram API to delete message
          PERFORM net.http_post(
            url := 'https://api.telegram.org/bot' || bot_token || '/deleteMessage',
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := jsonb_build_object(
              'chat_id', OLD.reminder_chat_id,
              'message_id', message_id
            )
          );
        EXCEPTION WHEN OTHERS THEN
          -- Log error but continue (message might be already deleted)
          RAISE NOTICE 'Failed to delete message %: %', message_id, SQLERRM;
        END;
      END LOOP;
      
    END IF;
    
    -- Reset reminder fields
    NEW.reminder_before_sent_at := NULL;
    NEW.reminder_late_sent_at := NULL;
    NEW.reminder_message_ids := '[]'::jsonb;
    NEW.reminder_chat_id := NULL;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_reset_shift_reminders_on_time_change ON schedule_shifts;

-- Create trigger
CREATE TRIGGER trigger_reset_shift_reminders_on_time_change
  BEFORE UPDATE ON schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION reset_shift_reminders_on_time_change();
