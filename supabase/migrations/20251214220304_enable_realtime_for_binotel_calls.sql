/*
  # Enable realtime for binotel_calls table

  1. Changes
    - Add binotel_calls table to supabase_realtime publication
    
  2. Notes
    - This is required for realtime events to work
    - Without this, INSERT/UPDATE events won't be delivered to clients
*/

-- Enable realtime for binotel_calls
ALTER PUBLICATION supabase_realtime ADD TABLE binotel_calls;
