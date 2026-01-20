/*
  # Add invite_code to registration states

  1. Changes
    - Add `invite_code` column to `external_courier_registration_states` table
    - This allows tracking which invite was used during registration
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_courier_registration_states' AND column_name = 'invite_code'
  ) THEN
    ALTER TABLE external_courier_registration_states ADD COLUMN invite_code text;
  END IF;
END $$;