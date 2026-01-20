/*
  # Create Telegram Topics Cache Table

  1. New Tables
    - `telegram_topics`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, foreign key to partners)
      - `chat_id` (text) - Telegram chat ID
      - `thread_id` (integer) - Telegram thread/topic ID
      - `thread_name` (text) - Name of the Telegram topic
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `telegram_topics` table
    - Add policies for authenticated users to read topics
    - Add policies for service role to manage topics

  3. Indexes
    - Add index on (partner_id, chat_id, thread_id) for fast lookups
*/

CREATE TABLE IF NOT EXISTS telegram_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  chat_id text NOT NULL,
  thread_id integer NOT NULL,
  thread_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, chat_id, thread_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_topics_lookup 
  ON telegram_topics(partner_id, chat_id, thread_id);

ALTER TABLE telegram_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read telegram topics"
  ON telegram_topics
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon users can read telegram topics"
  ON telegram_topics
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Service role can manage all telegram topics"
  ON telegram_topics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON telegram_topics TO authenticated, anon;
GRANT ALL ON telegram_topics TO service_role;