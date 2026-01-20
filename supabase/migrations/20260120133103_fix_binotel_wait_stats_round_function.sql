/*
  # Fix Binotel Wait Stats - Round Function Type Cast
  
  1. Changes
    - Fix round() function calls to cast double precision to numeric
    - PostgreSQL round(numeric, integer) requires explicit cast from double precision
*/

-- Drop and recreate the function with proper type casting
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
  IF p_mode = 'NOANSWER_OR_CANCEL' THEN
    v_statuses := ARRAY['NOANSWER', 'CANCEL'];
  ELSE
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
      AND (bc.call_type = '0' OR bc.call_type::text = '0')
      AND bc.billsec = 0
      AND UPPER(COALESCE(bc.call_status, '')) = ANY(v_statuses)
      AND UPPER(COALESCE(bc.call_status, '')) != 'BUSY'
      AND (p_branch_id IS NULL OR bc.branch_id = p_branch_id)
      AND (p_internal_number IS NULL OR bc.internal_number = p_internal_number)
  ),
  stats AS (
    SELECT 
      COUNT(*) AS cnt,
      COALESCE(AVG(COALESCE(fc.waitsec, 0)), 0)::NUMERIC AS avg_w,
      COALESCE(MIN(COALESCE(fc.waitsec, 0)), 0) AS min_w,
      COALESCE(MAX(COALESCE(fc.waitsec, 0)), 0) AS max_w,
      COUNT(*) FILTER (WHERE COALESCE(fc.waitsec, 0) = 0) AS zero_cnt
    FROM filtered_calls fc
  ),
  percentiles AS (
    SELECT 
      COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY COALESCE(fc.waitsec, 0)), 0)::NUMERIC AS median_w,
      COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY COALESCE(fc.waitsec, 0)), 0)::NUMERIC AS p95_w
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
