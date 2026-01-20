/*
  # Add 'en_route' status to orders

  1. Changes
    - No schema changes needed as status is stored as text without CHECK constraint
    - This migration documents the addition of 'en_route' status to the order workflow
  
  2. Status Flow
    - searching → accepted (courier accepts order)
    - accepted → en_route (courier starts delivery)
    - en_route → completed (delivery finished)
    - accepted/en_route → searching (order cancelled by courier)
  
  3. Notes
    - Status values: 'searching', 'accepted', 'en_route', 'in_progress', 'completed'
    - 'in_progress' is used for executor workflow (separate from courier workflow)
*/

-- No schema changes needed - this migration documents the new status
-- The status column is already flexible enough to accept 'en_route' value
