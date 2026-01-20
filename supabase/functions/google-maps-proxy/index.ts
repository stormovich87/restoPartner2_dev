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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { partnerId, operation, params } = await req.json();

    if (!partnerId || !operation) {
      return new Response(
        JSON.stringify({ error: "Missing partnerId or operation" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: settings, error: settingsError } = await supabase
      .from("partner_settings")
      .select("google_maps_api_key")
      .eq("partner_id", partnerId)
      .maybeSingle();

    if (settingsError || !settings?.google_maps_api_key) {
      return new Response(
        JSON.stringify({ error: "Google Maps API key not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = settings.google_maps_api_key;
    let url = "";

    switch (operation) {
      case "geocode":
        if (!params.address) {
          return new Response(
            JSON.stringify({ error: "Missing address parameter" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(params.address)}&key=${apiKey}`;
        break;

      case "reverseGeocode":
        if (!params.lat || !params.lng) {
          return new Response(
            JSON.stringify({ error: "Missing lat or lng parameters" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${params.lat},${params.lng}&key=${apiKey}`;
        break;

      case "distanceMatrix":
        if (!params.origin || !params.destination) {
          return new Response(
            JSON.stringify({ error: "Missing origin or destination parameters" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${params.origin}&destinations=${params.destination}&key=${apiKey}`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid operation" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    const response = await fetch(url);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in google-maps-proxy:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
