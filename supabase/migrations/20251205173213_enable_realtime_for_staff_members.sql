/*
  # Enable realtime for staff_members table

  1. Changes
    - Enable realtime replication for staff_members table to allow live updates of staff data
*/

-- Enable realtime for staff_members table
ALTER PUBLICATION supabase_realtime ADD TABLE staff_members;
