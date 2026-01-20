/*
  # Grant permissions to positions table

  1. Changes
    - Grant all necessary permissions to anon and authenticated roles
    - This allows users to perform operations on positions table

  2. Security
    - RLS policies still control what data users can access
    - Base table permissions are required for any operations
*/

GRANT SELECT, INSERT, UPDATE, DELETE ON positions TO anon, authenticated;