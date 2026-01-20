/*
  # Fix polling responses unique constraint

  1. Changes
    - Drop old unique constraint with correct name
    - Add new unique index for scheduled polls only
    - This allows both manual and automatic polls on the same day
*/

-- Drop old unique constraint with correct name
ALTER TABLE external_courier_polling_responses 
DROP CONSTRAINT IF EXISTS external_courier_polling_resp_partner_id_courier_id_respons_key;

-- Add new unique constraint including is_scheduled
-- This ensures only one scheduled poll per day but allows multiple manual polls
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_scheduled_poll_per_day
  ON external_courier_polling_responses(partner_id, courier_id, response_date, is_scheduled)
  WHERE is_scheduled = true;