/*
  # Fix Position Branch Notifications

  1. Changes
    - Create missing position_branch_notifications records for existing position-branch combinations
    - Set default values to sound_enabled: true, visual_enabled: true for better user experience

  2. Purpose
    - Ensure all existing positions have notification settings for their assigned branches
    - Enable notifications by default so they work immediately when turned on in settings
*/

-- Create missing position_branch_notifications for existing position-branch combinations
INSERT INTO position_branch_notifications (position_id, branch_id, sound_enabled, visual_enabled)
SELECT
  pb.position_id,
  pb.branch_id,
  true as sound_enabled,
  true as visual_enabled
FROM position_branches pb
LEFT JOIN position_branch_notifications pbn
  ON pbn.position_id = pb.position_id
  AND pbn.branch_id = pb.branch_id
WHERE pbn.id IS NULL
ON CONFLICT (position_id, branch_id) DO NOTHING;