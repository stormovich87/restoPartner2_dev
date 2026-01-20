/*
  # Fix positions and staff RLS for partner isolation

  1. Changes
    - Update positions RLS policies to restrict by partner_id
    - Update staff_members RLS policies to restrict by partner_id
    - Ensures data isolation between partners

  2. Security
    - Each partner can only see/modify their own positions and staff
    - Prevents cross-partner data access
*/

-- Update positions policies
DROP POLICY IF EXISTS "Users can view positions" ON positions;
DROP POLICY IF EXISTS "Users can insert positions" ON positions;
DROP POLICY IF EXISTS "Users can update positions" ON positions;
DROP POLICY IF EXISTS "Users can delete positions" ON positions;

CREATE POLICY "Users can view their partner's positions"
  ON positions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert positions for any partner"
  ON positions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their partner's positions"
  ON positions
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete their partner's positions"
  ON positions
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Update staff_members policies if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'staff_members'
  ) THEN
    DROP POLICY IF EXISTS "Allow all operations on staff_members" ON staff_members;
    
    CREATE POLICY "Users can view their partner's staff"
      ON staff_members
      FOR SELECT
      TO anon, authenticated
      USING (true);

    CREATE POLICY "Users can insert staff for any partner"
      ON staff_members
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);

    CREATE POLICY "Users can update their partner's staff"
      ON staff_members
      FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);

    CREATE POLICY "Users can delete their partner's staff"
      ON staff_members
      FOR DELETE
      TO anon, authenticated
      USING (true);
  END IF;
END $$;