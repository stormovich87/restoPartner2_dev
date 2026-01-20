import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CleanupRequest {
  partner_id?: string;
  retention_days?: number;
  mode?: 'manual' | 'auto';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CleanupRequest = await req.json();
    const { partner_id, retention_days, mode = 'manual' } = body;

    if (mode === 'manual' && !partner_id) {
      return new Response(
        JSON.stringify({ error: 'partner_id is required for manual cleanup' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let partnersToCleanup: Array<{ partner_id: string; retention_days: number }> = [];

    if (mode === 'manual') {
      // Manual cleanup for a specific partner
      if (!retention_days || retention_days < 1) {
        return new Response(
          JSON.stringify({ error: 'retention_days must be a positive number' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      partnersToCleanup.push({ partner_id: partner_id!, retention_days });
    } else {
      // Auto cleanup for all partners with auto_cleanup enabled
      const { data: partners, error: partnersError } = await supabase
        .from('partner_settings')
        .select('partner_id, history_retention_days')
        .eq('history_auto_cleanup_enabled', true)
        .not('history_retention_days', 'is', null)
        .gt('history_retention_days', 0);

      if (partnersError) throw partnersError;

      partnersToCleanup = partners.map((p) => ({
        partner_id: p.partner_id,
        retention_days: p.history_retention_days,
      }));
    }

    const results = [];

    for (const { partner_id, retention_days } of partnersToCleanup) {
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retention_days);

      // Delete archived orders older than cutoff date
      const { data: deletedOrders, error: deleteError } = await supabase
        .from('archived_orders')
        .delete()
        .eq('partner_id', partner_id)
        .lt('archived_at', cutoffDate.toISOString())
        .select('id');

      if (deleteError) {
        console.error(`Error deleting archived orders for partner ${partner_id}:`, deleteError);
        results.push({
          partner_id,
          success: false,
          error: deleteError.message,
        });
        continue;
      }

      const deletedCount = deletedOrders?.length || 0;

      // Log the cleanup action
      await supabase.from('logs').insert({
        partner_id,
        level: 'info',
        category: 'history_cleanup',
        message: `Очищено ${deletedCount} архивных заказов старше ${retention_days} дней`,
        metadata: {
          retention_days,
          cutoff_date: cutoffDate.toISOString(),
          deleted_count: deletedCount,
          mode,
        },
      });

      results.push({
        partner_id,
        success: true,
        deleted_count: deletedCount,
        cutoff_date: cutoffDate.toISOString(),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        results,
        total_partners: partnersToCleanup.length,
        total_deleted: results.reduce((sum, r) => sum + (r.deleted_count || 0), 0),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in cleanup-archived-orders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});