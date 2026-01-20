/*
  # Add Early Leave Threshold Setting

  1. New Fields
    - `early_leave_threshold_minutes` (integer) - Minimum minutes early to trigger early leave (default 5)

  2. Changes
    - Add field to partner_settings
    - Update triggers to use configurable threshold instead of hardcoded 5 minutes
    - Set default value to 5 minutes for existing partners

  3. Logic
    - Configurable sensitivity for early leave detection
    - Partners can adjust threshold based on their needs
*/

-- Add early leave threshold setting
ALTER TABLE partner_settings 
ADD COLUMN IF NOT EXISTS early_leave_threshold_minutes integer DEFAULT 5;

-- Set default for existing records
UPDATE partner_settings 
SET early_leave_threshold_minutes = 5 
WHERE early_leave_threshold_minutes IS NULL;

-- Update the detect_early_leave function to use configurable threshold
CREATE OR REPLACE FUNCTION detect_early_leave()
RETURNS TRIGGER AS $$
DECLARE
  scheduled_end_time time;
  actual_end_time time;
  scheduled_datetime timestamptz;
  actual_datetime timestamptz;
  diff_minutes integer;
  threshold_minutes integer;
BEGIN
  -- Only process when shift is being closed or actual_end_at is set
  IF NEW.actual_end_at IS NOT NULL AND 
     (OLD.actual_end_at IS NULL OR OLD.actual_end_at != NEW.actual_end_at) THEN
    
    -- Get threshold from partner settings
    SELECT early_leave_threshold_minutes INTO threshold_minutes
    FROM partner_settings
    WHERE partner_id = NEW.partner_id;
    
    -- Default to 5 if not set
    IF threshold_minutes IS NULL THEN
      threshold_minutes := 5;
    END IF;
    
    -- Get scheduled end time
    scheduled_end_time := NEW.end_time;
    actual_end_time := NEW.actual_end_at::time;
    
    -- Build full timestamps for comparison
    scheduled_datetime := (NEW.date || ' ' || scheduled_end_time::text)::timestamptz;
    actual_datetime := NEW.actual_end_at;
    
    -- Calculate difference in minutes (positive = left early, negative = stayed late)
    diff_minutes := EXTRACT(EPOCH FROM (scheduled_datetime - actual_datetime)) / 60;
    
    -- Consider it early leave if left early by threshold or more
    IF diff_minutes >= threshold_minutes THEN
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

-- Update the handle_schedule_adjustment function to use configurable threshold
CREATE OR REPLACE FUNCTION handle_schedule_adjustment()
RETURNS TRIGGER AS $$
DECLARE
  scheduled_end_time time;
  actual_end_time time;
  time_diff_minutes integer;
  threshold_minutes integer;
BEGIN
  -- Check if end_time was changed and there's an actual_end_at
  IF OLD.end_time IS DISTINCT FROM NEW.end_time AND 
     NEW.actual_end_at IS NOT NULL THEN
    
    -- Get threshold from partner settings
    SELECT early_leave_threshold_minutes INTO threshold_minutes
    FROM partner_settings
    WHERE partner_id = NEW.partner_id;
    
    -- Default to 5 if not set
    IF threshold_minutes IS NULL THEN
      threshold_minutes := 5;
    END IF;
    
    actual_end_time := NEW.actual_end_at::time;
    
    -- Calculate difference between new schedule and actual (in minutes)
    time_diff_minutes := ABS(
      EXTRACT(EPOCH FROM (NEW.end_time - actual_end_time)) / 60
    );
    
    -- If the new schedule matches actual time (within threshold), mark as adjusted
    IF time_diff_minutes < threshold_minutes THEN
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
        
        IF diff_minutes >= threshold_minutes THEN
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
