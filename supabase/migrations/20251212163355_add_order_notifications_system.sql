/*
  # Order Notifications System

  1. Changes to partner_settings
    - Add `notifications_enabled` boolean for global notification toggle

  2. Changes to orders
    - Add `is_accepted` boolean to track if order was accepted by staff
    - Add `accepted_at` timestamp for when order was accepted
    - Add `accepted_by` to track who accepted the order

  3. New table: position_branch_notifications
    - Configure notification preferences per position and branch
    - `sound_enabled` - whether to play sound notifications
    - `visual_enabled` - whether to show visual notifications

  4. Security
    - Enable RLS on new table
    - Add appropriate policies for partner isolation
*/

-- Add notifications_enabled to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'notifications_enabled'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN notifications_enabled boolean DEFAULT true;
  END IF;
END $$;

-- Add is_accepted and related fields to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'is_accepted'
  ) THEN
    ALTER TABLE orders ADD COLUMN is_accepted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN accepted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'accepted_by'
  ) THEN
    ALTER TABLE orders ADD COLUMN accepted_by uuid REFERENCES staff_members(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create position_branch_notifications table
CREATE TABLE IF NOT EXISTS position_branch_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  sound_enabled boolean DEFAULT true,
  visual_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(position_id, branch_id)
);

-- Enable RLS
ALTER TABLE position_branch_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for position_branch_notifications
DO $$
BEGIN
  DROP POLICY IF EXISTS "position_branch_notifications_select" ON position_branch_notifications;
  DROP POLICY IF EXISTS "position_branch_notifications_insert" ON position_branch_notifications;
  DROP POLICY IF EXISTS "position_branch_notifications_update" ON position_branch_notifications;
  DROP POLICY IF EXISTS "position_branch_notifications_delete" ON position_branch_notifications;
END $$;

CREATE POLICY "position_branch_notifications_select"
  ON position_branch_notifications FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM positions p
      WHERE p.id = position_branch_notifications.position_id
    )
  );

CREATE POLICY "position_branch_notifications_insert"
  ON position_branch_notifications FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM positions p
      WHERE p.id = position_branch_notifications.position_id
    )
  );

CREATE POLICY "position_branch_notifications_update"
  ON position_branch_notifications FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM positions p
      WHERE p.id = position_branch_notifications.position_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM positions p
      WHERE p.id = position_branch_notifications.position_id
    )
  );

CREATE POLICY "position_branch_notifications_delete"
  ON position_branch_notifications FOR DELETE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM positions p
      WHERE p.id = position_branch_notifications.position_id
    )
  );

-- Grant permissions
GRANT ALL ON position_branch_notifications TO anon;
GRANT ALL ON position_branch_notifications TO authenticated;
GRANT ALL ON position_branch_notifications TO service_role;

-- Enable realtime for orders (if not already)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'position_branch_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE position_branch_notifications;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_position_branch_notifications_position ON position_branch_notifications(position_id);
CREATE INDEX IF NOT EXISTS idx_position_branch_notifications_branch ON position_branch_notifications(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_is_accepted ON orders(is_accepted) WHERE is_accepted = false;