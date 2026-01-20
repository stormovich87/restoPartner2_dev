/*
  # Add zone_id to order_executors table

  1. Changes
    - Add `zone_id` column to `order_executors` table to store the selected delivery zone
    - This allows proper tracking of which zone was selected when an executor was assigned

  2. Purpose
    - When an order is automatically assigned to an executor on completion,
      the zone information will be preserved
    - Fixes issue where executor_zone_id was null in orders when auto-assigned
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_executors' AND column_name = 'zone_id'
  ) THEN
    ALTER TABLE order_executors ADD COLUMN zone_id uuid REFERENCES performer_delivery_zones(id);
  END IF;
END $$;
