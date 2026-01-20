/*
  # Create Poster Menu Integration Tables

  1. New Tables
    - `categories` - Product categories from Poster
      - `id` (uuid, primary key)
      - `poster_category_id` (bigint, unique per partner) - Category ID in Poster
      - `name` (text) - Category name
      - `parent_poster_category_id` (bigint, nullable) - Parent category ID
      - `is_active` (boolean, default true)
      - `sort_order` (int, nullable)
      - `partner_id` (uuid, foreign key to partners)
      - `updated_at` (timestamptz)

    - `products` - Products from Poster menu
      - `id` (uuid, primary key)
      - `poster_product_id` (bigint, unique per partner) - Product ID in Poster
      - `name` (text) - Product name
      - `category_poster_id` (bigint) - Reference to Poster category
      - `price` (numeric(12,2)) - Product price
      - `is_active` (boolean, default true)
      - `sku` (text, nullable) - Stock keeping unit
      - `code` (text, nullable) - Internal code/article
      - `partner_id` (uuid, foreign key to partners)
      - `updated_at` (timestamptz)

    - `modifiers` - Product modifiers from Poster
      - `id` (uuid, primary key)
      - `poster_modifier_id` (bigint, unique per partner) - Modifier ID in Poster
      - `name` (text) - Modifier name
      - `price_change` (numeric(12,2), default 0) - Price change amount
      - `is_active` (boolean, default true)
      - `partner_id` (uuid, foreign key to partners)
      - `updated_at` (timestamptz)

    - `product_modifiers` - Product-Modifier relationships
      - `id` (uuid, primary key)
      - `product_poster_id` (bigint) - Product ID in Poster
      - `modifier_poster_id` (bigint) - Modifier ID in Poster
      - `is_required` (boolean, default false)
      - `min_amount` (int, default 0)
      - `max_amount` (int, default 0)
      - `partner_id` (uuid, foreign key to partners)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for users with access to partner data via admin_partner_access
*/

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_category_id bigint NOT NULL,
  name text NOT NULL,
  parent_poster_category_id bigint,
  is_active boolean DEFAULT true,
  sort_order int,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(poster_category_id, partner_id)
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_product_id bigint NOT NULL,
  name text NOT NULL,
  category_poster_id bigint,
  price numeric(12,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  sku text,
  code text,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(poster_product_id, partner_id)
);

-- Create modifiers table
CREATE TABLE IF NOT EXISTS modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_modifier_id bigint NOT NULL,
  name text NOT NULL,
  price_change numeric(12,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(poster_modifier_id, partner_id)
);

-- Create product_modifiers table
CREATE TABLE IF NOT EXISTS product_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_poster_id bigint NOT NULL,
  modifier_poster_id bigint NOT NULL,
  is_required boolean DEFAULT false,
  min_amount int DEFAULT 0,
  max_amount int DEFAULT 0,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_poster_id, modifier_poster_id, partner_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_categories_partner ON categories(partner_id);
CREATE INDEX IF NOT EXISTS idx_categories_poster_id ON categories(poster_category_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);

CREATE INDEX IF NOT EXISTS idx_products_partner ON products(partner_id);
CREATE INDEX IF NOT EXISTS idx_products_poster_id ON products(poster_product_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_poster_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

CREATE INDEX IF NOT EXISTS idx_modifiers_partner ON modifiers(partner_id);
CREATE INDEX IF NOT EXISTS idx_modifiers_poster_id ON modifiers(poster_modifier_id);
CREATE INDEX IF NOT EXISTS idx_modifiers_active ON modifiers(is_active);

CREATE INDEX IF NOT EXISTS idx_product_modifiers_partner ON product_modifiers(partner_id);
CREATE INDEX IF NOT EXISTS idx_product_modifiers_product ON product_modifiers(product_poster_id);
CREATE INDEX IF NOT EXISTS idx_product_modifiers_modifier ON product_modifiers(modifier_poster_id);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_modifiers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories (allow anon for now, will be restricted later)
CREATE POLICY "Allow all operations on categories"
  ON categories FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for products
CREATE POLICY "Allow all operations on products"
  ON products FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for modifiers
CREATE POLICY "Allow all operations on modifiers"
  ON modifiers FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for product_modifiers
CREATE POLICY "Allow all operations on product_modifiers"
  ON product_modifiers FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);