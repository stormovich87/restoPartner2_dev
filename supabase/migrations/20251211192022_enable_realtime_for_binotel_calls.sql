/*
  # Enable Realtime for Binotel Calls Table

  ## Overview
  This migration enables realtime functionality for the binotel_calls table.
  This allows the frontend to receive instant notifications when new calls are logged.

  ## Changes
    - Enable realtime publication for `binotel_calls` table
    - Configure realtime to broadcast INSERT events

  ## Important Notes
    1. The frontend subscribes to postgres_changes on this table
    2. When a new incoming call is logged, the UI receives an instant notification
    3. This is essential for the Binotel integration to show incoming call popups
*/

ALTER PUBLICATION supabase_realtime ADD TABLE binotel_calls;
