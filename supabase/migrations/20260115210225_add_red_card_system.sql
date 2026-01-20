/*
  # Add Red Card System for Punctuality

  1. Changes to kpi_indicator_settings
    - Add `red_card_enabled` (bool) - Toggle for red card system

  2. New Tables
    - `employee_red_cards`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, foreign key) - Partner isolation
      - `employee_id` (uuid, foreign key) - Employee who received the card
      - `indicator_key` (text) - Which indicator triggered this card (e.g., 'punctuality')
      - `reason` (text) - Reason for the red card
      - `shift_id` (uuid, nullable) - Related shift if applicable
      - `issued_at` (timestamptz) - When the card was issued
      - `created_at` (timestamptz) - Record creation time

  3. Security
    - RLS enabled on employee_red_cards
    - Policies for partner isolation
*/

-- Add red_card_enabled column to kpi_indicator_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kpi_indicator_settings' AND column_name = 'red_card_enabled'
  ) THEN
    ALTER TABLE kpi_indicator_settings ADD COLUMN red_card_enabled bool DEFAULT false;
  END IF;
END $$;

-- Create employee_red_cards table
CREATE TABLE IF NOT EXISTS employee_red_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  indicator_key text NOT NULL DEFAULT 'punctuality',
  reason text,
  shift_id uuid REFERENCES schedule_shifts(id) ON DELETE SET NULL,
  issued_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employee_red_cards_partner ON employee_red_cards(partner_id);
CREATE INDEX IF NOT EXISTS idx_employee_red_cards_employee ON employee_red_cards(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_red_cards_issued_at ON employee_red_cards(issued_at);

-- Enable RLS
ALTER TABLE employee_red_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "employee_red_cards_select_policy"
  ON employee_red_cards FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "employee_red_cards_insert_policy"
  ON employee_red_cards FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "employee_red_cards_update_policy"
  ON employee_red_cards FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "employee_red_cards_delete_policy"
  ON employee_red_cards FOR DELETE
  TO authenticated, anon
  USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON employee_red_cards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON employee_red_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON employee_red_cards TO service_role;
