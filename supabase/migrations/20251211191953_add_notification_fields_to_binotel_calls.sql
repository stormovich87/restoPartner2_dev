/*
  # Add Notification Fields to Binotel Calls

  ## Overview
  This migration adds fields to support real-time incoming call notifications in the UI.
  When a call comes in, these fields are populated so the frontend can display a notification.

  ## Changes to `binotel_calls` Table
    - Add `notification_phone` (text, nullable) - Formatted phone number for display in notification
    - Add `notification_branch_id` (uuid, nullable) - Branch ID associated with the call
    - Add `notification_shown` (boolean, nullable) - Whether notification has been shown in UI (false = pending, true = shown, null = no notification needed)

  ## Indexes
    - Add index on `notification_shown` for efficient querying of pending notifications

  ## Important Notes
    1. These fields are only populated for incoming calls (call_type = '0') when Binotel integration is enabled
    2. The frontend subscribes to postgres_changes on this table to receive real-time notifications
    3. When notification is shown, the UI should update `notification_shown` to true
*/

ALTER TABLE binotel_calls
ADD COLUMN IF NOT EXISTS notification_phone text,
ADD COLUMN IF NOT EXISTS notification_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS notification_shown boolean;

CREATE INDEX IF NOT EXISTS idx_binotel_calls_notification_shown 
  ON binotel_calls(partner_id, notification_shown, created_at DESC) 
  WHERE notification_shown = false;

COMMENT ON COLUMN binotel_calls.notification_phone IS 'Formatted phone number for UI notification display';
COMMENT ON COLUMN binotel_calls.notification_branch_id IS 'Branch associated with this call for filtering notifications';
COMMENT ON COLUMN binotel_calls.notification_shown IS 'false = pending notification, true = shown, null = no notification needed';
