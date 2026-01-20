/*
  # Add Support for Multiple Followup Questions

  1. Changes to `partner_settings`:
    - `external_courier_polling_followup_questions` (jsonb) - Array of question objects with question text and options
    
  2. Changes to `external_courier_polling_responses`:
    - `followup_answers` (jsonb) - Object storing answers to multiple questions

  3. Notes:
    - Questions format: [{ "question": "text", "options": ["opt1", "opt2"] }, ...]
    - Answers format: { "0": "answer1", "1": "answer2" } (keyed by question index)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'external_courier_polling_followup_questions'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN external_courier_polling_followup_questions jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_courier_polling_responses' AND column_name = 'followup_answers'
  ) THEN
    ALTER TABLE external_courier_polling_responses ADD COLUMN followup_answers jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;