/*
  # Add replacement employee info to employee_events

  1. New Columns
    - `replacement_employee_id` (uuid) - ID of the replacement employee
    - `replacement_employee_name` (text) - Name of the replacement employee

  2. Purpose
    - Store information about who was assigned as replacement
    - Allow displaying replacement info in late decline events
*/

ALTER TABLE employee_events
ADD COLUMN IF NOT EXISTS replacement_employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS replacement_employee_name text;