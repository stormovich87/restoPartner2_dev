/*
  # Add courier cabinet token for personal dashboard access

  1. Changes
    - Add `cabinet_token` column to `couriers` table
      - Type: uuid
      - Purpose: Unique token for accessing personal courier cabinet
      - Default: auto-generated UUID
      - Unique constraint ensures each courier has a distinct URL

  2. Notes
    - This token is used to create unique URLs for each courier's personal dashboard
    - The token is auto-generated on courier creation
    - External couriers can access their cabinet via URL with this token
*/

-- Add cabinet_token column to couriers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'cabinet_token'
  ) THEN
    ALTER TABLE couriers ADD COLUMN cabinet_token uuid DEFAULT gen_random_uuid() NOT NULL;
    
    -- Create unique index for cabinet_token
    CREATE UNIQUE INDEX IF NOT EXISTS idx_couriers_cabinet_token ON couriers(cabinet_token);
  END IF;
END $$;

-- Update existing couriers to have cabinet tokens (if any have null values)
UPDATE couriers SET cabinet_token = gen_random_uuid() WHERE cabinet_token IS NULL;