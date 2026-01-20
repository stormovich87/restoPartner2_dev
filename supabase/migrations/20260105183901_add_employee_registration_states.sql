/*
  # Add Employee Registration States

  1. New Tables
    - `employee_registration_states`
      - `telegram_user_id` (text, primary key)
      - `partner_id` (uuid, foreign key to partners)
      - `step` (text) - Current step in registration
      - `firstname` (text) - Employee's first name
      - `lastname` (text) - Employee's last name
      - `position_id` (uuid) - Selected position
      - `branch_id` (uuid) - Selected branch
      - `phone` (text) - Phone number
      - `email` (text) - Email address
      - `telegram_username` (text) - Telegram username
      - `card_number` (text) - Bank card number
      - `hire_date` (date) - Date of hire
      - `is_editing` (boolean) - Whether editing existing employee
      - `employee_id` (uuid) - ID of employee being edited
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on table
    - Add policies for anon and authenticated roles
*/

CREATE TABLE IF NOT EXISTS employee_registration_states (
  telegram_user_id text PRIMARY KEY,
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  step text NOT NULL,
  firstname text,
  lastname text,
  position_id uuid,
  branch_id uuid,
  phone text,
  email text,
  telegram_username text,
  card_number text,
  hire_date date,
  is_editing boolean DEFAULT false,
  employee_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employee_registration_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access"
  ON employee_registration_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON employee_registration_states TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON employee_registration_states TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON employee_registration_states TO service_role;
