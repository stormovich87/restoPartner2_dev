/*
  # Allow multiple polls per day

  1. Changes
    - Drop unique constraint on (partner_id, courier_id, response_date)
    - Add new unique constraint including is_scheduled flag
    - This allows both manual and automatic polls on the same day
    - Prevents duplicate scheduled polls on the same day
    - Allows multiple manual polls on the same day

  2. Notes
    - Unique constraint: (partner_id, courier_id, response_date, is_scheduled)
    - One scheduled poll per day: is_scheduled = true
    - Unlimited manual polls per day: is_scheduled = false
*/

-- Drop old unique constraint
ALTER TABLE external_courier_polling_responses 
DROP CONSTRAINT IF EXISTS external_courier_polling_responses_partner_id_courier_id_response_;

-- Add new unique constraint including is_scheduled
-- This ensures only one scheduled poll per day but allows multiple manual polls
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_scheduled_poll_per_day
  ON external_courier_polling_responses(partner_id, courier_id, response_date, is_scheduled)
  WHERE is_scheduled = true;