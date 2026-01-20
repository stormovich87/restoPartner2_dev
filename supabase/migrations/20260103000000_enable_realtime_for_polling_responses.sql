/*
  # Enable Realtime for External Courier Polling Responses

  1. Changes
    - Enable realtime for `external_courier_polling_responses` table
  
  2. Purpose
    - Allow dashboard to update active courier count in real-time
    - Update courier status modal when responses change
*/

ALTER PUBLICATION supabase_realtime ADD TABLE external_courier_polling_responses;
