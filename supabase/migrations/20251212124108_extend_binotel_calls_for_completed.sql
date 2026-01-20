/*
  # Extend binotel_calls table for call completion tracking

  1. New Columns for binotel_calls
    - `general_call_id` (text) - Binotel's unique call identifier
    - `disposition` (text) - Call result: ANSWER/NOANSWER/BUSY/FAILED
    - `waitsec` (integer) - Wait time in seconds
    - `billsec` (integer) - Billable seconds (call duration)
    - `started_at` (timestamptz) - When call started
    - `completed_at` (timestamptz) - When call completed
    - `employee_email` (text) - Employee email from Binotel
    - `employee_name` (text) - Employee name from Binotel
    - `customer_binotel_id` (text) - Customer ID in Binotel
    - `client_id` (uuid) - Reference to clients table
    - `order_id` (uuid) - Reference to orders table if order created from call
    - `is_missed` (boolean) - Whether call was missed
    - `is_outgoing` (boolean) - Whether call is outgoing
    - `is_dismissed` (boolean) - Whether notification was dismissed by user
    - `raw_completed` (jsonb) - Raw completed webhook data

  2. New Columns for orders
    - `binotel_call_id` (uuid) - Reference to binotel_calls
    - `source_call_id` (text) - Binotel general_call_id for reference

  3. Indexes
    - Index on general_call_id for lookup
    - Index on client_id for client history
    - Index on is_missed for filtering
*/

-- Add new columns to binotel_calls
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'general_call_id'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN general_call_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'disposition'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN disposition text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'waitsec'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN waitsec integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'billsec'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN billsec integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN started_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'employee_email'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN employee_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'employee_name'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN employee_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'customer_binotel_id'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN customer_binotel_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'order_id'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN order_id uuid REFERENCES orders(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'is_missed'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN is_missed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'is_outgoing'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN is_outgoing boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'is_dismissed'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN is_dismissed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'binotel_calls' AND column_name = 'raw_completed'
  ) THEN
    ALTER TABLE binotel_calls ADD COLUMN raw_completed jsonb;
  END IF;
END $$;

-- Add binotel fields to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'binotel_call_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN binotel_call_id uuid REFERENCES binotel_calls(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'source_call_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN source_call_id text;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_binotel_calls_general_call_id ON binotel_calls(general_call_id);
CREATE INDEX IF NOT EXISTS idx_binotel_calls_client_id ON binotel_calls(client_id);
CREATE INDEX IF NOT EXISTS idx_binotel_calls_is_missed ON binotel_calls(is_missed) WHERE is_missed = true;
CREATE INDEX IF NOT EXISTS idx_binotel_calls_is_dismissed ON binotel_calls(is_dismissed);
CREATE INDEX IF NOT EXISTS idx_binotel_calls_partner_active ON binotel_calls(partner_id, is_dismissed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_binotel_call_id ON orders(binotel_call_id);
