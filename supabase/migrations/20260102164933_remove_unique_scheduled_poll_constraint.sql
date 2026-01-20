/*
  # Remove unique constraint for scheduled polls per day

  1. Changes
    - Drop unique index idx_unique_scheduled_poll_per_day
    - This allows multiple scheduled polls per day when time is changed
    - Protection against spam is now in send_scheduled_courier_polls function
      (checks ±2 minute time window around scheduled time)

  2. Notes
    - Allows legitimate schedule time changes during the day
    - Function-level check prevents duplicate sends for same time slot
*/

DROP INDEX IF EXISTS idx_unique_scheduled_poll_per_day;