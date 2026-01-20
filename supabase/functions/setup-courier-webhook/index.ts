import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { partner_id } = await req.json();

    if (!partner_id) {
      return new Response(
        JSON.stringify({ error: "partner_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settings, error: settingsError } = await supabase
      .from('partner_settings')
      .select('courier_bot_token')
      .eq('partner_id', partner_id)
      .maybeSingle();

    if (settingsError || !settings?.courier_bot_token) {
      return new Response(
        JSON.stringify({
          error: "Bot token not found",
          details: "Please configure courier_bot_token in partner settings first"
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const botToken = settings.courier_bot_token;
    const webhookUrl = `${supabaseUrl}/functions/v1/courier-registration-bot?token=${encodeURIComponent(botToken)}`;

    const setWebhookResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: true
        })
      }
    );

    const setWebhookResult = await setWebhookResponse.json();

    if (!setWebhookResult.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to set webhook",
          telegram_error: setWebhookResult
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const getWebhookResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`
    );
    const webhookInfo = await getWebhookResponse.json();

    await supabase
      .from('logs')
      .insert({
        partner_id: partner_id,
        category: 'telegram',
        level: 'info',
        message: 'Webhook для бота курьеров настроен успешно',
        details: {
          webhookUrl,
          webhookInfo: webhookInfo.result
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        webhook_url: webhookUrl,
        webhook_info: webhookInfo.result
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Error in setup-courier-webhook:', error);
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
