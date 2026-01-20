/*
  # Create executors table

  1. New Tables
    - `executors`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, foreign key to partners)
      - `name` (text) - Название исполнителя
      - `own_couriers` (boolean) - Свои курьеры
      - `telegram_bot_token` (text, nullable) - Токен бота (если свои курьеры)
      - `telegram_chat_id` (text, nullable) - Chat ID (если свои курьеры)
      - `payment_for_pour` (boolean) - Выкуп заказа за наливку
      - `payment_terminal` (boolean) - На терминал
      - `payment_cashless` (boolean) - Безнал (на счет исполнителя)
      - `commission_percent` (numeric) - Процент комиссии
      - `different_prices` (boolean) - Разные цены
      - `price_markup_percent` (numeric, nullable) - Процент удорожания товаров
      - `status` (text) - active/inactive
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for authenticated users to manage executors
*/

CREATE TABLE IF NOT EXISTS executors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  own_couriers boolean DEFAULT false NOT NULL,
  telegram_bot_token text,
  telegram_chat_id text,
  payment_for_pour boolean DEFAULT false NOT NULL,
  payment_terminal boolean DEFAULT false NOT NULL,
  payment_cashless boolean DEFAULT false NOT NULL,
  commission_percent numeric DEFAULT 0 NOT NULL,
  different_prices boolean DEFAULT false NOT NULL,
  price_markup_percent numeric DEFAULT 0,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE executors ENABLE ROW LEVEL SECURITY;

-- Policies for executors
CREATE POLICY "Users can view executors of their partner"
  ON executors FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE id = partner_id
    )
  );

CREATE POLICY "Allow anon to view executors"
  ON executors FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can insert executors for their partner"
  ON executors FOR INSERT
  TO authenticated
  WITH CHECK (
    partner_id IN (
      SELECT id FROM partners WHERE id = partner_id
    )
  );

CREATE POLICY "Allow anon to insert executors"
  ON executors FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Users can update executors of their partner"
  ON executors FOR UPDATE
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE id = partner_id
    )
  )
  WITH CHECK (
    partner_id IN (
      SELECT id FROM partners WHERE id = partner_id
    )
  );

CREATE POLICY "Allow anon to update executors"
  ON executors FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete executors of their partner"
  ON executors FOR DELETE
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE id = partner_id
    )
  );

CREATE POLICY "Allow anon to delete executors"
  ON executors FOR DELETE
  TO anon
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_executors_partner_id ON executors(partner_id);
CREATE INDEX IF NOT EXISTS idx_executors_status ON executors(status);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE executors;