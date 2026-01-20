/*
  # Enable REPLICA IDENTITY FULL for employee_events

  1. Changes
    - Set REPLICA IDENTITY FULL on employee_events table
    - This allows Supabase Realtime to send complete row data for UPDATE events
    - Fixes issue where realtime updates are not detected in employee cabinet

  2. Why this is needed
    - Without REPLICA IDENTITY FULL, Supabase Realtime only sends the primary key
    - With REPLICA IDENTITY FULL, all columns are sent in realtime payloads
    - This is required for proper state management in the frontend
*/

-- Enable REPLICA IDENTITY FULL for employee_events
ALTER TABLE employee_events REPLICA IDENTITY FULL;