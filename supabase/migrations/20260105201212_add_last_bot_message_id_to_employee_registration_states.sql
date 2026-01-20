/*
  # Add last_bot_message_id to employee_registration_states

  1. Changes
    - Add `last_bot_message_id` column to track the last message sent by the bot
    - Used to delete previous messages when sending new ones
*/

ALTER TABLE employee_registration_states 
ADD COLUMN IF NOT EXISTS last_bot_message_id text;
