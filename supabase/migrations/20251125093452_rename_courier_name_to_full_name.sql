/*
  # Rename Courier Name Column to Full Name

  ## Summary
  Renames the `name` column in the `couriers` table to `full_name` to match
  the requirements specification.

  ## Changes
  - Rename `couriers.name` to `couriers.full_name`

  ## Notes
  - This is a safe operation that maintains data integrity
  - Existing courier records will retain their names
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'name'
  ) THEN
    ALTER TABLE couriers RENAME COLUMN name TO full_name;
  END IF;
END $$;
