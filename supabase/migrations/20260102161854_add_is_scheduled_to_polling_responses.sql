/*
  # Add is_scheduled flag to polling responses

  1. Changes
    - Add `is_scheduled` column to track if poll was sent automatically vs manually
    - Update cron function to only check scheduled polls when deciding to send
    - This allows both manual and automatic polls to be sent on the same day

  2. How it works
    - Manual polls: is_scheduled = false
    - Automatic polls: is_scheduled = true
    - Cron checks only for is_scheduled = true to avoid duplicate automatic sends
    - Manual sends can happen anytime without blocking automatic sends
*/

-- Add is_scheduled column
ALTER TABLE external_courier_polling_responses 
ADD COLUMN IF NOT EXISTS is_scheduled boolean DEFAULT false;

-- Update existing records to mark them as manual
UPDATE external_courier_polling_responses 
SET is_scheduled = false 
WHERE is_scheduled IS NULL;