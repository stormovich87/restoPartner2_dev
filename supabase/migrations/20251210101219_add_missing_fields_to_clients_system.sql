/*
  # Add Missing Fields to Clients System

  ## Overview
  This migration adds missing fields to the existing clients management tables.

  ## Changes
  
  ### clients table
    - Add `additional_phones` (text[]) - Array of additional phone numbers
    - Add `last_order_date` (timestamptz) - Date of last order for sorting

  ### client_addresses table
    - Add `updated_at` (timestamptz) - When address was last updated

  ### client_orders_history table
    - Add `order_number` (text) - Order number for display
    - Add `total_amount` (numeric) - Order total amount for display

  ## Important Notes
    1. These fields enable better client tracking and sorting
    2. Maintains compatibility with existing data
*/

-- Add missing fields to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'additional_phones'
  ) THEN
    ALTER TABLE clients ADD COLUMN additional_phones text[] DEFAULT ARRAY[]::text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'last_order_date'
  ) THEN
    ALTER TABLE clients ADD COLUMN last_order_date timestamptz;
  END IF;
END $$;

-- Add missing fields to client_addresses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_addresses' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE client_addresses ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add missing fields to client_orders_history table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_orders_history' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE client_orders_history ADD COLUMN order_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_orders_history' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE client_orders_history ADD COLUMN total_amount numeric(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_clients_last_order_date ON clients(last_order_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_client_orders_history_order_number ON client_orders_history(order_number);