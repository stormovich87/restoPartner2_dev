/*
  # Add name column to staff_members

  1. Changes
    - Add `name` generated column to staff_members that concatenates first_name and last_name
    - This allows existing queries to work without modification

  2. Notes
    - Generated column is automatically computed from first_name and last_name
    - Stored as a generated column for better query performance
*/

-- Add name generated column to staff_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'name'
  ) THEN
    ALTER TABLE staff_members 
    ADD COLUMN name text GENERATED ALWAYS AS (
      CASE 
        WHEN last_name IS NOT NULL AND last_name != '' 
        THEN first_name || ' ' || last_name
        ELSE first_name
      END
    ) STORED;
  END IF;
END $$;
