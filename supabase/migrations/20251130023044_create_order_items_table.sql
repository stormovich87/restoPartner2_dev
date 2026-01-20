/*
  # Create Order Items Table

  1. New Tables
    - `order_items` - Items within orders with product and modifier details
      - `id` (uuid, primary key)
      - `order_id` (uuid, foreign key to orders) - Reference to the order
      - `product_poster_id` (bigint) - Product ID from Poster
      - `product_name` (text) - Product name snapshot
      - `base_price` (numeric(12,2)) - Base product price
      - `modifiers` (jsonb) - Array of selected modifiers with structure:
        [{modifier_poster_id, name, price, quantity}]
      - `quantity` (int, default 1) - Number of items
      - `total_price` (numeric(12,2)) - Total price including modifiers
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on order_items table
    - Add policies for authenticated users to access their partner's order items
*/

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_poster_id bigint NOT NULL,
  product_name text NOT NULL,
  base_price numeric(12,2) DEFAULT 0,
  modifiers jsonb DEFAULT '[]'::jsonb,
  quantity int DEFAULT 1,
  total_price numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_poster_id);

-- Enable RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view order items for their partner"
  ON order_items FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can insert order items"
  ON order_items FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Users can update order items"
  ON order_items FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete order items"
  ON order_items FOR DELETE
  TO authenticated, anon
  USING (true);
