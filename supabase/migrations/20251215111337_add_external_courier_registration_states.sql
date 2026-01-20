/*
  # Add External Courier Registration States Table

  1. New Table
    - `external_courier_registration_states` table:
      - `telegram_user_id` (text, primary key) - Telegram user ID
      - `partner_id` (uuid) - Partner ID
      - `step` (text) - Current registration step
      - `name` (text) - User's first name
      - `lastname` (text) - User's last name
      - `phone` (text) - User's phone number
      - `created_at` (timestamptz) - When registration started
      - `updated_at` (timestamptz) - Last update time

  2. Security
    - Enable RLS
    - Add policies for service role access only
*/

-- Create external courier registration states table
CREATE TABLE IF NOT EXISTS external_courier_registration_states (
  telegram_user_id text PRIMARY KEY,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  step text NOT NULL,
  name text,
  lastname text,
  phone text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE external_courier_registration_states ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role has full access to registration states"
  ON external_courier_registration_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_external_courier_registration_states_partner 
  ON external_courier_registration_states(partner_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_external_courier_registration_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_external_courier_registration_states_updated_at
  BEFORE UPDATE ON external_courier_registration_states
  FOR EACH ROW
  EXECUTE FUNCTION update_external_courier_registration_states_updated_at();

-- Clean up old registration states (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_registration_states()
RETURNS void AS $$
BEGIN
  DELETE FROM external_courier_registration_states
  WHERE created_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql;
