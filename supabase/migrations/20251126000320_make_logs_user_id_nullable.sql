/*
  # Make logs.user_id nullable

  ## Overview
  This migration updates the logs table to make the user_id column nullable, allowing system logs that are not associated with a specific user.

  ## Changes
    - Alter `logs.user_id` column to be nullable
    - This allows logging events that happen outside of a user context (e.g., system operations, automated tasks)

  ## Important Notes
    1. Some logs may not have an associated user (system logs, automated operations)
    2. Existing NOT NULL constraint is removed to allow flexible logging
    3. The foreign key constraint remains in place for referential integrity when user_id is provided
*/

-- Make user_id nullable in logs table
ALTER TABLE logs ALTER COLUMN user_id DROP NOT NULL;