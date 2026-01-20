/*
  # Make period_id and position_id nullable in schedule_shifts
  
  1. Changes
    - Make `period_id` nullable - not all shifts are part of a schedule period (e.g., replacements)
    - Make `position_id` nullable - position can be derived from employee data
  
  2. Purpose
    - Allow creation of replacement shifts without requiring a schedule period
    - Simplify shift creation workflow
*/

-- Make period_id nullable
ALTER TABLE schedule_shifts 
ALTER COLUMN period_id DROP NOT NULL;

-- Make position_id nullable
ALTER TABLE schedule_shifts 
ALTER COLUMN position_id DROP NOT NULL;
