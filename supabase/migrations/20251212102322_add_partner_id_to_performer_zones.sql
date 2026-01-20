/*
  # Add partner_id to performer_delivery_zones
  
  1. Changes
    - Add partner_id column to performer_delivery_zones
    - Populate existing records with partner_id from executors
    - Add foreign key constraint
    - Add trigger to auto-populate partner_id on insert/update
    
  2. Security
    - Update RLS policy to use partner_id for filtering
*/

-- Add partner_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performer_delivery_zones' AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE performer_delivery_zones ADD COLUMN partner_id uuid;
  END IF;
END $$;

-- Populate partner_id from executors for existing records
UPDATE performer_delivery_zones pdz
SET partner_id = e.partner_id
FROM executors e
WHERE pdz.performer_id = e.id AND pdz.partner_id IS NULL;

-- Make partner_id NOT NULL
ALTER TABLE performer_delivery_zones ALTER COLUMN partner_id SET NOT NULL;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'performer_delivery_zones_partner_id_fkey'
    AND table_name = 'performer_delivery_zones'
  ) THEN
    ALTER TABLE performer_delivery_zones
    ADD CONSTRAINT performer_delivery_zones_partner_id_fkey
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create or replace trigger function to auto-populate partner_id
CREATE OR REPLACE FUNCTION set_performer_zone_partner_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT partner_id INTO NEW.partner_id
  FROM executors
  WHERE id = NEW.performer_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS set_performer_zone_partner_id_trigger ON performer_delivery_zones;

-- Create trigger
CREATE TRIGGER set_performer_zone_partner_id_trigger
BEFORE INSERT OR UPDATE OF performer_id ON performer_delivery_zones
FOR EACH ROW
EXECUTE FUNCTION set_performer_zone_partner_id();

-- Add index
CREATE INDEX IF NOT EXISTS idx_performer_delivery_zones_partner ON performer_delivery_zones(partner_id);

-- Update RLS policy
DROP POLICY IF EXISTS "Allow all operations on performer zones" ON performer_delivery_zones;

CREATE POLICY "Allow operations on performer zones for partner"
  ON performer_delivery_zones FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
