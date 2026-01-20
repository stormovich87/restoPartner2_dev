/*
  # Add Cabinet Login/Password Fields to Employee Registration States

  1. New Columns
    - `cabinet_login` (text) - Login being set during registration
    - `cabinet_password` (text) - Password being set during registration

  2. Notes
    - These fields store temporary login/password during registration flow
    - After successful registration, they are saved to the employees table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_registration_states' AND column_name = 'cabinet_login'
  ) THEN
    ALTER TABLE employee_registration_states ADD COLUMN cabinet_login text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_registration_states' AND column_name = 'cabinet_password'
  ) THEN
    ALTER TABLE employee_registration_states ADD COLUMN cabinet_password text;
  END IF;
END $$;