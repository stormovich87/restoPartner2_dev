/*
  # Create Employees HR System

  1. New Tables
    - `employees`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, foreign key to partners)
      - `branch_id` (uuid, foreign key to branches)
      - `position_id` (uuid, foreign key to positions)
      - `first_name` (text)
      - `last_name` (text)
      - `phone` (text)
      - `email` (text)
      - `telegram_username` (text)
      - `telegram_user_id` (text)
      - `bank_card_number` (text)
      - `current_status` (text) - working, on_vacation, pending_dismissal, fired
      - `vacation_end_date` (date) - for vacation status
      - `hire_date` (date) - date when employee was hired
      - `is_active` (boolean) - true = working, false = fired
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `employment_history`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key to employees)
      - `start_date` (date) - when this employment period started
      - `end_date` (date, nullable) - when this employment period ended
      - `status_type` (text) - worked, fired, quit
      - `fired_reason` (text, nullable)
      - `created_at` (timestamptz)

  2. Partner Settings
    - Add employee bot settings to partner_settings table

  3. Security
    - Enable RLS on all new tables
    - Add policies for partner-based access
*/

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  position_id uuid REFERENCES positions(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text,
  phone text,
  email text,
  telegram_username text,
  telegram_user_id text,
  bank_card_number text,
  current_status text NOT NULL DEFAULT 'working' CHECK (current_status IN ('working', 'on_vacation', 'pending_dismissal', 'fired')),
  vacation_end_date date,
  hire_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create employment_history table
CREATE TABLE IF NOT EXISTS employment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  status_type text NOT NULL CHECK (status_type IN ('worked', 'fired', 'quit')),
  fired_reason text,
  created_at timestamptz DEFAULT now()
);

-- Add employee bot settings to partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'employee_bot_token'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN employee_bot_token text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'employee_bot_enabled'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN employee_bot_enabled boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'employee_bot_allow_registration'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN employee_bot_allow_registration boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'employee_bot_allow_update'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN employee_bot_allow_update boolean DEFAULT true;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_partner_id ON employees(partner_id);
CREATE INDEX IF NOT EXISTS idx_employees_branch_id ON employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_position_id ON employees(position_id);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_current_status ON employees(current_status);
CREATE INDEX IF NOT EXISTS idx_employment_history_employee_id ON employment_history(employee_id);

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employees - Allow all operations (partner filtering done in app)
CREATE POLICY "Allow all operations on employees"
  ON employees FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- RLS Policies for employment_history - Allow all operations (filtering done in app)
CREATE POLICY "Allow all operations on employment_history"
  ON employment_history FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Enable realtime for employees
ALTER PUBLICATION supabase_realtime ADD TABLE employees;
ALTER PUBLICATION supabase_realtime ADD TABLE employment_history;
