/*
  # Add Poll Runs System

  1. New Table `external_courier_poll_runs`
    - Tracks each polling session/run (auto or manual)
    - Only one active run per partner at a time
    - `id` (uuid) - Primary key
    - `partner_id` (uuid) - Foreign key to partners
    - `run_type` (text) - 'auto' or 'manual'
    - `run_date` (date) - Date in Europe/Sofia timezone
    - `run_started_at` (timestamptz) - When the poll was started
    - `is_active` (boolean) - Whether this is the current active run
    - `created_at` (timestamptz) - Creation timestamp

  2. Modify `external_courier_polling_responses`
    - Add `poll_run_id` (uuid) - Foreign key to poll_runs
    - Change unique constraint to include poll_run_id
    - Keep backward compatibility

  3. Security
    - Enable RLS on new table
    - Add appropriate policies
    - Grant permissions
*/

-- Create poll runs table
CREATE TABLE IF NOT EXISTS external_courier_poll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  run_type text NOT NULL CHECK (run_type IN ('auto', 'manual')),
  run_date date NOT NULL,
  run_started_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create index for finding active runs
CREATE INDEX IF NOT EXISTS idx_poll_runs_partner_active 
  ON external_courier_poll_runs(partner_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_poll_runs_partner_date 
  ON external_courier_poll_runs(partner_id, run_date);

-- Enable RLS
ALTER TABLE external_courier_poll_runs ENABLE ROW LEVEL SECURITY;

-- Policies for poll_runs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'external_courier_poll_runs' AND policyname = 'Allow select for authenticated users'
  ) THEN
    CREATE POLICY "Allow select for authenticated users"
      ON external_courier_poll_runs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'external_courier_poll_runs' AND policyname = 'Allow insert for authenticated users'
  ) THEN
    CREATE POLICY "Allow insert for authenticated users"
      ON external_courier_poll_runs
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'external_courier_poll_runs' AND policyname = 'Allow update for authenticated users'
  ) THEN
    CREATE POLICY "Allow update for authenticated users"
      ON external_courier_poll_runs
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'external_courier_poll_runs' AND policyname = 'Allow anon select'
  ) THEN
    CREATE POLICY "Allow anon select"
      ON external_courier_poll_runs
      FOR SELECT
      TO anon
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'external_courier_poll_runs' AND policyname = 'Allow anon insert'
  ) THEN
    CREATE POLICY "Allow anon insert"
      ON external_courier_poll_runs
      FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'external_courier_poll_runs' AND policyname = 'Allow anon update'
  ) THEN
    CREATE POLICY "Allow anon update"
      ON external_courier_poll_runs
      FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON external_courier_poll_runs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON external_courier_poll_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON external_courier_poll_runs TO service_role;

-- Add poll_run_id to external_courier_polling_responses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_courier_polling_responses' AND column_name = 'poll_run_id'
  ) THEN
    ALTER TABLE external_courier_polling_responses ADD COLUMN poll_run_id uuid REFERENCES external_courier_poll_runs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop old unique constraint and create new one
DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'external_courier_polling_responses_partner_id_courier_id_respo'
  ) THEN
    ALTER TABLE external_courier_polling_responses 
      DROP CONSTRAINT external_courier_polling_responses_partner_id_courier_id_respo;
  END IF;

  -- Create new unique constraint with poll_run_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'external_courier_polling_responses_run_courier_unique'
  ) THEN
    ALTER TABLE external_courier_polling_responses 
      ADD CONSTRAINT external_courier_polling_responses_run_courier_unique 
      UNIQUE (poll_run_id, courier_id);
  END IF;
END $$;

-- Create index for responses by poll_run_id
CREATE INDEX IF NOT EXISTS idx_polling_responses_poll_run 
  ON external_courier_polling_responses(poll_run_id, is_active);

-- Enable realtime for poll_runs
ALTER PUBLICATION supabase_realtime ADD TABLE external_courier_poll_runs;

-- Function to create new poll run and deactivate previous
CREATE OR REPLACE FUNCTION create_poll_run(
  p_partner_id uuid,
  p_run_type text DEFAULT 'manual'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run_date date;
  v_new_run_id uuid;
BEGIN
  -- Get current date in Europe/Sofia timezone
  v_run_date := get_date_in_timezone('Europe/Sofia');
  
  -- Deactivate all previous active runs for this partner
  UPDATE external_courier_poll_runs
  SET is_active = false
  WHERE partner_id = p_partner_id AND is_active = true;
  
  -- Create new active run
  INSERT INTO external_courier_poll_runs (
    partner_id,
    run_type,
    run_date,
    is_active
  ) VALUES (
    p_partner_id,
    p_run_type,
    v_run_date,
    true
  )
  RETURNING id INTO v_new_run_id;
  
  RETURN v_new_run_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_poll_run(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION create_poll_run(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_poll_run(uuid, text) TO service_role;

-- Function to get current active poll run
CREATE OR REPLACE FUNCTION get_active_poll_run(p_partner_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run_id uuid;
BEGIN
  SELECT id INTO v_run_id
  FROM external_courier_poll_runs
  WHERE partner_id = p_partner_id 
    AND is_active = true
  LIMIT 1;
  
  -- If no active run exists, create one
  IF v_run_id IS NULL THEN
    v_run_id := create_poll_run(p_partner_id, 'manual');
  END IF;
  
  RETURN v_run_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_poll_run(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_active_poll_run(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_poll_run(uuid) TO service_role;
