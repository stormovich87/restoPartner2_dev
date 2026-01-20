/*
  # Add Executor Branch Telegram Distribution

  This migration adds the ability for executors to distribute orders to different 
  Telegram chats/threads based on which branch the order belongs to.

  1. Changes to `executors` table:
    - `distribute_by_branches` (boolean) - When ON, use branch-specific telegram settings
    - `telegram_thread_id` (text, nullable) - Thread/topic ID for general executor chat

  2. New table `executor_branch_telegram_settings`:
    - `id` (uuid, primary key)
    - `executor_id` (uuid, foreign key to executors)
    - `branch_id` (uuid, foreign key to branches)
    - `telegram_chat_id` (text) - Chat ID for this branch
    - `telegram_thread_id` (text, nullable) - Thread/topic ID for this branch
    - `telegram_bot_token` (text, nullable) - Bot token (if different from executor's)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
    - Unique constraint on (executor_id, branch_id)

  3. Security:
    - Enable RLS on new table
    - Add policies for anon access (consistent with existing executor policies)

  4. Notes:
    - When distribute_by_branches = OFF, use executor's general telegram settings
    - When distribute_by_branches = ON, look up branch-specific settings
    - If branch settings not found, fallback to executor's general settings
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'executors' AND column_name = 'distribute_by_branches'
  ) THEN
    ALTER TABLE executors ADD COLUMN distribute_by_branches boolean DEFAULT false NOT NULL;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'executors' AND column_name = 'telegram_thread_id'
  ) THEN
    ALTER TABLE executors ADD COLUMN telegram_thread_id text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS executor_branch_telegram_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executor_id uuid NOT NULL REFERENCES executors(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  telegram_chat_id text NOT NULL,
  telegram_thread_id text,
  telegram_bot_token text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(executor_id, branch_id)
);

ALTER TABLE executor_branch_telegram_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to view executor_branch_telegram_settings"
  ON executor_branch_telegram_settings FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to insert executor_branch_telegram_settings"
  ON executor_branch_telegram_settings FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon to update executor_branch_telegram_settings"
  ON executor_branch_telegram_settings FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete executor_branch_telegram_settings"
  ON executor_branch_telegram_settings FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Users can view executor_branch_telegram_settings"
  ON executor_branch_telegram_settings FOR SELECT
  TO authenticated
  USING (
    executor_id IN (
      SELECT id FROM executors
    )
  );

CREATE POLICY "Users can insert executor_branch_telegram_settings"
  ON executor_branch_telegram_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    executor_id IN (
      SELECT id FROM executors
    )
  );

CREATE POLICY "Users can update executor_branch_telegram_settings"
  ON executor_branch_telegram_settings FOR UPDATE
  TO authenticated
  USING (
    executor_id IN (
      SELECT id FROM executors
    )
  )
  WITH CHECK (
    executor_id IN (
      SELECT id FROM executors
    )
  );

CREATE POLICY "Users can delete executor_branch_telegram_settings"
  ON executor_branch_telegram_settings FOR DELETE
  TO authenticated
  USING (
    executor_id IN (
      SELECT id FROM executors
    )
  );

CREATE INDEX IF NOT EXISTS idx_executor_branch_telegram_settings_executor ON executor_branch_telegram_settings(executor_id);
CREATE INDEX IF NOT EXISTS idx_executor_branch_telegram_settings_branch ON executor_branch_telegram_settings(branch_id);

COMMENT ON COLUMN executors.distribute_by_branches IS 'When true, use branch-specific telegram settings for sending orders';
COMMENT ON COLUMN executors.telegram_thread_id IS 'Thread/topic ID for telegram group (used as fallback when distribute_by_branches is on)';
COMMENT ON TABLE executor_branch_telegram_settings IS 'Branch-specific telegram settings for executors when distribute_by_branches is enabled';
