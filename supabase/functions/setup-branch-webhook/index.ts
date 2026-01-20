import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  bot_token: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { bot_token }: RequestBody = await req.json();

    if (!bot_token) {
      return new Response(
        JSON.stringify({ error: "Missing bot_token" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const webhookUrl = `${supabaseUrl}/functions/v1/courier-accept-webhook`;

    console.log('Setting webhook for branch bot:', { webhookUrl });

    const response = await fetch(`https://api.telegram.org/bot${bot_token}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['callback_query']
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error('Failed to set webhook:', data);
      return new Response(
        JSON.stringify({
          error: "Failed to set webhook",
          details: data,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const infoResponse = await fetch(`https://api.telegram.org/bot${bot_token}/getWebhookInfo`);
    const infoData = await infoResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook configured successfully",
        webhook_url: webhookUrl,
        webhook_info: infoData.result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in setup-branch-webhook:", error);
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
