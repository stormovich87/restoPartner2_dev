/*
  # Enable Realtime for Shifts Table

  ## Changes
  - Enable realtime replication for shifts table
  
  ## Purpose
  - Allow real-time updates in the dashboard for shift changes
  - Enable instant synchronization when shifts are opened or closed
*/

-- Enable realtime for shifts table
ALTER PUBLICATION supabase_realtime ADD TABLE shifts;