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

    console.log('Received Binotel call-completed webhook:', rawPayload);

    let callDetails: any = rawPayload.callDetails || rawPayload;
    if (typeof callDetails === 'string') {
      try {
        callDetails = JSON.parse(callDetails);
      } catch {
        console.error('Failed to parse callDetails as JSON');
      }
    }

    const generalCallID = callDetails.generalCallID || callDetails.generalcallid || null;
    const companyID = callDetails.companyID || callDetails.companyid || rawPayload.companyID || '';
    const callType = parseInt(callDetails.callType || callDetails.calltype || '0', 10);
    const externalNumber = callDetails.externalNumber || callDetails.externalnumber || '';
    const internalNumber = callDetails.internalNumber || callDetails.internalnumber || '';
    const disposition = callDetails.disposition || 'UNKNOWN';
    const waitsec = parseInt(callDetails.waitsec || '0', 10);
    const billsec = parseInt(callDetails.billsec || '0', 10);
    const startTime = callDetails.startTime || callDetails.starttime || null;

    const employeeData = callDetails.employeeData || callDetails.employeedata || {};
    const customerData = callDetails.customerData || callDetails.customerdata || {};
    const pbxNumberData = callDetails.pbxNumberData || callDetails.pbxnumberdata || {};

    const employeeEmail = employeeData.email || null;
    const employeeName = employeeData.name || null;
    const customerBinotelId = customerData.id ? String(customerData.id) : null;
    const pbxNumber = pbxNumberData.number || callDetails.pbxNumber || '';

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

    let existingCall: any = null;

    if (generalCallID) {
      const { data } = await supabase
        .from('binotel_calls')
        .select('id, client_id')
        .eq('partner_id', partnerId)
        .eq('general_call_id', generalCallID)
        .maybeSingle();

      existingCall = data;
    }

    if (!existingCall && externalNumber) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('binotel_calls')
        .select('id, client_id, branch_id')
        .eq('partner_id', partnerId)
        .eq('external_number', externalNumber)
        .is('completed_at', null)
        .gte('created_at', tenMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      existingCall = data;
    }

    let startedAt: string | null = null;
    if (startTime) {
      const timestamp = parseInt(startTime, 10);
      if (!isNaN(timestamp)) {
        startedAt = new Date(timestamp * 1000).toISOString();
      }
    }

    // Determine if call is missed based on Binotel disposition
    // ANSWER = answered, NOANSWER/BUSY/FAILED = missed
    const isMissed = callType === 0 && (disposition === 'NOANSWER' || disposition === 'BUSY' || disposition === 'FAILED' || billsec === 0);

    let clientId = existingCall?.client_id || null;

    if (!clientId && externalNumber) {
      const normalizedExternal = normalizePhone(externalNumber);
      const { data: clients } = await supabase
        .from('clients')
        .select('id, phone, additional_phones')
        .eq('partner_id', partnerId);

      if (clients) {
        for (const client of clients) {
          const clientPhoneNormalized = client.phone ? normalizePhone(client.phone) : '';
          if (clientPhoneNormalized === normalizedExternal) {
            clientId = client.id;
            break;
          }
          if (client.additional_phones && Array.isArray(client.additional_phones)) {
            for (const addPhone of client.additional_phones) {
              if (normalizePhone(addPhone) === normalizedExternal) {
                clientId = client.id;
                break;
              }
            }
          }
          if (clientId) break;
        }
      }
    }

    const updateData: any = {
      general_call_id: generalCallID,
      call_status: disposition,
      waitsec,
      billsec,
      duration_seconds: billsec,
      completed_at: new Date().toISOString(),
      employee_email: employeeEmail,
      employee_name: employeeName,
      customer_binotel_id: customerBinotelId,
      is_missed: isMissed,
      answered_at: disposition === 'ANSWER' && billsec > 0 ? startedAt : null,
      raw_completed: rawPayload,
    };

    if (startedAt) {
      updateData.started_at = startedAt;
    }

    if (clientId) {
      updateData.client_id = clientId;
    }

    if (existingCall) {
      const { error: updateError } = await supabase
        .from('binotel_calls')
        .update(updateData)
        .eq('id', existingCall.id);

      if (updateError) {
        console.error('Error updating call record:', updateError);
      } else {
        console.log('Call record updated:', existingCall.id);
      }
    } else {
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
                  lookupNumber.includes(branch.phone.replace(/\/\D/g, ''))) {
                branchId = branch.id;
                break;
              }
            }
          }
        }
      }

      const { error: insertError } = await supabase
        .from('binotel_calls')
        .insert({
          partner_id: partnerId,
          branch_id: branchId,
          company_id: companyID,
          call_type: callType,
          external_number: externalNumber,
          internal_number: internalNumber,
          pbx_number: pbxNumber,
          is_outgoing: callType === 1,
          ...updateData,
        });

      if (insertError) {
        console.error('Error inserting call record:', insertError);
      } else {
        console.log('New call record created from completed webhook');
      }
    }

    // Update lost calls status
    await supabase.rpc('mark_lost_calls');

    console.log('Call completed processed:', {
      generalCallID,
      disposition,
      billsec,
      isMissed,
      clientId,
    });

    return new Response(
      JSON.stringify({ status: 'success' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing Binotel call-completed webhook:', error);
    return new Response(
      JSON.stringify({ status: 'success' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
