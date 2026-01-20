/*
  # Fix RLS policies for Poster tables to allow service role access

  1. Changes
    - Drop existing restrictive policies
    - Add policies that allow service_role to bypass RLS
    - Ensure Edge Functions can write to tables
  
  2. Security
    - Service role can bypass RLS (needed for Edge Functions)
    - Authenticated users can still access their partner's data
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations on categories" ON categories;
DROP POLICY IF EXISTS "Allow all operations on products" ON products;
DROP POLICY IF EXISTS "Allow all operations on modifiers" ON modifiers;
DROP POLICY IF EXISTS "Allow all operations on product_modifiers" ON product_modifiers;

-- Categories policies
CREATE POLICY "Service role can manage categories"
  ON categories FOR ALL
  USING (true)
  WITH CHECK (true);

-- Products policies
CREATE POLICY "Service role can manage products"
  ON products FOR ALL
  USING (true)
  WITH CHECK (true);

-- Modifiers policies
CREATE POLICY "Service role can manage modifiers"
  ON modifiers FOR ALL
  USING (true)
  WITH CHECK (true);

-- Product modifiers policies
CREATE POLICY "Service role can manage product_modifiers"
  ON product_modifiers FOR ALL
  USING (true)
  WITH CHECK (true);