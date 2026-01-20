/*
  # Rename url_suffix to partner_domain

  ## Summary
  Renames the url_suffix column to partner_domain for better clarity.
  This field stores the subdomain portion that will be combined with
  restopresto.org to form the full domain.

  ## 1. Modified Tables

  ### `partners` - Renamed column:
  - `url_suffix` → `partner_domain`
    - Stores subdomain like "lviv", "varna", "pizza-lviv"
    - Used to generate full_domain: {partner_domain}.restopresto.org

  ## 2. Important Notes
  - Uses safe column rename
  - All existing data is preserved
  - Updates full_domain values after rename
*/

-- Rename url_suffix to partner_domain
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'url_suffix'
  ) THEN
    ALTER TABLE partners RENAME COLUMN url_suffix TO partner_domain;
  END IF;
END $$;

-- Update full_domain values to ensure consistency
UPDATE partners 
SET full_domain = partner_domain || '.restopresto.org'
WHERE partner_domain IS NOT NULL;
