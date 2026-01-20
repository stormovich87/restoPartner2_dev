/*
  # Add photo_url fields to products and modifiers

  1. Changes
    - Add `photo_url` column to `products` table
    - Add `photo_url` column to `modifiers` table
  
  2. Details
    - Both columns are TEXT and nullable
    - Will store full URLs to product and modifier images from Poster
    - Can be either photo_origin (high-res) or photo (regular) from Poster API
*/

-- Add photo_url to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE products ADD COLUMN photo_url TEXT;
  END IF;
END $$;

-- Add photo_url to modifiers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modifiers' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE modifiers ADD COLUMN photo_url TEXT;
  END IF;
END $$;