/*
  # Add Urgent Shift System

  1. New Fields on schedule_shifts:
    - `urgent_request_enabled` (boolean) - Flag indicating urgent shift is enabled
    - `urgent_request_text` (text) - Message from administrator to employee
    - `urgent_request_status` (text) - Status: sent, accepted, declined
    - `urgent_requested_at` (timestamptz) - When urgent request was sent
    - `urgent_responded_at` (timestamptz) - When employee responded
    - `urgent_request_telegram_message_id` (bigint) - For cleanup after response
    - `urgent_request_event_id` (uuid) - Reference to employee event for cleanup

  2. Security:
    - No RLS changes needed as schedule_shifts already has policies
*/

ALTER TABLE schedule_shifts
ADD COLUMN IF NOT EXISTS urgent_request_enabled boolean DEFAULT false;

ALTER TABLE schedule_shifts
ADD COLUMN IF NOT EXISTS urgent_request_text text;

ALTER TABLE schedule_shifts
ADD COLUMN IF NOT EXISTS urgent_request_status text;

ALTER TABLE schedule_shifts
ADD COLUMN IF NOT EXISTS urgent_requested_at timestamptz;

ALTER TABLE schedule_shifts
ADD COLUMN IF NOT EXISTS urgent_responded_at timestamptz;

ALTER TABLE schedule_shifts
ADD COLUMN IF NOT EXISTS urgent_request_telegram_message_id bigint;

ALTER TABLE schedule_shifts
ADD COLUMN IF NOT EXISTS urgent_request_event_id uuid REFERENCES employee_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_shifts_urgent_request_status
ON schedule_shifts(urgent_request_status)
WHERE urgent_request_enabled = true;

COMMENT ON COLUMN schedule_shifts.urgent_request_enabled IS 'Flag indicating this is an urgent shift request';
COMMENT ON COLUMN schedule_shifts.urgent_request_text IS 'Custom message from administrator to employee for urgent shift';
COMMENT ON COLUMN schedule_shifts.urgent_request_status IS 'Status of urgent request: sent, accepted, declined';
COMMENT ON COLUMN schedule_shifts.urgent_requested_at IS 'Timestamp when urgent request was sent to employee';
COMMENT ON COLUMN schedule_shifts.urgent_responded_at IS 'Timestamp when employee responded to urgent request';
