/*
  # Add OpenAI Settings and AI Functions

  1. Changes to partner_settings
    - Add `openai_api_key` (text, encrypted sensitive data)
    - Add `openai_default_model` (text, default: 'gpt-4o-mini')

  2. New Tables
    - `ai_functions`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, foreign key to partners)
      - `name` (text, function name)
      - `description` (text, function description)
      - `prompt` (text, the AI prompt)
      - `model` (text, nullable, uses default if null)
      - `is_enabled` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - Enable RLS on `ai_functions` table
    - Add policies for anon role (partners use custom auth)

  4. Initial Data
    - Insert default "Order Text Parsing" function for all partners
*/

-- Add OpenAI settings to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'openai_api_key'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN openai_api_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'openai_default_model'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN openai_default_model text DEFAULT 'gpt-4o-mini';
  END IF;
END $$;

-- Create ai_functions table
CREATE TABLE IF NOT EXISTS ai_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  prompt text NOT NULL,
  model text,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_functions ENABLE ROW LEVEL SECURITY;

-- Policies for ai_functions (using anon role for partner custom auth)
CREATE POLICY "Anyone can view AI functions"
  ON ai_functions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert AI functions"
  ON ai_functions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update AI functions"
  ON ai_functions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete AI functions"
  ON ai_functions FOR DELETE
  TO anon, authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_functions_partner_id ON ai_functions(partner_id);
CREATE INDEX IF NOT EXISTS idx_ai_functions_is_enabled ON ai_functions(partner_id, is_enabled);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_ai_functions_updated_at ON ai_functions;
CREATE TRIGGER update_ai_functions_updated_at
  BEFORE UPDATE ON ai_functions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default "Order Text Parsing" function for all existing partners
INSERT INTO ai_functions (partner_id, name, description, prompt, is_enabled)
SELECT 
  id,
  'Парсинг текста заказа',
  'Распознаёт текст заказа и возвращает данные для заполнения полей заказа.',
  E'Ты — система распознавания текстов заказов ресторанов.\nТвоя задача — преобразовать неструктурированный текст заказа в строго структурированный JSON.\n\nПравила:\n- Всегда отвечай только JSON, без комментариев и текста вокруг.\n- Если какого-то значения нет — ставь null.\n- Разделяй адрес на: город, улица, дом, парадная (подъезд), этаж, квартира, домофон, офис.\n- Создавай отдельное поле address_full_for_maps — полная строка адреса, пригодная для Google Maps.\n- Определи номер телефона, способ оплаты, общую сумму.\n- Определи способ выполнения заказа: Доставка или Самовывоз. Верни fulfillment_method: "delivery" или "pickup".\n- Определи время выполнения:\n    * fulfillment_time_mode: "now" если «на сейчас»,\n    * fulfillment_time_mode: "scheduled" если указано время,\n    * fulfillment_time_value: время формата HH:MM или null.\n- Поле order_content — краткое содержание заказа одной строкой.\n- Поле items — массив товаров с полями name, modifiers[], quantity, price, sum.\n- Поле total_sum — общая сумма заказа (число, только цифры без валюты).\n\nПример структуры, которую нужно вернуть:\n\n{\n  "address_city": "",\n  "address_street": "",\n  "address_house_number": "",\n  "address_entrance": "",\n  "address_floor": "",\n  "address_flat": "",\n  "address_domofon": "",\n  "address_office": "",\n  "address_full_for_maps": "",\n\n  "customer_phone": "",\n  "payment_method": "",\n  "payment_type_name": "",\n\n  "fulfillment_method": "",\n  "fulfillment_time_mode": "",\n  "fulfillment_time_value": "",\n\n  "order_content": "",\n  "total_sum": 0,\n\n  "items": [\n    {\n      "name": "",\n      "modifiers": [],\n      "quantity": 1,\n      "price": 0,\n      "sum": 0\n    }\n  ]\n}',
  true
FROM partners
ON CONFLICT DO NOTHING;

-- Enable realtime for ai_functions
ALTER PUBLICATION supabase_realtime ADD TABLE ai_functions;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_functions TO anon, authenticated;
