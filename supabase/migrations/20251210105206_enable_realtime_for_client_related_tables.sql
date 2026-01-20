/*
  # Enable Realtime for Client Related Tables

  ## Overview
  Enables realtime subscriptions for client-related tables.

  ## Changes
    - Adds client_addresses table to supabase_realtime publication
    - Adds client_orders_history table to supabase_realtime publication

  ## Purpose
    - Enable live updates for client addresses and order history
*/

-- Enable realtime for client-related tables
DO $$
BEGIN
  -- Add client_addresses if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'client_addresses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE client_addresses;
  END IF;

  -- Add client_orders_history if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'client_orders_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE client_orders_history;
  END IF;
END $$;