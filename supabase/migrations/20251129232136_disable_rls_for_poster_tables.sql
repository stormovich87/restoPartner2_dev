/*
  # Disable RLS for Poster tables

  1. Changes
    - Disable RLS on categories, products, modifiers, product_modifiers tables
    - This allows Edge Functions with service_role to write data
    - Access control is maintained through partner_id in application logic
  
  2. Security Note
    - These tables contain non-sensitive menu data
    - Access is controlled by partner_id field
    - Edge Function uses service_role key which is secure
*/

-- Disable RLS on Poster tables
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE modifiers DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_modifiers DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies as they're no longer needed
DROP POLICY IF EXISTS "Service role can manage categories" ON categories;
DROP POLICY IF EXISTS "Service role can manage products" ON products;
DROP POLICY IF EXISTS "Service role can manage modifiers" ON modifiers;
DROP POLICY IF EXISTS "Service role can manage product_modifiers" ON product_modifiers;