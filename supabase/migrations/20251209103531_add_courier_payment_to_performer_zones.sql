/*
  # Add courier payment to performer delivery zones

  1. Changes
    - Add `courier_payment` column to `performer_delivery_zones` table
      - Type: decimal(10,2)
      - Purpose: Amount paid to courier for delivery in this zone
      - Default: uses price_uah value as courier payment
    
  2. Notes
    - This enables tracking of courier payments separately from delivery price
    - For performers, courier payment may differ from client delivery price
*/

-- Add courier_payment column to performer_delivery_zones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performer_delivery_zones' AND column_name = 'courier_payment'
  ) THEN
    ALTER TABLE performer_delivery_zones ADD COLUMN courier_payment decimal(10,2) DEFAULT 0 NOT NULL;
    
    -- Set courier_payment to match price_uah for existing zones
    UPDATE performer_delivery_zones SET courier_payment = price_uah WHERE courier_payment = 0;
  END IF;
END $$;
