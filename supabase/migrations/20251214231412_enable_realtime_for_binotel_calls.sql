/*
  # Enable Realtime for binotel_calls table

  1. Changes
    - Enable realtime replication for binotel_calls table
    - This allows the frontend to receive instant notifications when new calls are created or updated
*/

alter publication supabase_realtime add table binotel_calls;
