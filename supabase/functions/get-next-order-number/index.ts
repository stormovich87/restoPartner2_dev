import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { partnerId } = await req.json();

    if (!partnerId) {
      return new Response(
        JSON.stringify({ error: "Partner ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: settings, error: fetchError } = await supabase
      .from("partner_settings")
      .select("next_order_number")
      .eq("partner_id", partnerId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    const currentNumber = settings.next_order_number || 1;
    const nextNumber = currentNumber + 1;

    const { error: updateError } = await supabase
      .from("partner_settings")
      .update({ next_order_number: nextNumber })
      .eq("partner_id", partnerId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ orderNumber: currentNumber }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});