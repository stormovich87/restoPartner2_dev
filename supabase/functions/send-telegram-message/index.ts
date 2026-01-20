import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  bot_token: string;
  chat_id: string;
  message: string;
  message_thread_id?: string;
  inline_keyboard?: Array<Array<{
    text: string;
    callback_data: string;
  }>>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { bot_token, chat_id, message, message_thread_id, inline_keyboard }: RequestBody = await req.json();

    if (!bot_token || !chat_id || !message) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          details: {
            bot_token: !bot_token ? "missing" : "present",
            chat_id: !chat_id ? "missing" : "present",
            message: !message ? "missing" : "present"
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const telegramUrl = `https://api.telegram.org/bot${bot_token}/sendMessage`;

    const requestBody: any = {
      chat_id: chat_id,
      text: message,
      parse_mode: "HTML",
    };

    if (message_thread_id) {
      requestBody.message_thread_id = parseInt(message_thread_id, 10);
    }

    if (inline_keyboard && inline_keyboard.length > 0) {
      requestBody.reply_markup = {
        inline_keyboard: inline_keyboard
      };
    }

    const telegramResponse = await fetch(telegramUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const telegramData = await telegramResponse.json();

    if (!telegramResponse.ok) {
      console.error("Telegram API error:", telegramData);
      return new Response(
        JSON.stringify({
          error: "Telegram API error",
          telegram_error: telegramData,
          status: telegramResponse.status
        }),
        {
          status: telegramResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        telegram_response: telegramData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-telegram-message:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});