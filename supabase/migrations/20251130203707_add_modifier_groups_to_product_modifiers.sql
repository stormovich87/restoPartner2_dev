/*
  # Add Modifier Groups to Product Modifiers

  1. Changes
    - Add `group_id` (bigint) - Group ID from Poster
    - Add `group_name` (text) - Group display name
    - Add `sort_order` (int) - Sort order within group

  2. Notes
    - These fields allow grouping modifiers into sets
    - Used for displaying modifiers by groups with min/max requirements per group
*/

-- Add group fields to product_modifiers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_modifiers' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE product_modifiers ADD COLUMN group_id bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_modifiers' AND column_name = 'group_name'
  ) THEN
    ALTER TABLE product_modifiers ADD COLUMN group_name text DEFAULT 'Набір 1';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_modifiers' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE product_modifiers ADD COLUMN sort_order int DEFAULT 0;
  END IF;
END $$;

-- Create index for group_id
CREATE INDEX IF NOT EXISTS idx_product_modifiers_group ON product_modifiers(group_id);
