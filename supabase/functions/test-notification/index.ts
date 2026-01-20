import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    console.log(`Attempting to send test message to chat ${chatId}`);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
      }),
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`Success: Test message sent to ${chatId}, message_id: ${result.result?.message_id}`);
      return { success: true, messageId: result.result?.message_id };
    } else {
      console.error(`Telegram API error for chat ${chatId}: ${result.error_code} - ${result.description}`);
      return { success: false, error: result.description };
    }
  } catch (err) {
    console.error(`Error sending message to ${chatId}: ${err}`);
    return { success: false, error: String(err) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { partner_id, employee_id, telegram_user_id } = await req.json();

    if (!partner_id || !telegram_user_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required parameters"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log(`[TEST NOTIFICATION] Partner: ${partner_id}, Employee: ${employee_id}, Telegram ID: ${telegram_user_id}`);

    const { data: settings, error: settingsError } = await supabase
      .from("partner_settings")
      .select("employee_bot_token, employee_bot_enabled")
      .eq("partner_id", partner_id)
      .maybeSingle();

    if (settingsError || !settings) {
      console.error(`[TEST NOTIFICATION] Failed to load partner settings:`, settingsError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to load partner settings"
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!settings.employee_bot_token) {
      console.error(`[TEST NOTIFICATION] No bot token configured for partner ${partner_id}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Bot token not configured. Please set up employee bot in settings."
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!settings.employee_bot_enabled) {
      console.warn(`[TEST NOTIFICATION] Bot is disabled for partner ${partner_id}`);
    }

    const { data: employee } = await supabase
      .from("employees")
      .select("first_name, last_name")
      .eq("id", employee_id)
      .maybeSingle();

    const employeeName = employee
      ? `${employee.first_name}${employee.last_name ? ' ' + employee.last_name : ''}`
      : 'Сотрудник';

    const message = `<b>Тестовое уведомление</b>\n\n` +
      `Привет, ${employeeName}!\n\n` +
      `Это тестовое сообщение от системы уведомлений.\n\n` +
      `Если вы видите это сообщение, значит:\n` +
      `- Бот настроен правильно\n` +
      `- Вы начали диалог с ботом\n` +
      `- Уведомления будут работать\n\n` +
      `<i>Время отправки: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Kiev' })}</i>`;

    console.log(`[TEST NOTIFICATION] Sending test message...`);

    const result = await sendTelegramMessage(
      settings.employee_bot_token,
      telegram_user_id,
      message
    );

    if (result.success) {
      console.log(`[TEST NOTIFICATION] Success`);
      return new Response(
        JSON.stringify({
          success: true,
          messageId: result.messageId,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      console.error(`[TEST NOTIFICATION] Failed: ${result.error}`);

      let userFriendlyError = result.error || "Unknown error";

      if (result.error && result.error.includes("chat not found")) {
        userFriendlyError = "Сотрудник не начал диалог с ботом. Попросите сотрудника найти бота в Telegram и нажать /start";
      } else if (result.error && result.error.includes("bot was blocked")) {
        userFriendlyError = "Сотрудник заблокировал бота. Попросите сотрудника разблокировать бота в настройках Telegram";
      } else if (result.error && result.error.includes("Unauthorized")) {
        userFriendlyError = "Неверный токен бота. Проверьте настройки бота сотрудников";
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: userFriendlyError,
          raw_error: result.error,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error) {
    console.error("[TEST NOTIFICATION] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error)
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});