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

async function deleteTelegramMessage(
  botToken: string,
  chatId: string,
  messageId: number
): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/deleteMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    });
    const result = await response.json();
    console.log(`Delete message ${messageId} result:`, result.ok);
    return result.ok;
  } catch (err) {
    console.error("Error deleting message:", err);
    return false;
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
    const { shift_id } = await req.json();

    if (!shift_id) {
      return new Response(
        JSON.stringify({ success: false, error: "shift_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Deleting reminders for shift ${shift_id}`);

    const { data: shift, error: shiftError } = await supabase
      .from("schedule_shifts")
      .select(`
        id, partner_id, reminder_message_ids, reminder_chat_id
      `)
      .eq("id", shift_id)
      .single();

    if (shiftError || !shift) {
      console.error("Error fetching shift:", shiftError);
      return new Response(
        JSON.stringify({ success: false, error: "Shift not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const messageIds = shift.reminder_message_ids || [];
    const chatId = shift.reminder_chat_id;

    if (messageIds.length === 0 || !chatId) {
      console.log("No reminder messages to delete");
      return new Response(
        JSON.stringify({ success: true, deleted: 0 }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: partnerSettings, error: settingsError } = await supabase
      .from("partner_settings")
      .select("employee_bot_token")
      .eq("partner_id", shift.partner_id)
      .single();

    if (settingsError || !partnerSettings?.employee_bot_token) {
      console.error("Error fetching partner settings or no bot token:", settingsError);
      return new Response(
        JSON.stringify({ success: false, error: "Bot token not found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const botToken = partnerSettings.employee_bot_token;
    let deleted = 0;

    for (const messageId of messageIds) {
      const success = await deleteTelegramMessage(botToken, chatId, messageId);
      if (success) deleted++;
    }

    await supabase
      .from("schedule_shifts")
      .update({
        reminder_message_ids: [],
        reminder_chat_id: null,
      })
      .eq("id", shift_id);

    console.log(`Deleted ${deleted}/${messageIds.length} reminder messages for shift ${shift_id}`);

    return new Response(
      JSON.stringify({ success: true, deleted }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in delete-shift-reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
