/*
  # Add selected couriers field to external courier polling

  1. Changes
    - Add `external_courier_polling_selected_couriers` field to `partner_settings` table
    - This stores an array of courier IDs that should receive the polling message
    - If NULL or empty, all active external couriers will receive the poll
  
  2. Purpose
    - Allow partners to save their courier selection for future polls
    - Avoid having to reselect couriers each time they send a poll
*/

-- Add field to store selected courier IDs for polling
ALTER TABLE partner_settings 
ADD COLUMN IF NOT EXISTS external_courier_polling_selected_couriers uuid[] DEFAULT NULL;