/*
  # Make courier phone field nullable

  1. Changes
    - Make `phone` column nullable in `couriers` table
    - This allows couriers to register via Telegram bot without providing phone number upfront

  2. Notes
    - Phone can be added later through the admin interface if needed
    - Telegram username and user_id are sufficient for identification
*/

ALTER TABLE couriers 
  ALTER COLUMN phone DROP NOT NULL;