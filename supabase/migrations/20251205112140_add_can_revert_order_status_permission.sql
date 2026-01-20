/*
  # Add can_revert_order_status permission to positions

  1. Changes
    - Add `can_revert_order_status` column to positions table
    - Default value is false for security
    - This permission controls whether a staff member can manually revert order status back (e.g., from completed to in_progress)
  
  2. Security
    - Permission is opt-in (default false)
    - Only staff members with this permission can change order status backwards
    - Helps track manual interventions in order workflow
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'positions' AND column_name = 'can_revert_order_status'
  ) THEN
    ALTER TABLE positions ADD COLUMN can_revert_order_status boolean DEFAULT false;
  END IF;
END $$;
