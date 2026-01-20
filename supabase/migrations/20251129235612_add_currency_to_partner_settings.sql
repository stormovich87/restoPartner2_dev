/*
  # Add currency settings to partner_settings

  1. Changes
    - Add currency_code column (text, default 'UAH')
    - Add currency_symbol column (text, default '₴')
  
  2. Security
    - No RLS changes needed (existing policies apply)
  
  3. Notes
    - Supports multiple currencies: UAH (₴), RUB (₽), EUR (€), USD ($), BGN (лв)
    - Default is UAH with symbol ₴ (Ukrainian Hryvnia)
*/

-- Add currency fields to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'currency_code'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN currency_code text DEFAULT 'UAH';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'currency_symbol'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN currency_symbol text DEFAULT '₴';
  END IF;
END $$;