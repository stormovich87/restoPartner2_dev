/*
  # Enable realtime for positions table

  1. Changes
    - Enable realtime replication for positions table to allow live updates of staff permissions
*/

-- Enable realtime for positions table
ALTER PUBLICATION supabase_realtime ADD TABLE positions;
