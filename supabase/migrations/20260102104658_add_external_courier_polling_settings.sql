/*
  # External Courier Polling Settings

  1. New columns in `partner_settings`:
    - `external_courier_polling_enabled` (boolean) - Enable/disable scheduled polling
    - `external_courier_polling_schedule` (jsonb) - Schedule days and time
    - `external_courier_polling_message` (text) - Message text to send
    - `external_courier_polling_agree_button` (text) - Text for agree button
    - `external_courier_polling_decline_button` (text) - Text for decline button
    - `external_courier_polling_success_message` (text) - Success message after agree
    - `external_courier_polling_join_button` (text) - Text for join group button
    
  2. New table `external_courier_polling_responses`:
    - Tracks daily polling responses from external couriers
    - `id` (uuid) - Primary key
    - `partner_id` (uuid) - Foreign key to partners
    - `courier_id` (uuid) - Foreign key to couriers
    - `response_date` (date) - Date of the response
    - `is_active` (boolean) - Whether courier confirmed activity
    - `message_id` (bigint) - Telegram message ID for cleanup
    - `responded_at` (timestamptz) - When the courier responded
    - `created_at` (timestamptz) - When the poll was sent

  3. Security:
    - Enable RLS on new table
    - Add appropriate policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'external_courier_polling_enabled'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN external_courier_polling_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'external_courier_polling_schedule'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN external_courier_polling_schedule jsonb DEFAULT '{"days": [1,2,3,4,5,6,0], "time": "09:00"}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'external_courier_polling_message'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN external_courier_polling_message text DEFAULT 'Вы сегодня готовы принимать заказы?';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'external_courier_polling_agree_button'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN external_courier_polling_agree_button text DEFAULT 'Да, готов';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'external_courier_polling_decline_button'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN external_courier_polling_decline_button text DEFAULT 'Нет, не сегодня';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'external_courier_polling_success_message'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN external_courier_polling_success_message text DEFAULT 'Отлично! Вы добавлены в список активных курьеров на сегодня.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'external_courier_polling_join_button'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN external_courier_polling_join_button text DEFAULT 'Перейти в группу заказов';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS external_courier_polling_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  courier_id uuid NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  response_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean DEFAULT false,
  message_id bigint,
  responded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, courier_id, response_date)
);

ALTER TABLE external_courier_polling_responses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'external_courier_polling_responses' AND policyname = 'Allow select for authenticated users'
  ) THEN
    CREATE POLICY "Allow select for authenticated users"
      ON external_courier_polling_responses
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'external_courier_polling_responses' AND policyname = 'Allow insert for authenticated users'
  ) THEN
    CREATE POLICY "Allow insert for authenticated users"
      ON external_courier_polling_responses
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'external_courier_polling_responses' AND policyname = 'Allow update for authenticated users'
  ) THEN
    CREATE POLICY "Allow update for authenticated users"
      ON external_courier_polling_responses
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'external_courier_polling_responses' AND policyname = 'Allow delete for authenticated users'
  ) THEN
    CREATE POLICY "Allow delete for authenticated users"
      ON external_courier_polling_responses
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'external_courier_polling_responses' AND policyname = 'Allow anon select'
  ) THEN
    CREATE POLICY "Allow anon select"
      ON external_courier_polling_responses
      FOR SELECT
      TO anon
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'external_courier_polling_responses' AND policyname = 'Allow anon insert'
  ) THEN
    CREATE POLICY "Allow anon insert"
      ON external_courier_polling_responses
      FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'external_courier_polling_responses' AND policyname = 'Allow anon update'
  ) THEN
    CREATE POLICY "Allow anon update"
      ON external_courier_polling_responses
      FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'external_courier_polling_responses' AND policyname = 'Allow anon delete'
  ) THEN
    CREATE POLICY "Allow anon delete"
      ON external_courier_polling_responses
      FOR DELETE
      TO anon
      USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_external_courier_polling_responses_partner_date 
  ON external_courier_polling_responses(partner_id, response_date);

CREATE INDEX IF NOT EXISTS idx_external_courier_polling_responses_courier 
  ON external_courier_polling_responses(courier_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON external_courier_polling_responses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON external_courier_polling_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON external_courier_polling_responses TO service_role;
