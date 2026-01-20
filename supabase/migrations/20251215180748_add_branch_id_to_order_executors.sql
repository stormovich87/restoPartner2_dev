/*
  # Add branch_id to order_executors table

  This migration adds branch_id field to order_executors table to support
  distribute_by_branches feature where one order can have multiple order_executor
  records for different branches.

  1. Changes:
    - Add branch_id column (nullable, foreign key to branches)
    - Remove UNIQUE(order_id, executor_id) constraint
    - Add new UNIQUE(order_id, executor_id, branch_id) constraint to allow 
      multiple records for same order/executor but different branches

  2. Notes:
    - branch_id is NULL for executors without distribute_by_branches
    - branch_id is set for each branch when distribute_by_branches is ON
    - This allows independent acceptance by couriers from different branches
*/

-- Drop existing unique constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_executors_order_id_executor_id_key'
  ) THEN
    ALTER TABLE order_executors DROP CONSTRAINT order_executors_order_id_executor_id_key;
  END IF;
END $$;

-- Add branch_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_executors' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE order_executors ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add new unique constraint that includes branch_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_executors_order_executor_branch_unique'
  ) THEN
    ALTER TABLE order_executors 
      ADD CONSTRAINT order_executors_order_executor_branch_unique 
      UNIQUE (order_id, executor_id, branch_id);
  END IF;
END $$;

-- Add index for branch_id
CREATE INDEX IF NOT EXISTS idx_order_executors_branch_id ON order_executors(branch_id);

COMMENT ON COLUMN order_executors.branch_id IS 'Branch ID when executor uses distribute_by_branches. NULL for executors without branch distribution.';