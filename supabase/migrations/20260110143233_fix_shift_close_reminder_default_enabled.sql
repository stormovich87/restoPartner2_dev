/*
  # Fix shift close reminder default to enabled

  1. Problem
    - Field `shift_close_reminder_enabled` has default = false
    - Function `send_shift_reminders()` only sends close reminders when this flag is true
    - Users have this setting disabled by default causing reminders and auto-close to not work

  2. Solution
    - Change default to true
    - Update all existing NULL/false values to true

  3. Changes
    - Modified: partner_settings.shift_close_reminder_enabled - change default to true
    - Updated all existing records to have shift_close_reminder_enabled = true
*/

-- Update all existing records to enable close reminders
UPDATE partner_settings
SET shift_close_reminder_enabled = true
WHERE shift_close_reminder_enabled IS NULL 
   OR shift_close_reminder_enabled = false;

-- Change default for new records
ALTER TABLE partner_settings
ALTER COLUMN shift_close_reminder_enabled SET DEFAULT true;

-- Update column to NOT NULL since it should always have a value
ALTER TABLE partner_settings
ALTER COLUMN shift_close_reminder_enabled SET NOT NULL;
