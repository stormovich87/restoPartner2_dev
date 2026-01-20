/*
  # Make logs.action nullable

  ## Overview
  This migration updates the logs table to make the action column nullable, allowing logs without a specific action.

  ## Changes
    - Alter `logs.action` column to be nullable
    - This allows logging events that don't have a specific action associated with them

  ## Important Notes
    1. Some logs may not have an associated action (general information logs, errors)
    2. Existing NOT NULL constraint is removed to allow flexible logging
*/

-- Make action nullable in logs table
ALTER TABLE logs ALTER COLUMN action DROP NOT NULL;