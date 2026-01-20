/*
  # Create courier registration states table

  1. New Tables
    - `courier_registration_states`
      - `telegram_user_id` (text, primary key) - Telegram user ID
      - `partner_id` (uuid) - Reference to partner
      - `step` (text) - Current registration step
      - `name` (text, nullable) - First name
      - `lastname` (text, nullable) - Last name
      - `phone` (text, nullable) - Phone number
      - `branch_id` (uuid, nullable) - Selected branch
      - `vehicle_type` (text, nullable) - Selected vehicle type
      - `created_at` (timestamptz) - When state was created
      - `updated_at` (timestamptz) - When state was last updated
  
  2. Security
    - Enable RLS on `courier_registration_states` table
    - Add policies for service role access
*/

CREATE TABLE IF NOT EXISTS courier_registration_states (
  telegram_user_id text PRIMARY KEY,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  step text NOT NULL,
  name text,
  lastname text,
  phone text,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  vehicle_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE courier_registration_states ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to courier registration states"
  ON courier_registration_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);