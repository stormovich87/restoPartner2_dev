/*
  # Add Poster Integration Fields to Branches

  1. Changes
    - Add `poster_enabled` (boolean) - Enable Poster integration for this branch
    - Add `poster_spot_id` (bigint) - Poster spot (location) ID
    - Add `poster_spot_name` (text) - Poster spot name
    - Add `poster_spot_address` (text) - Poster spot address

  2. Notes
    - These fields allow each branch to be linked to a specific Poster spot
    - Enables per-branch Poster integration configuration
*/

-- Add Poster integration fields to branches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'poster_enabled'
  ) THEN
    ALTER TABLE branches ADD COLUMN poster_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'poster_spot_id'
  ) THEN
    ALTER TABLE branches ADD COLUMN poster_spot_id bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'poster_spot_name'
  ) THEN
    ALTER TABLE branches ADD COLUMN poster_spot_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'poster_spot_address'
  ) THEN
    ALTER TABLE branches ADD COLUMN poster_spot_address text;
  END IF;
END $$;

-- Create index for poster_spot_id
CREATE INDEX IF NOT EXISTS idx_branches_poster_spot ON branches(poster_spot_id);
