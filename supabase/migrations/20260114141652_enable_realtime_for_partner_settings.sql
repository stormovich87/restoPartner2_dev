/*
  # Enable realtime for partner_settings table

  1. Changes
    - Enable realtime subscriptions for partner_settings table
    - This allows WorkSchedule component to receive instant updates when settings change
  
  2. Purpose
    - Ensures planning horizon and other settings are synchronized across all open tabs
    - Prevents stale data in the UI when settings are updated
*/

ALTER PUBLICATION supabase_realtime ADD TABLE partner_settings;
