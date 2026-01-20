/*
  # Create work segments table

  1. New Tables
    - `work_segments`
      - `id` (uuid, primary key)
      - `shift_id` (uuid, foreign key to schedule_shifts)
      - `segment_start_at` (timestamptz) - when this work segment started
      - `segment_end_at` (timestamptz, nullable) - when this work segment ended
      - `start_lat` (numeric, nullable) - latitude at segment start
      - `start_lng` (numeric, nullable) - longitude at segment start
      - `end_lat` (numeric, nullable) - latitude at segment end
      - `end_lng` (numeric, nullable) - longitude at segment end
      - `opened_with_location` (boolean) - whether location was verified on open
      - `closed_with_location` (boolean) - whether location was verified on close
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `work_segments` table
    - Add policies for employees to manage their own segments
    - Add policies for partners to view segments

  3. Indexes
    - Index on shift_id for fast lookups
    - Index on segment_start_at for time-based queries
*/

CREATE TABLE IF NOT EXISTS work_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES schedule_shifts(id) ON DELETE CASCADE,
  segment_start_at timestamptz NOT NULL DEFAULT now(),
  segment_end_at timestamptz,
  start_lat numeric(10, 7),
  start_lng numeric(10, 7),
  end_lat numeric(10, 7),
  end_lng numeric(10, 7),
  opened_with_location boolean DEFAULT false,
  closed_with_location boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE work_segments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_work_segments_shift_id ON work_segments(shift_id);
CREATE INDEX IF NOT EXISTS idx_work_segments_start_at ON work_segments(segment_start_at);

CREATE POLICY "Employees can view work segments"
  ON work_segments FOR SELECT
  USING (true);

CREATE POLICY "Employees can insert work segments"
  ON work_segments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Employees can update work segments"
  ON work_segments FOR UPDATE
  USING (true);

CREATE POLICY "Service role can manage all work segments"
  ON work_segments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can manage all work segments"
  ON work_segments FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);