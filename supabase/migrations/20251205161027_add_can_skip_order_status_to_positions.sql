/*
  # Add can_skip_order_status permission to positions

  1. Changes
    - Add `can_skip_order_status` column to positions table
    - Default value is false for security
    - This permission allows staff to skip order status transitions (e.g., from "in_progress" directly to "completed")
  
  2. Security
    - Permission is opt-in (default false)
    - Only staff members with this permission can skip intermediate statuses
    - Works together with can_revert_order_status for full status management
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'positions' AND column_name = 'can_skip_order_status'
  ) THEN
    ALTER TABLE positions ADD COLUMN can_skip_order_status boolean DEFAULT false;
  END IF;
END $$;
