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
    const { executor_id, bot_token } = await req.json();

    if (!executor_id || !bot_token) {
      return new Response(
        JSON.stringify({ error: "executor_id and bot_token are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const webhookUrl = `${supabaseUrl}/functions/v1/courier-registration-bot?token=${encodeURIComponent(bot_token)}`;

    const setWebhookResponse = await fetch(
      `https://api.telegram.org/bot${bot_token}/setWebhook`,
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
      `https://api.telegram.org/bot${bot_token}/getWebhookInfo`
    );
    const webhookInfo = await getWebhookResponse.json();

    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: executor } = await supabase
      .from('executors')
      .select('partner_id, name')
      .eq('id', executor_id)
      .maybeSingle();

    if (executor) {
      await supabase
        .from('logs')
        .insert({
          partner_id: executor.partner_id,
          category: 'telegram',
          level: 'info',
          message: `Webhook для бота исполнителя "${executor.name}" настроен успешно`,
          details: {
            executor_id,
            webhookUrl,
            webhookInfo: webhookInfo.result
          }
        });
    }

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
    console.error('Error in setup-executor-webhook:', error);
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
