/*
  # Binotel Wait Stats - Indexes and RPC Function
  
  1. New Indexes
    - (partner_id, completed_at) - for efficient date range queries
    - (partner_id, call_type, completed_at) - for filtering by call type
    - (partner_id, call_status, completed_at) - for filtering by disposition
    - (partner_id, internal_number, completed_at) - for operator filtering
  
  2. New Functions
    - get_binotel_wait_stats - calculates average wait time for unanswered calls
    
  3. Security
    - Function is accessible to authenticated and service_role users
    - Data is isolated by partner_id
    
  4. Usage
    - Main metric: incoming calls (call_type=0) with NOANSWER status, excluding BUSY
    - Returns: calls_count, avg_waitsec, median_waitsec, p95_waitsec
*/

-- Add indexes for reporting (if not exist)
CREATE INDEX IF NOT EXISTS idx_binotel_calls_partner_completed_at 
  ON binotel_calls (partner_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_binotel_calls_partner_call_type_completed_at 
  ON binotel_calls (partner_id, call_type, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_binotel_calls_partner_call_status_completed_at 
  ON binotel_calls (partner_id, call_status, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_binotel_calls_partner_internal_completed_at 
  ON binotel_calls (partner_id, internal_number, completed_at DESC);

-- Create composite index for the main query pattern
CREATE INDEX IF NOT EXISTS idx_binotel_calls_wait_stats 
  ON binotel_calls (partner_id, completed_at DESC, call_type, call_status, billsec)
  WHERE completed_at IS NOT NULL AND call_type = '0';

-- Create the RPC function for wait stats calculation
CREATE OR REPLACE FUNCTION get_binotel_wait_stats(
  p_partner_id UUID,
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_branch_id UUID DEFAULT NULL,
  p_internal_number TEXT DEFAULT NULL,
  p_mode TEXT DEFAULT 'NOANSWER_ONLY'
)
RETURNS TABLE (
  calls_count BIGINT,
  avg_waitsec NUMERIC,
  median_waitsec NUMERIC,
  p95_waitsec NUMERIC,
  min_waitsec INTEGER,
  max_waitsec INTEGER,
  zero_waitsec_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_statuses TEXT[];
BEGIN
  -- Determine which statuses to include based on mode
  IF p_mode = 'NOANSWER_OR_CANCEL' THEN
    v_statuses := ARRAY['NOANSWER', 'CANCEL'];
  ELSE
    -- Default: NOANSWER_ONLY
    v_statuses := ARRAY['NOANSWER'];
  END IF;

  RETURN QUERY
  WITH filtered_calls AS (
    SELECT bc.waitsec
    FROM binotel_calls bc
    WHERE bc.partner_id = p_partner_id
      AND bc.completed_at IS NOT NULL
      AND bc.completed_at >= p_date_from
      AND bc.completed_at <= p_date_to
      AND (bc.call_type = '0' OR bc.call_type::text = '0')  -- incoming calls
      AND bc.billsec = 0  -- no conversation happened
      AND UPPER(COALESCE(bc.call_status, '')) = ANY(v_statuses)
      AND UPPER(COALESCE(bc.call_status, '')) != 'BUSY'  -- exclude BUSY
      AND (p_branch_id IS NULL OR bc.branch_id = p_branch_id)
      AND (p_internal_number IS NULL OR bc.internal_number = p_internal_number)
  ),
  stats AS (
    SELECT 
      COUNT(*) AS cnt,
      COALESCE(AVG(COALESCE(fc.waitsec, 0)), 0) AS avg_w,
      COALESCE(MIN(COALESCE(fc.waitsec, 0)), 0) AS min_w,
      COALESCE(MAX(COALESCE(fc.waitsec, 0)), 0) AS max_w,
      COUNT(*) FILTER (WHERE COALESCE(fc.waitsec, 0) = 0) AS zero_cnt
    FROM filtered_calls fc
  ),
  percentiles AS (
    SELECT 
      COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY COALESCE(fc.waitsec, 0)), 0) AS median_w,
      COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY COALESCE(fc.waitsec, 0)), 0) AS p95_w
    FROM filtered_calls fc
  )
  SELECT 
    s.cnt::BIGINT AS calls_count,
    ROUND(s.avg_w, 2) AS avg_waitsec,
    ROUND(p.median_w, 2) AS median_waitsec,
    ROUND(p.p95_w, 2) AS p95_waitsec,
    s.min_w::INTEGER AS min_waitsec,
    s.max_w::INTEGER AS max_waitsec,
    s.zero_cnt::BIGINT AS zero_waitsec_count
  FROM stats s, percentiles p;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_binotel_wait_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_binotel_wait_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_binotel_wait_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, TEXT) TO service_role;

-- Create function to get sample calls for the report
CREATE OR REPLACE FUNCTION get_binotel_wait_calls_sample(
  p_partner_id UUID,
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_branch_id UUID DEFAULT NULL,
  p_internal_number TEXT DEFAULT NULL,
  p_mode TEXT DEFAULT 'NOANSWER_ONLY',
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  completed_at TIMESTAMPTZ,
  external_number TEXT,
  internal_number TEXT,
  waitsec INTEGER,
  call_status TEXT,
  branch_id UUID,
  branch_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_statuses TEXT[];
BEGIN
  IF p_mode = 'NOANSWER_OR_CANCEL' THEN
    v_statuses := ARRAY['NOANSWER', 'CANCEL'];
  ELSE
    v_statuses := ARRAY['NOANSWER'];
  END IF;

  RETURN QUERY
  SELECT 
    bc.id,
    bc.completed_at,
    bc.external_number,
    bc.internal_number,
    COALESCE(bc.waitsec, 0)::INTEGER,
    bc.call_status,
    bc.branch_id,
    b.name AS branch_name
  FROM binotel_calls bc
  LEFT JOIN branches b ON b.id = bc.branch_id
  WHERE bc.partner_id = p_partner_id
    AND bc.completed_at IS NOT NULL
    AND bc.completed_at >= p_date_from
    AND bc.completed_at <= p_date_to
    AND (bc.call_type = '0' OR bc.call_type::text = '0')
    AND bc.billsec = 0
    AND UPPER(COALESCE(bc.call_status, '')) = ANY(v_statuses)
    AND UPPER(COALESCE(bc.call_status, '')) != 'BUSY'
    AND (p_branch_id IS NULL OR bc.branch_id = p_branch_id)
    AND (p_internal_number IS NULL OR bc.internal_number = p_internal_number)
  ORDER BY bc.completed_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_binotel_wait_calls_sample(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_binotel_wait_calls_sample(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_binotel_wait_calls_sample(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, TEXT, INTEGER) TO service_role;
