/*
  # Add Partner Settings for Order Completion Norm

  ## Overview
  This migration adds a new table to store partner-specific settings, starting with the order completion norm.

  ## New Tables
    - `partner_settings`
      - `id` (uuid, primary key) - Unique identifier for the settings record
      - `partner_id` (uuid, foreign key) - Reference to the partner
      - `order_completion_norm_minutes` (integer) - Standard time in minutes for completing an order
      - `created_at` (timestamptz) - When the settings record was created
      - `updated_at` (timestamptz) - When the settings record was last updated

  ## Changes
    - Creates a new table for storing partner-specific configuration settings
    - Default order completion norm is set to 60 minutes
    - Each partner can only have one settings record (unique constraint on partner_id)

  ## Security
    - Enable RLS on `partner_settings` table
    - Add policy for authenticated users to read partner settings
    - Add policy for authenticated users to insert partner settings
    - Add policy for authenticated users to update partner settings

  ## Important Notes
    1. The order completion norm is used to determine if an order is overdue
    2. When calculating if an order is late:
       - Use `accepted_at` as the start time
       - Add `order_completion_norm_minutes` to get the deadline
       - Add `extra_time_minutes` if applicable
       - If `scheduled_at` is in the future, the order is not considered overdue until that time
    3. An order is marked as overdue if: current_time > (accepted_at + norm + extra_time) AND (scheduled_at is null OR current_time > scheduled_at)
*/

CREATE TABLE IF NOT EXISTS partner_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL UNIQUE REFERENCES partners(id) ON DELETE CASCADE,
  order_completion_norm_minutes integer NOT NULL DEFAULT 60,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE partner_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read partner settings"
  ON partner_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon users to read partner settings"
  ON partner_settings
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated users to insert partner settings"
  ON partner_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon users to insert partner settings"
  ON partner_settings
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update partner settings"
  ON partner_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon users to update partner settings"
  ON partner_settings
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_partner_settings_partner_id ON partner_settings(partner_id);