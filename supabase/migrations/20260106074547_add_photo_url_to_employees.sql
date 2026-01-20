/*
  # Add photo support for employees

  1. Changes
    - Add `photo_url` column to employees table for storing employee photos
    - Add `photo_file_id` column to store Telegram file_id for photos uploaded via bot

  2. Notes
    - photo_url stores the public URL of the photo in Supabase Storage
    - photo_file_id stores Telegram file ID for bot-uploaded photos
*/

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS photo_url text,
ADD COLUMN IF NOT EXISTS photo_file_id text;
