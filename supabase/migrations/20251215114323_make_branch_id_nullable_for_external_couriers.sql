/*
  # Make branch_id nullable for external couriers

  1. Changes
    - Make branch_id column nullable in couriers table
    - External couriers may not be assigned to a specific branch

  2. Notes
    - External couriers registered via Telegram bot don't need branch assignment
*/

ALTER TABLE couriers ALTER COLUMN branch_id DROP NOT NULL;
