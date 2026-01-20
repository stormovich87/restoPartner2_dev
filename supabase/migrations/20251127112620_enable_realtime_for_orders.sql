/*
  # Enable Realtime for Orders Table

  1. Changes
    - Enable realtime replication for the `orders` table
    - This allows clients to receive instant updates when orders are created, updated, or deleted

  2. Purpose
    - Ensures that the UI updates immediately when orders are created or modified
    - Eliminates the need to refresh the page to see new or updated orders
*/

alter publication supabase_realtime add table orders;
