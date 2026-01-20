/*
  # Enable Realtime for Clients Table

  ## Overview
  Enables realtime subscriptions for the clients table so the UI updates automatically.

  ## Changes
    - Adds clients table to supabase_realtime publication
    - Allows real-time updates when clients are created or modified

  ## Purpose
    - Enable live updates in the Clients page
    - Ensure UI reflects database changes immediately
*/

-- Enable realtime for clients table
ALTER PUBLICATION supabase_realtime ADD TABLE clients;