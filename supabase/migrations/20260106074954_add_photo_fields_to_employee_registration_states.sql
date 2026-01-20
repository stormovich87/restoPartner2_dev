/*
  # Add photo fields to employee registration states

  1. Changes
    - Add `photo_url` column to employee_registration_states table
    - Add `photo_file_id` column to employee_registration_states table

  2. Notes
    - These fields store temporary photo data during registration process
*/

ALTER TABLE employee_registration_states
ADD COLUMN IF NOT EXISTS photo_url text,
ADD COLUMN IF NOT EXISTS photo_file_id text;
