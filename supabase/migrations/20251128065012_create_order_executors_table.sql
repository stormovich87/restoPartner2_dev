/*
  # Create order_executors junction table

  1. New Tables
    - `order_executors`
      - `id` (uuid, primary key)
      - `order_id` (uuid, foreign key to orders)
      - `executor_id` (uuid, foreign key to executors)
      - `status` (text) - searching/assigned/completed/cancelled
      - `telegram_message_id` (text, nullable) - ID сообщения в Telegram
      - `sent_at` (timestamptz) - Когда отправлено
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS order_executors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  executor_id uuid NOT NULL REFERENCES executors(id) ON DELETE CASCADE,
  status text DEFAULT 'searching' NOT NULL CHECK (status IN ('searching', 'assigned', 'completed', 'cancelled')),
  telegram_message_id text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(order_id, executor_id)
);

-- Enable RLS
ALTER TABLE order_executors ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view order_executors"
  ON order_executors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to view order_executors"
  ON order_executors FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can insert order_executors"
  ON order_executors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to insert order_executors"
  ON order_executors FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Users can update order_executors"
  ON order_executors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to update order_executors"
  ON order_executors FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete order_executors"
  ON order_executors FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to delete order_executors"
  ON order_executors FOR DELETE
  TO anon
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_order_executors_order_id ON order_executors(order_id);
CREATE INDEX IF NOT EXISTS idx_order_executors_executor_id ON order_executors(executor_id);
CREATE INDEX IF NOT EXISTS idx_order_executors_status ON order_executors(status);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE order_executors;