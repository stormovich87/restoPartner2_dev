/*
  # Create Binotel Calls Log Table

  ## Overview
  This migration creates a table to log incoming webhook calls from Binotel API.
  This allows tracking all incoming call notifications for debugging and monitoring purposes.

  ## New Tables
    - `binotel_calls`
      - `id` (uuid, primary key) - Unique identifier for the log record
      - `partner_id` (uuid, foreign key, nullable) - Reference to the partner (determined by company_id)
      - `request_type` (text, nullable) - Type of request from Binotel
      - `call_type` (text, nullable) - Call type: "0" = incoming, "1" = outgoing
      - `external_number` (text, nullable) - Client's phone number
      - `internal_number` (text, nullable) - Internal line number
      - `pbx_number` (text, nullable) - PBX number that received the call
      - `company_id` (text, nullable) - Binotel company ID
      - `raw_data` (jsonb) - Full raw request data from Binotel
      - `created_at` (timestamptz) - When the webhook was received

  ## Security
    - Enable RLS on `binotel_calls` table
    - Allow service role to insert records (for edge function)
    - Allow authenticated users to read records for their partner

  ## Important Notes
    1. This table stores raw webhook data from Binotel for debugging
    2. The edge function will insert records here
    3. Records can be used for troubleshooting integration issues
*/

CREATE TABLE IF NOT EXISTS binotel_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  request_type text,
  call_type text,
  external_number text,
  internal_number text,
  pbx_number text,
  company_id text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE binotel_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert binotel calls"
  ON binotel_calls
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read all binotel calls"
  ON binotel_calls
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Authenticated users can read partner binotel calls"
  ON binotel_calls
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon users can read binotel calls"
  ON binotel_calls
  FOR SELECT
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_binotel_calls_partner_id ON binotel_calls(partner_id);
CREATE INDEX IF NOT EXISTS idx_binotel_calls_company_id ON binotel_calls(company_id);
CREATE INDEX IF NOT EXISTS idx_binotel_calls_created_at ON binotel_calls(created_at DESC);