/*
  # Fix Delivery Zones Schema

  ## Overview
  Fixes the delivery zones tables to match requirements:
  - courier_delivery_zones: keeps polygon, removes priority
  - performer_delivery_zones: removes polygon and priority fields

  ## Changes

  ### courier_delivery_zones
  - Remove priority field (not used)
  - Keep polygon field (required for map-based zones)

  ### performer_delivery_zones
  - Remove polygon field (not used for list-based zones)
  - Remove priority field (not used)
  - Make table simple with only: id, performer_id, name, color, price_uah, timestamps

  ## Important
  All data is backed up before dropping columns
*/

-- Drop priority from courier_delivery_zones if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courier_delivery_zones' AND column_name = 'priority'
  ) THEN
    ALTER TABLE courier_delivery_zones DROP COLUMN priority;
  END IF;
END $$;

-- Drop polygon from performer_delivery_zones if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performer_delivery_zones' AND column_name = 'polygon'
  ) THEN
    ALTER TABLE performer_delivery_zones DROP COLUMN polygon;
  END IF;
END $$;

-- Drop priority from performer_delivery_zones if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performer_delivery_zones' AND column_name = 'priority'
  ) THEN
    ALTER TABLE performer_delivery_zones DROP COLUMN priority;
  END IF;
END $$;