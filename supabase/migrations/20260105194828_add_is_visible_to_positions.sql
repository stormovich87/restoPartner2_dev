/*
  # Add visibility toggle to positions

  1. Changes
    - Add `is_visible` boolean field to `positions` table
      - Default: true (all existing positions remain visible)
      - Used to control which positions appear in employee registration bot
  
  2. Notes
    - Existing positions will automatically be visible (default true)
    - When is_visible is false, position won't show in employee-registration-bot
*/

-- Add is_visible field to positions table
ALTER TABLE positions 
ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT true NOT NULL;

-- Add index for faster filtering of visible positions
CREATE INDEX IF NOT EXISTS idx_positions_visible_partner 
ON positions(partner_id, is_visible) 
WHERE is_visible = true;
