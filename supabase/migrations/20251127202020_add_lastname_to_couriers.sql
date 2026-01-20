/*
  # Add lastname column to couriers table

  1. Changes
    - Add `lastname` column to `couriers` table to store courier's last name separately
    - Default value is empty string
    - Not nullable to maintain data integrity

  2. Notes
    - This allows storing first name and last name separately for better data organization
    - Telegram bot registration process collects full name which is split into first and last name
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'lastname'
  ) THEN
    ALTER TABLE couriers ADD COLUMN lastname text NOT NULL DEFAULT '';
  END IF;
END $$;