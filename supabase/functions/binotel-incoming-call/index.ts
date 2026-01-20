import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('380') && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith('80') && digits.length === 11) {
    return '3' + digits;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return '38' + digits;
  }
  if (digits.length === 9) {
    return '380' + digits;
  }
  return digits;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const contentType = req.headers.get('content-type') || '';
    let rawPayload: any = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      for (const [key, value] of params.entries()) {
        rawPayload[key] = value;
      }
    } else if (contentType.includes('application/json')) {
      rawPayload = await req.json();
    } else {
      const text = await req.text();
      try {
        const params = new URLSearchParams(text);
        for (const [key, value] of params.entries()) {
          rawPayload[key] = value;
        }
      } catch {
        rawPayload = { rawBody: text };
      }
    }

    console.log('Received Binotel call-settings webhook:', rawPayload);

    const requestType = rawPayload.requestType || '';
    const externalNumber = rawPayload.externalNumber || '';
    const internalNumber = rawPayload.internalNumber || '';
    const pbxNumber = rawPayload.pbxNumber || '';
    const callType = parseInt(rawPayload.callType || '0', 10);
    const companyID = rawPayload.companyID || '';

    let partnerId: string | null = null;
    if (companyID) {
      const { data: settings } = await supabase
        .from('partner_settings')
        .select('partner_id')
        .eq('binotel_company_id', companyID)
        .maybeSingle();

      if (settings) {
        partnerId = settings.partner_id;
      }
    }

    if (!partnerId) {
      console.log('Partner not found for companyID:', companyID);
      return new Response(
        JSON.stringify({ status: 'success' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let branchId: string | null = null;
    const lookupNumber = callType === 1 ? internalNumber : (internalNumber || pbxNumber);

    if (lookupNumber) {
      const normalizedLookup = normalizePhone(lookupNumber);
      const { data: branches } = await supabase
        .from('branches')
        .select('id, phone')
        .eq('partner_id', partnerId);

      if (branches) {
        for (const branch of branches) {
          if (branch.phone) {
            const branchPhoneNormalized = normalizePhone(branch.phone);
            if (branchPhoneNormalized === normalizedLookup ||
                branch.phone.includes(lookupNumber) ||
                lookupNumber.includes(branch.phone.replace(/\D/g, ''))) {
              branchId = branch.id;
              break;
            }
          }
        }
      }
    }

    let clientId: string | null = null;
    let clientName: string | null = null;

    if (externalNumber) {
      const normalizedExternal = normalizePhone(externalNumber);
      const { data: clients } = await supabase
        .from('clients')
        .select('id, first_name, last_name, phone, additional_phones')
        .eq('partner_id', partnerId);

      if (clients) {
        for (const client of clients) {
          const clientPhoneNormalized = client.phone ? normalizePhone(client.phone) : '';
          if (clientPhoneNormalized === normalizedExternal) {
            clientId = client.id;
            const firstName = client.first_name || '';
            const lastName = client.last_name || '';
            clientName = `${firstName} ${lastName}`.trim() || null;
            break;
          }
          if (client.additional_phones && Array.isArray(client.additional_phones)) {
            for (const addPhone of client.additional_phones) {
              if (normalizePhone(addPhone) === normalizedExternal) {
                clientId = client.id;
                const firstName = client.first_name || '';
                const lastName = client.last_name || '';
                clientName = `${firstName} ${lastName}`.trim() || null;
                break;
              }
            }
          }
          if (clientId) break;
        }
      }
    }

    const callData: any = {
      partner_id: partnerId,
      branch_id: branchId,
      company_id: companyID,
      request_type: requestType,
      call_type: callType,
      external_number: externalNumber,
      internal_number: internalNumber,
      pbx_number: pbxNumber,
      client_id: clientId,
      call_status: 'active',
      call_started_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      notification_phone: externalNumber,
      notification_shown: false,
      raw_settings: rawPayload,
      is_outgoing: callType === 1,
    };

    console.log('[Binotel] Call data to insert:', callData);

    let binotelCallId: string | null = null;

    const { data, error } = await supabase
      .from('binotel_calls')
      .insert(callData)
      .select('id')
      .single();

    if (error) {
      console.error('[Binotel] Error inserting call record:', error);
      console.error('[Binotel] Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('[Binotel] New call record created:', data.id);
      binotelCallId = data.id;
    }

    console.log('[Binotel] Call-settings processed:', {
      callType: callType === 0 ? 'incoming' : 'outgoing',
      partnerId,
      branchId,
      clientId,
      clientName,
      callId: binotelCallId,
    });

    return new Response(
      JSON.stringify({ status: 'success' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing Binotel call-settings webhook:', error);
    return new Response(
      JSON.stringify({ status: 'success' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});