/*
  # Add courier payment and free delivery threshold to courier delivery zones

  1. Changes
    - Add `courier_payment` column to `courier_delivery_zones` table
      - Type: decimal(10,2)
      - Purpose: Amount paid to courier for delivery in this zone
      - Required field with default 0
    
    - Add `free_delivery_threshold` column to `courier_delivery_zones` table
      - Type: decimal(10,2)
      - Purpose: Order total amount at which delivery becomes free for client
      - Nullable (if null, free delivery feature is disabled for this zone)
      - When threshold is reached, delivery price becomes 0 for client but courier still gets paid
  
  2. Notes
    - Courier payment is always charged (visible in reports and order history)
    - Free delivery threshold is optional - if null, normal delivery pricing applies
    - When order total >= free_delivery_threshold, delivery_price shown to client is 0
    - System tracks both client delivery price and courier payment separately
*/

-- Add courier_payment column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courier_delivery_zones' AND column_name = 'courier_payment'
  ) THEN
    ALTER TABLE courier_delivery_zones ADD COLUMN courier_payment decimal(10,2) DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add free_delivery_threshold column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courier_delivery_zones' AND column_name = 'free_delivery_threshold'
  ) THEN
    ALTER TABLE courier_delivery_zones ADD COLUMN free_delivery_threshold decimal(10,2);
  END IF;
END $$;