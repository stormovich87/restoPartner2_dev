/*
  # Add login and password fields for courier authentication

  1. Changes
    - Add `cabinet_login` column to couriers table for browser authentication
    - Add `cabinet_password` column to couriers table for browser authentication
    
  2. Notes
    - Login/password are used when courier opens cabinet in browser
    - In Telegram Web App, authentication happens automatically via telegram_user_id
*/

ALTER TABLE couriers 
ADD COLUMN IF NOT EXISTS cabinet_login text,
ADD COLUMN IF NOT EXISTS cabinet_password text;

CREATE INDEX IF NOT EXISTS idx_couriers_cabinet_login ON couriers(cabinet_login) WHERE cabinet_login IS NOT NULL;