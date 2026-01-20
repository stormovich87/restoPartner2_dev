/*
  # Auto-sync reminder times count

  1. Changes
    - Add trigger to automatically sync manager_reminders_times_per_day with array length
    - Add trigger to automatically sync employee_confirm_reminders_times_per_day with array length
  
  2. Security
    - No RLS changes needed (triggers run with elevated privileges)
*/

-- Function to sync reminder times count
CREATE OR REPLACE FUNCTION sync_reminder_times_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync manager reminders times per day with array length
  IF NEW.manager_reminders_at_times IS NOT NULL THEN
    NEW.manager_reminders_times_per_day := jsonb_array_length(NEW.manager_reminders_at_times);
  END IF;
  
  -- Sync employee confirm reminders times per day with array length
  IF NEW.employee_confirm_reminders_at_times IS NOT NULL THEN
    NEW.employee_confirm_reminders_times_per_day := jsonb_array_length(NEW.employee_confirm_reminders_at_times);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on partner_settings
DROP TRIGGER IF EXISTS sync_reminder_times_count_trigger ON partner_settings;
CREATE TRIGGER sync_reminder_times_count_trigger
  BEFORE INSERT OR UPDATE ON partner_settings
  FOR EACH ROW
  EXECUTE FUNCTION sync_reminder_times_count();