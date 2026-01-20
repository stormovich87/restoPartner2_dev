/*
  # Add delivery payer default to executors

  1. Changes
    - Add `delivery_payer_default` column to `executors` table
      - Type: text with check constraint ('restaurant' or 'client')
      - Default: 'restaurant'
      - This field stores who pays for delivery by default for this executor
  
  2. Notes
    - This setting will be used as the default when creating orders for this executor
    - Can be overridden on a per-order basis
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'executors' AND column_name = 'delivery_payer_default'
  ) THEN
    ALTER TABLE executors 
    ADD COLUMN delivery_payer_default text DEFAULT 'restaurant' CHECK (delivery_payer_default IN ('restaurant', 'client'));
  END IF;
END $$;