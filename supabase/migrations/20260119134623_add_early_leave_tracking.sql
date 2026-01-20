/*
  # Add Early Leave Tracking

  1. New Fields
    - `early_leave_minutes` (integer) - Minutes left early (negative = stayed longer)
    - `early_leave_at` (timestamp) - When early leave was detected
    - `early_leave_reset` (boolean) - True if schedule was adjusted to match actual time

  2. Changes
    - Add trigger to detect early leave when shift closes
    - Add trigger to reset early leave flag when schedule is adjusted
    - Calculate early leave based on actual_end_at vs end_time

  3. Logic
    - Early leave detected when actual_end_at < scheduled end_time by 5+ minutes
    - If schedule is adjusted to match actual time, early_leave_reset = true
*/

-- Add early leave tracking fields
ALTER TABLE schedule_shifts 
ADD COLUMN IF NOT EXISTS early_leave_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS early_leave_at timestamptz,
ADD COLUMN IF NOT EXISTS early_leave_reset boolean DEFAULT false;

-- Function to detect early leave when shift closes
CREATE OR REPLACE FUNCTION detect_early_leave()
RETURNS TRIGGER AS $$
DECLARE
  scheduled_end_time time;
  actual_end_time time;
  scheduled_datetime timestamptz;
  actual_datetime timestamptz;
  diff_minutes integer;
BEGIN
  -- Only process when shift is being closed or actual_end_at is set
  IF NEW.actual_end_at IS NOT NULL AND 
     (OLD.actual_end_at IS NULL OR OLD.actual_end_at != NEW.actual_end_at) THEN
    
    -- Get scheduled end time
    scheduled_end_time := NEW.end_time;
    actual_end_time := NEW.actual_end_at::time;
    
    -- Build full timestamps for comparison
    scheduled_datetime := (NEW.date || ' ' || scheduled_end_time::text)::timestamptz;
    actual_datetime := NEW.actual_end_at;
    
    -- Calculate difference in minutes (positive = left early, negative = stayed late)
    diff_minutes := EXTRACT(EPOCH FROM (scheduled_datetime - actual_datetime)) / 60;
    
    -- Consider it early leave if left 5+ minutes early
    IF diff_minutes >= 5 THEN
      NEW.early_leave_minutes := diff_minutes;
      NEW.early_leave_at := NOW();
      NEW.early_leave_reset := false;
    ELSE
      NEW.early_leave_minutes := 0;
      NEW.early_leave_at := NULL;
      NEW.early_leave_reset := false;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle schedule adjustments
CREATE OR REPLACE FUNCTION handle_schedule_adjustment()
RETURNS TRIGGER AS $$
DECLARE
  scheduled_end_time time;
  actual_end_time time;
  time_diff_minutes integer;
BEGIN
  -- Check if end_time was changed and there's an actual_end_at
  IF OLD.end_time IS DISTINCT FROM NEW.end_time AND 
     NEW.actual_end_at IS NOT NULL THEN
    
    actual_end_time := NEW.actual_end_at::time;
    
    -- Calculate difference between new schedule and actual (in minutes)
    time_diff_minutes := ABS(
      EXTRACT(EPOCH FROM (NEW.end_time - actual_end_time)) / 60
    );
    
    -- If the new schedule matches actual time (within 5 minutes), mark as adjusted
    IF time_diff_minutes < 5 THEN
      NEW.early_leave_minutes := 0;
      NEW.early_leave_at := NULL;
      NEW.early_leave_reset := true;
    ELSE
      -- Recalculate early leave with new schedule
      DECLARE
        scheduled_datetime timestamptz;
        actual_datetime timestamptz;
        diff_minutes integer;
      BEGIN
        scheduled_datetime := (NEW.date || ' ' || NEW.end_time::text)::timestamptz;
        actual_datetime := NEW.actual_end_at;
        diff_minutes := EXTRACT(EPOCH FROM (scheduled_datetime - actual_datetime)) / 60;
        
        IF diff_minutes >= 5 THEN
          NEW.early_leave_minutes := diff_minutes;
          NEW.early_leave_at := NOW();
          NEW.early_leave_reset := false;
        ELSE
          NEW.early_leave_minutes := 0;
          NEW.early_leave_at := NULL;
          NEW.early_leave_reset := false;
        END IF;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_detect_early_leave ON schedule_shifts;
DROP TRIGGER IF EXISTS trigger_handle_schedule_adjustment ON schedule_shifts;

-- Create trigger to detect early leave
CREATE TRIGGER trigger_detect_early_leave
  BEFORE UPDATE OF actual_end_at ON schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION detect_early_leave();

-- Create trigger to handle schedule adjustments
CREATE TRIGGER trigger_handle_schedule_adjustment
  BEFORE UPDATE OF end_time ON schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION handle_schedule_adjustment();
