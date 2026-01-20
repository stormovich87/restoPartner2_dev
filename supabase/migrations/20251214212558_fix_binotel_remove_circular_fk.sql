/*
  # Fix Binotel Integration - Remove Circular Foreign Keys

  ## Overview
  This migration removes circular foreign keys between orders and binotel_calls tables
  to ensure database can be restored with pg_restore --clean without errors.

  ## Changes

  1. **Remove Circular Foreign Keys**
     - Drop FK: `binotel_calls.order_id` → `orders.id` (REMOVED)
     - Drop FK: `orders.binotel_call_id` → `binotel_calls.id` (REMOVED)
     - Keep FK: `binotel_calls.client_id` → `clients.id` (one-directional, allowed)

  2. **Update binotel_calls table**
     - Remove `order_id` column (no FK to orders)
     - Keep `general_call_id` (text) for logical linking
     - Rename `disposition` to `call_status` if needed
     - Add `is_missed_seen` (boolean) for UI notification tracking
     - Add `raw_settings` (jsonb) for webhook data storage

  3. **Update orders table**
     - Remove `binotel_call_id` column (no FK to binotel_calls)
     - Keep `source_call_id` (text) for logical linking to general_call_id
     - Add `source` (text) field if missing

  4. **Add unique constraint**
     - Unique index on (partner_id, general_call_id) WHERE general_call_id IS NOT NULL

  ## Security
  - No RLS changes needed (already configured)

  ## Notes
  - Orders link to calls via text field `source_call_id` = `general_call_id`
  - No circular dependencies between tables
  - Safe for pg_restore --clean
*/

-- Drop circular foreign keys and columns
DO $$
BEGIN
  -- Drop FK and column: binotel_calls.order_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'order_id'
  ) THEN
    ALTER TABLE binotel_calls DROP COLUMN IF EXISTS order_id CASCADE;
  END IF;

  -- Drop FK and column: orders.binotel_call_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'binotel_call_id'
  ) THEN
    ALTER TABLE orders DROP COLUMN IF EXISTS binotel_call_id CASCADE;
  END IF;
END $$;

-- Add is_missed_seen to binotel_calls
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'is_missed_seen'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN is_missed_seen boolean DEFAULT false;
  END IF;
END $$;

-- Add raw_settings to binotel_calls
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'raw_settings'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN raw_settings jsonb;
  END IF;
END $$;

-- Ensure orders.source exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'source'
  ) THEN
    ALTER TABLE orders ADD COLUMN source text DEFAULT 'manual';
  END IF;
END $$;

-- Create unique index on (partner_id, general_call_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_binotel_calls_partner_general_call_id
  ON binotel_calls(partner_id, general_call_id)
  WHERE general_call_id IS NOT NULL;

-- Add index for is_missed_seen
CREATE INDEX IF NOT EXISTS idx_binotel_calls_is_missed_seen 
  ON binotel_calls(partner_id, is_missed, is_missed_seen) 
  WHERE is_missed = true AND is_missed_seen = false;

-- Add index for source_call_id on orders
CREATE INDEX IF NOT EXISTS idx_orders_source_call_id 
  ON orders(partner_id, source_call_id) 
  WHERE source_call_id IS NOT NULL;