/*
  # Enable realtime for work_segments

  1. Changes
    - Enable realtime updates for work_segments table
*/

ALTER PUBLICATION supabase_realtime ADD TABLE work_segments;