/*
  # Add Followup Question Feature for External Courier Polling

  1. New columns in `partner_settings`:
    - `external_courier_polling_followup_enabled` (boolean) - Enable/disable followup question
    - `external_courier_polling_followup_question` (text) - The followup question text
    - `external_courier_polling_followup_options` (jsonb) - Array of answer options
    
  2. New column in `external_courier_polling_responses`:
    - `followup_answer` (text) - The courier's answer to the followup question

  3. Notes:
    - The followup question is sent after the courier agrees to work
    - Each answer option becomes a button in the Telegram message
    - The answer is stored and displayed in the status modal
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'external_courier_polling_followup_enabled'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN external_courier_polling_followup_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'external_courier_polling_followup_question'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN external_courier_polling_followup_question text DEFAULT 'На каком транспорте вы сегодня?';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'external_courier_polling_followup_options'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN external_courier_polling_followup_options jsonb DEFAULT '["Пеший", "Велосипед", "Мотоцикл", "Авто"]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_courier_polling_responses' AND column_name = 'followup_answer'
  ) THEN
    ALTER TABLE external_courier_polling_responses ADD COLUMN followup_answer text;
  END IF;
END $$;