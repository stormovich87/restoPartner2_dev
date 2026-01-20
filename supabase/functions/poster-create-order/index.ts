import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const { poster_account, poster_api_token, order_data } = await req.json();

    console.log('Received order_data:', JSON.stringify(order_data, null, 2));
    console.log('Phone from order_data:', order_data?.phone, 'type:', typeof order_data?.phone);

    if (!poster_account || !poster_api_token) {
      return new Response(
        JSON.stringify({ error: 'Настройки Poster не указаны' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!order_data) {
      return new Response(
        JSON.stringify({ error: 'Данные заказа не указаны' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const cleanPhone = String(order_data.phone || '').trim();
    const phoneDigits = cleanPhone.replace(/\D/g, '');
    const hasValidPhone = phoneDigits.length >= 9;
    let normalizedPhone = hasValidPhone
      ? (cleanPhone.startsWith('+') ? cleanPhone : '+380' + phoneDigits.slice(-9))
      : null;

    console.log('Phone processing:', { cleanPhone, phoneDigits, hasValidPhone, normalizedPhone });

    if (!normalizedPhone && order_data.branch_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data: branch } = await supabase
        .from('branches')
        .select('phone')
        .eq('id', order_data.branch_id)
        .maybeSingle();

      if (branch?.phone) {
        const branchPhoneClean = String(branch.phone).trim();
        const branchPhoneDigits = branchPhoneClean.replace(/\D/g, '');
        const hasBranchValidPhone = branchPhoneDigits.length >= 9;
        normalizedPhone = hasBranchValidPhone
          ? (branchPhoneClean.startsWith('+') ? branchPhoneClean : '+380' + branchPhoneDigits.slice(-9))
          : null;
        console.log('Using branch phone:', normalizedPhone);
      }
    }

    const products = Array.isArray(order_data.products) ? order_data.products : [];

    if (products.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Заказ должен содержать хотя бы один товар' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const incoming_order: any = {
      spot_id: Number(order_data.spot_id),
      service_mode: Number(order_data.service_mode || 1),
      products: products.map((p: any) => {
        const productData: any = {
          product_id: Number(p.poster_product_id || p.product_id),
          count: Number(p.count || p.quantity || 1),
        };
        if (p.modification && Array.isArray(p.modification) && p.modification.length > 0) {
          productData.modification = p.modification.map((mod: any) => ({
            m: Number(mod.m),
            a: Number(mod.a || mod.quantity || 1)
          }));
        }
        return productData;
      }),
    };

    if (normalizedPhone) {
      incoming_order.phone = normalizedPhone;
    }

    if (order_data.comment) {
      incoming_order.comment = String(order_data.comment);
    }

    if (order_data.client_address && order_data.service_mode === 3) {
      incoming_order.client_address = order_data.client_address;
    }

    if (order_data.service_mode === 3 && order_data.delivery_price !== undefined) {
      incoming_order.delivery_price = Math.max(0, Math.round(Number(order_data.delivery_price) || 0));
      console.log('Delivery price processing:', {
        raw_value: order_data.delivery_price,
        converted_value: incoming_order.delivery_price,
        service_mode: order_data.service_mode
      });
    }

    console.log('Отправка в Poster API:', JSON.stringify(incoming_order, null, 2));
    console.log('incoming_order.phone:', incoming_order.phone);

    const posterUrl = `https://${poster_account}.joinposter.com/api/incomingOrders.createIncomingOrder?token=${poster_api_token}`;

    const formData = new URLSearchParams();

    formData.append('spot_id', String(incoming_order.spot_id));
    if (incoming_order.phone) {
      formData.append('phone', incoming_order.phone);
    }
    formData.append('service_mode', String(incoming_order.service_mode));

    incoming_order.products.forEach((product: any, index: number) => {
      formData.append(`products[${index}][product_id]`, String(product.product_id));
      formData.append(`products[${index}][count]`, String(product.count));

      if (product.modification && Array.isArray(product.modification)) {
        product.modification.forEach((mod: any, modIndex: number) => {
          formData.append(`products[${index}][modification][${modIndex}][m]`, String(mod.m));
          formData.append(`products[${index}][modification][${modIndex}][a]`, String(mod.a));
        });
      }
    });

    if (incoming_order.comment) {
      formData.append('comment', incoming_order.comment);
    }

    if (incoming_order.delivery_price !== undefined) {
      formData.append('delivery_price', String(incoming_order.delivery_price));
    }

    if (incoming_order.client_address) {
      if (typeof incoming_order.client_address === 'object') {
        Object.keys(incoming_order.client_address).forEach(key => {
          formData.append(`client_address[${key}]`, String(incoming_order.client_address[key]));
        });
      } else {
        formData.append('client_address', String(incoming_order.client_address));
      }
    }

    console.log('FormData being sent:', formData.toString());

    const response = await fetch(posterUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const responseText = await response.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({
          error: `Некорректный ответ от Poster API`,
          raw_response: responseText
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!response.ok || data.error) {
      console.error('Poster API error:', {
        httpStatus: response.status,
        posterError: data.error,
        posterMessage: data.message,
        fullResponse: data
      });
      return new Response(
        JSON.stringify({
          error: `Ошибка Poster API (${response.status})`,
          poster_response: data
        }),
        {
          status: data.error ? 500 : response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in poster-create-order:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});