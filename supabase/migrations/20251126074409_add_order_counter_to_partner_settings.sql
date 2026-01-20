/*
  # Add order counter to partner settings

  1. Changes
    - Add `next_order_number` column to `partner_settings` table
    - Set default value to 1 for new partners
    - Update existing partners to start from 1

  2. Purpose
    - Store sequential order counter for each partner
    - Enables simple order numbering (1, 2, 3, etc.)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'next_order_number'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN next_order_number integer DEFAULT 1 NOT NULL;
  END IF;
END $$;

-- Update existing partners to start from 1
UPDATE partner_settings 
SET next_order_number = 1 
WHERE next_order_number IS NULL;