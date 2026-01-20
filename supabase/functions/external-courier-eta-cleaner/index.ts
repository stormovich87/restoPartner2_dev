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

async function deleteMessage(botToken: string, chatId: number, messageId: number): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/deleteMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    });
    return response.ok;
  } catch (err) {
    console.error('Exception deleting message:', err);
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
    console.log('=== EXTERNAL COURIER ETA CLEANER ===');

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: expiredStates, error } = await supabase
      .from('external_courier_states')
      .select(`
        id,
        telegram_user_id,
        partner_id,
        order_id,
        eta_question_message_id,
        step
      `)
      .in('step', ['awaiting_eta', 'awaiting_eta_manual_text', 'awaiting_location_for_eta'])
      .lt('eta_question_sent_at', fiveMinutesAgo);

    if (error) {
      console.error('Error fetching expired states:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${expiredStates?.length || 0} expired ETA states to clean up`);

    let cleanedCount = 0;

    for (const state of expiredStates || []) {
      console.log('Processing expired state:', state.id, 'telegram_user_id:', state.telegram_user_id);

      if (state.eta_question_message_id) {
        const { data: partnerSettings } = await supabase
          .from('partner_settings')
          .select('external_courier_bot_token')
          .eq('partner_id', state.partner_id)
          .maybeSingle();

        if (partnerSettings?.external_courier_bot_token) {
          const deleted = await deleteMessage(
            partnerSettings.external_courier_bot_token,
            parseInt(state.telegram_user_id),
            state.eta_question_message_id
          );

          if (deleted) {
            console.log('Successfully deleted ETA question message:', state.eta_question_message_id);
          } else {
            console.log('Failed to delete message (may already be deleted):', state.eta_question_message_id);
          }
        }
      }

      const { error: deleteError } = await supabase
        .from('external_courier_states')
        .delete()
        .eq('id', state.id);

      if (deleteError) {
        console.error('Error deleting state:', deleteError);
      } else {
        cleanedCount++;
        console.log('Deleted expired state:', state.id);
      }
    }

    console.log(`Cleaned up ${cleanedCount} expired ETA states`);

    return new Response(JSON.stringify({
      success: true,
      cleaned: cleanedCount,
      total_found: expiredStates?.length || 0
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ETA cleaner:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});