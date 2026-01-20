/*
  # Remove "Open Cabinet" button from shift reminders

  1. Changes
    - Update `send_telegram_shift_reminder()` function to always send messages WITHOUT inline keyboard button
    - Keep the `p_keyboard_url` parameter for backwards compatibility but ignore it
    
  2. Notes
    - Shift reminder messages will now be sent as plain text without any buttons
    - The function still returns message_id on success
*/

CREATE OR REPLACE FUNCTION public.send_telegram_shift_reminder(
  p_bot_token text, 
  p_chat_id text, 
  p_message_text text, 
  p_keyboard_url text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  response http_response;
  response_data JSONB;
  message_id BIGINT;
  request_body JSONB;
BEGIN
  -- Build request body WITHOUT keyboard (button removed)
  request_body := jsonb_build_object(
    'chat_id', p_chat_id,
    'text', p_message_text,
    'parse_mode', 'HTML'
  );

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
$function$;