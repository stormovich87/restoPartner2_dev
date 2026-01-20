/*
  # Add timezone-aware date function

  1. New Function
    - `get_date_in_timezone(tz text)` - Returns current date in specified timezone
  
  2. Purpose
    - Ensure poll responses are recorded with correct date in Europe/Sofia timezone
    - Prevent date mismatch issues when polls are sent near midnight
*/

CREATE OR REPLACE FUNCTION get_date_in_timezone(tz text DEFAULT 'Europe/Sofia')
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (now() AT TIME ZONE tz)::date;
$$;

GRANT EXECUTE ON FUNCTION get_date_in_timezone(text) TO anon;
GRANT EXECUTE ON FUNCTION get_date_in_timezone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_date_in_timezone(text) TO service_role;
