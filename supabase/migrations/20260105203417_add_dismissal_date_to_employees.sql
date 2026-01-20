/*
  # Add scheduled dismissal support

  1. Changes
    - Add `dismissal_date` column to employees table for scheduled dismissals
    - Add `dismissal_reason` column to store reason before actual dismissal
    - Add `dismissal_type` column to store type (fired/quit) before actual dismissal

  2. Notes
    - Employees with pending_dismissal status will have a dismissal_date set
    - When dismissal_date is reached, the employee should be moved to fired status
*/

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS dismissal_date date,
ADD COLUMN IF NOT EXISTS dismissal_reason text,
ADD COLUMN IF NOT EXISTS dismissal_type text;
