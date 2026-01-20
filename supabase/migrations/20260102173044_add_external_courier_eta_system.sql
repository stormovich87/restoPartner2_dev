/*
  # External Courier ETA System

  1. New Tables
    - `external_courier_states` - Tracks conversation states for external couriers
      - `id` (uuid, primary key)
      - `telegram_user_id` (text, not null)
      - `partner_id` (uuid, foreign key)
      - `order_id` (uuid, foreign key)
      - `courier_id` (uuid, foreign key)
      - `step` (text) - Current workflow step: 'awaiting_eta', 'awaiting_eta_manual_text', 'awaiting_location_for_eta'
      - `eta_question_message_id` (bigint) - Telegram message ID for ETA question
      - `eta_question_sent_at` (timestamptz) - When the ETA question was sent
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. New Columns in orders
    - `eta_pickup_minutes` (integer) - ETA in minutes
    - `eta_pickup_at` (timestamptz) - Expected pickup time
    - `eta_source` (text) - How ETA was determined: 'manual_button', 'manual_text', 'auto_route'
    - `courier_location_lat` (double precision) - Courier's location when auto-calculating
    - `courier_location_lng` (double precision)

  3. Security
    - Enable RLS on external_courier_states
    - Add policies for authenticated access
*/

-- Create external_courier_states table
CREATE TABLE IF NOT EXISTS external_courier_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id text NOT NULL,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  courier_id uuid REFERENCES couriers(id) ON DELETE CASCADE,
  step text NOT NULL DEFAULT 'awaiting_eta',
  eta_question_message_id bigint,
  eta_question_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique index to prevent duplicate states per telegram user
CREATE UNIQUE INDEX IF NOT EXISTS external_courier_states_telegram_user_idx 
ON external_courier_states(telegram_user_id);

-- Enable RLS
ALTER TABLE external_courier_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can manage external_courier_states"
  ON external_courier_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view external_courier_states"
  ON external_courier_states
  FOR SELECT
  TO authenticated
  USING (true);

-- Add ETA fields to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'eta_pickup_minutes'
  ) THEN
    ALTER TABLE orders ADD COLUMN eta_pickup_minutes integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'eta_pickup_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN eta_pickup_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'eta_source'
  ) THEN
    ALTER TABLE orders ADD COLUMN eta_source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'courier_location_lat'
  ) THEN
    ALTER TABLE orders ADD COLUMN courier_location_lat double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'courier_location_lng'
  ) THEN
    ALTER TABLE orders ADD COLUMN courier_location_lng double precision;
  END IF;
END $$;

-- Add same fields to archived_orders if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'eta_pickup_minutes'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN eta_pickup_minutes integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'eta_pickup_at'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN eta_pickup_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'eta_source'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN eta_source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'courier_location_lat'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN courier_location_lat double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'courier_location_lng'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN courier_location_lng double precision;
  END IF;
END $$;

-- Grant permissions
GRANT ALL ON external_courier_states TO anon;
GRANT ALL ON external_courier_states TO authenticated;
GRANT ALL ON external_courier_states TO service_role;