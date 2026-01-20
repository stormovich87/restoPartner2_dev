/*
  # Add login and password to external courier registration states

  1. Changes
    - Add `cabinet_login` column to external_courier_registration_states
    - Add `cabinet_password` column to external_courier_registration_states
    
  2. Notes
    - These fields store login/password during registration process
    - Values are transferred to couriers table upon registration completion
*/

ALTER TABLE external_courier_registration_states 
ADD COLUMN IF NOT EXISTS cabinet_login text,
ADD COLUMN IF NOT EXISTS cabinet_password text;
