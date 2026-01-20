/*
  # Create External Courier Invites Table

  1. New Tables
    - `external_courier_invites`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, required)
      - `phone` (text, required) - normalized phone number
      - `name` (text, optional)
      - `invite_code` (text, unique) - generated code for invite link
      - `created_at` (timestamptz)
      - `started_at` (timestamptz) - when user clicked /start
      - `registered_at` (timestamptz) - when registration completed
      - `telegram_user_id` (text)
      - `telegram_username` (text)
      - `courier_id` (uuid) - reference to couriers table (no FK)
      - `status` (text) - created|started|registered|ignored

  2. Security
    - Enable RLS with open access (matching other tables in this project)

  3. Indexes
    - Index on partner_id for filtering
    - Index on invite_code for lookups
    - Index on status for filtering
*/

CREATE TABLE IF NOT EXISTS external_courier_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  phone text NOT NULL,
  name text,
  invite_code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  registered_at timestamptz,
  telegram_user_id text,
  telegram_username text,
  courier_id uuid,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'started', 'registered', 'ignored'))
);

ALTER TABLE external_courier_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read invites"
  ON external_courier_invites
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert invites"
  ON external_courier_invites
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update invites"
  ON external_courier_invites
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete invites"
  ON external_courier_invites
  FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_external_courier_invites_partner_id ON external_courier_invites(partner_id);
CREATE INDEX IF NOT EXISTS idx_external_courier_invites_invite_code ON external_courier_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_external_courier_invites_status ON external_courier_invites(status);
CREATE INDEX IF NOT EXISTS idx_external_courier_invites_phone ON external_courier_invites(phone);

GRANT ALL ON external_courier_invites TO anon;
GRANT ALL ON external_courier_invites TO authenticated;
GRANT ALL ON external_courier_invites TO service_role;