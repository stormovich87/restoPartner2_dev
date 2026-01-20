/*
  # Grant DELETE permission on work_segments for anon role

  1. Problem
    - Trigger reset_shift_status_on_time_change deletes work_segments
    - Anon role doesn't have DELETE permission
    - This causes "permission denied for table work_segments" error

  2. Solution
    - Grant DELETE permission on work_segments to anon role
    - Add RLS policy for DELETE
*/

GRANT DELETE ON work_segments TO anon;

CREATE POLICY "Allow delete work segments for partner shifts"
  ON work_segments
  FOR DELETE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM schedule_shifts ss
      WHERE ss.id = work_segments.shift_id
    )
  );
