/*
  # Add edit mode to external courier registration states

  1. Changes
    - Add `is_editing` (boolean) - flag to indicate if user is editing existing data
    - Add `courier_id` (uuid) - ID of courier being edited
  
  2. Purpose
    - Support /editregis command for external couriers to update their registration data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_courier_registration_states' AND column_name = 'is_editing'
  ) THEN
    ALTER TABLE external_courier_registration_states ADD COLUMN is_editing boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_courier_registration_states' AND column_name = 'courier_id'
  ) THEN
    ALTER TABLE external_courier_registration_states ADD COLUMN courier_id uuid;
  END IF;
END $$;