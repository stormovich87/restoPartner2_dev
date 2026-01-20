/*
  # Fix Shift Reminder Button to Open Telegram Mini App

  1. Changes
    - Update send_telegram_shift_reminder function to use web_app instead of url
    - This will open the employee cabinet as a Telegram Mini App instead of external browser

  2. Technical Details
    - Change from: {"text": "Открыть кабинет", "url": "..."}
    - Change to: {"text": "Открыть кабинет", "web_app": {"url": "..."}}
*/

CREATE OR REPLACE FUNCTION send_telegram_shift_reminder(
  p_bot_token TEXT,
  p_chat_id TEXT,
  p_message_text TEXT,
  p_keyboard_url TEXT DEFAULT NULL
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
  IF p_keyboard_url IS NOT NULL THEN
    request_body := jsonb_build_object(
      'chat_id', p_chat_id,
      'text', p_message_text,
      'parse_mode', 'HTML',
      'reply_markup', jsonb_build_object(
        'inline_keyboard', jsonb_build_array(
          jsonb_build_array(
            jsonb_build_object(
              'text', 'Открыть кабинет',
              'web_app', jsonb_build_object('url', p_keyboard_url)
            )
          )
        )
      )
    );
  ELSE
    request_body := jsonb_build_object(
      'chat_id', p_chat_id,
      'text', p_message_text,
      'parse_mode', 'HTML'
    );
  END IF;

  -- Send message via Telegram API using http extension
  BEGIN
    SELECT INTO response * FROM http((
      'POST',
      'https://api.telegram.org/bot' || p_bot_token || '/sendMessage',
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
        RAISE NOTICE 'Telegram message sent successfully, message_id: %', message_id;
        RETURN message_id;
      END IF;
    ELSE
      RAISE NOTICE 'Telegram API error, status: %, response: %', response.status, response.content;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error sending Telegram message: %', SQLERRM;
  END;

  RETURN NULL;
END;
$$;