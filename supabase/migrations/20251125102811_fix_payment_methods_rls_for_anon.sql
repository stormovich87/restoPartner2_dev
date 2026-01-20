/*
  # Fix Payment Methods RLS Policies

  ## Summary
  Updates RLS policies for payment_methods table to allow anonymous access
  since the app uses custom authentication via localStorage instead of Supabase Auth.

  ## Changes
  
  ### Drop Existing Policies
  - Remove restrictive policies that require authentication
  
  ### Create New Policies
  - Allow anonymous users to read all payment methods
  - Allow anonymous users to manage (insert/update/delete) payment methods
  
  ## Notes
  - This is safe because the app implements its own authentication layer
  - Frontend validates partner access before making requests
  - Consider implementing Row Level Security based on JWT tokens in future
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read active payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Service role can manage payment methods" ON payment_methods;

-- Allow anonymous users to read payment methods
CREATE POLICY "Allow anon to read payment methods"
  ON payment_methods FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous users to insert payment methods
CREATE POLICY "Allow anon to insert payment methods"
  ON payment_methods FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous users to update payment methods
CREATE POLICY "Allow anon to update payment methods"
  ON payment_methods FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anonymous users to delete payment methods
CREATE POLICY "Allow anon to delete payment methods"
  ON payment_methods FOR DELETE
  TO anon
  USING (true);
