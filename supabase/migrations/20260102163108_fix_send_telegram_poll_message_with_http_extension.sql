/*
  # Fix send_telegram_poll_message to use http extension

  1. Changes
    - Enable http extension for synchronous HTTP requests
    - Rewrite send_telegram_poll_message to use http_post instead of net.http_post
    - This fixes the issue with pg_net async API that doesn't work in cron context

  2. Notes
    - http extension provides synchronous HTTP calls
    - Returns response data immediately instead of request_id
*/

-- Enable http extension
CREATE EXTENSION IF NOT EXISTS http;

-- Recreate function with http extension
CREATE OR REPLACE FUNCTION send_telegram_poll_message(
  bot_token TEXT,
  chat_id BIGINT,
  message_text TEXT,
  agree_button TEXT,
  decline_button TEXT,
  courier_id UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response http_response;
  response_data JSONB;
  message_id BIGINT;
  request_body JSONB;
BEGIN
  -- Build request body
  request_body := jsonb_build_object(
    'chat_id', chat_id,
    'text', message_text,
    'parse_mode', 'HTML',
    'reply_markup', jsonb_build_object(
      'inline_keyboard', jsonb_build_array(
        jsonb_build_array(
          jsonb_build_object(
            'text', agree_button,
            'callback_data', 'poll_agree_' || courier_id::text
          ),
          jsonb_build_object(
            'text', decline_button,
            'callback_data', 'poll_decline_' || courier_id::text
          )
        )
      )
    )
  );

  -- Send message via Telegram API using http extension
  SELECT INTO response * FROM http((
    'POST',
    'https://api.telegram.org/bot' || bot_token || '/sendMessage',
    ARRAY[http_header('Content-Type', 'application/json')],
    'application/json',
    request_body::text
  )::http_request);

  -- Parse response
  IF response.status = 200 THEN
    response_data := response.content::jsonb;
    
    -- Extract message_id from response
    IF response_data->'result'->'message_id' IS NOT NULL THEN
      message_id := (response_data->'result'->>'message_id')::BIGINT;
      RETURN message_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;