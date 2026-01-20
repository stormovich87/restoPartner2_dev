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
    const body = await req.json();
    console.log('Received webhook:', JSON.stringify(body, null, 2));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle location messages
    if (body.message?.location) {
      return await handleLocationMessage(body.message, supabase);
    }

    if (!body.callback_query) {
      return new Response(
        JSON.stringify({ ok: true, message: "Not a callback or location" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const callbackQuery = body.callback_query;
    const callbackData = callbackQuery.data;
    const userId = callbackQuery.from.id;

    if (!callbackData) {
      return new Response(
        JSON.stringify({ ok: true, message: "Unknown callback" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle "en_route" action
    if (callbackData.startsWith('en_route_')) {
      const orderId = callbackData.replace('en_route_', '');

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          partner_id,
          status,
          courier_id,
          courier:couriers(id, telegram_user_id, name, lastname)
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (orderError || !order) {
        await answerCallbackQuery(callbackQuery.id, "❌ Заказ не найден");
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify the courier making the request is assigned to this order
      if (!order.courier || String(order.courier.telegram_user_id) !== String(userId)) {
        await answerCallbackQuery(callbackQuery.id, "❌ Этот заказ назначен другому курьеру");
        return new Response(
          JSON.stringify({ error: "Not authorized" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Update order status to en_route
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'en_route',
          en_route_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('Error updating order:', updateError);
        await answerCallbackQuery(callbackQuery.id, "❌ Ошибка при обновлении статуса");
        return new Response(
          JSON.stringify({ error: "Failed to update order" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Stop executor timers when status changes to en_route
      await supabase
        .from('order_executors')
        .update({ readiness_started_at: null })
        .eq('order_id', orderId)
        .not('readiness_started_at', 'is', null);

      await supabase
        .from('logs')
        .insert({
          partner_id: order.partner_id,
          section: 'orders',
          log_level: 'info',
          message: `Курьер ${order.courier.name} ${order.courier.lastname} выехал к клиенту`,
          details: {
            orderId,
            courierId: order.courier.id,
            courierName: `${order.courier.name} ${order.courier.lastname}`.trim()
          }
        });

      await answerCallbackQuery(callbackQuery.id, "✅ Статус обновлен: В дороге");

      return new Response(
        JSON.stringify({ ok: true, message: "Order status updated to en_route" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle "complete" action - request location
    if (callbackData.startsWith('complete_')) {
      const orderId = callbackData.replace('complete_', '');

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          partner_id,
          status,
          courier_id,
          telegram_message_id,
          delivery_lat,
          delivery_lng,
          branches(telegram_bot_token, telegram_chat_id),
          courier:couriers(id, telegram_user_id, name, lastname)
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (orderError || !order) {
        await answerCallbackQuery(callbackQuery.id, "❌ Заказ не найден");
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify the courier making the request is assigned to this order
      if (!order.courier || String(order.courier.telegram_user_id) !== String(userId)) {
        await answerCallbackQuery(callbackQuery.id, "❌ Этот заказ назначен другому курьеру");
        return new Response(
          JSON.stringify({ error: "Not authorized" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check if order status is en_route
      if (order.status !== 'en_route') {
        await answerCallbackQuery(callbackQuery.id, "⚠️ Вы должны сначала выехать");
        return new Response(
          JSON.stringify({ ok: true, message: "Must be en_route first" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get bot token to send message
      const { data: settings } = await supabase
        .from('partner_settings')
        .select('courier_bot_token')
        .eq('partner_id', order.partner_id)
        .maybeSingle();

      if (!settings?.courier_bot_token) {
        await answerCallbackQuery(callbackQuery.id, "❌ Ошибка конфигурации");
        return new Response(
          JSON.stringify({ error: "Bot token not found" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Store completion attempt in logs
      const key = `location_request_${userId}_${orderId}`;
      await supabase
        .from('logs')
        .delete()
        .eq('partner_id', order.partner_id)
        .eq('action', key);

      await supabase
        .from('logs')
        .insert({
          partner_id: order.partner_id,
          section: 'telegram',
          log_level: 'info',
          action: key,
          message: `Курьер ${order.courier.name} ${order.courier.lastname} запросил завершение заказа`,
          details: {
            orderId,
            courierId: order.courier.id,
            courierName: `${order.courier.name} ${order.courier.lastname}`.trim(),
            userId
          }
        });

      // Send message with location request keyboard
      const replyKeyboard = {
        keyboard: [
          [
            {
              text: '📍 Поделиться местоположением',
              request_location: true
            }
          ]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      };

      await fetch(`https://api.telegram.org/bot${settings.courier_bot_token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: userId,
          text: '📍 Для завершения заказа поделитесь своим местоположением, чтобы подтвердить, что вы находитесь у клиента.',
          reply_markup: replyKeyboard
        })
      });

      await answerCallbackQuery(callbackQuery.id, "📍 Отправьте ваше местоположение");

      return new Response(
        JSON.stringify({ ok: true, message: "Order completed successfully" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, message: "Unknown action" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Error in courier-actions-webhook:', error);
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

async function answerCallbackQuery(callbackQueryId: string, text: string) {
  try {
    const { data: settings } = await createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
      .from('partner_settings')
      .select('courier_bot_token')
      .limit(1)
      .maybeSingle();

    if (!settings?.courier_bot_token) {
      console.error('Courier bot token not found');
      return;
    }

    await fetch(`https://api.telegram.org/bot${settings.courier_bot_token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
        show_alert: true
      })
    });
  } catch (error) {
    console.error('Error answering callback query:', error);
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

async function handleLocationMessage(message: any, supabase: any) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  };

  const userId = message.from.id;
  const chatId = message.chat.id;
  const location = message.location;

  console.log('Received location:', { userId, chatId, location });

  // Find courier by telegram_user_id
  const { data: courier } = await supabase
    .from('couriers')
    .select('id, partner_id, name, lastname')
    .eq('telegram_user_id', userId)
    .maybeSingle();

  if (!courier) {
    console.log('Courier not found for userId:', userId);
    return new Response(
      JSON.stringify({ ok: true, message: "Courier not found" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Check if there's a location request in logs
  const { data: logEntries } = await supabase
    .from('logs')
    .select('action, details')
    .eq('partner_id', courier.partner_id)
    .like('action', `location_request_${userId}_%`)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!logEntries || logEntries.length === 0) {
    console.log('No location request found for courier:', courier.id);
    return new Response(
      JSON.stringify({ ok: true, message: "No active location request" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const orderId = logEntries[0].details.orderId;

  // Get order details
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id,
      partner_id,
      status,
      delivery_lat,
      delivery_lng,
      telegram_message_id,
      branches(telegram_bot_token, telegram_chat_id),
      courier:couriers(id, telegram_user_id, name, lastname)
    `)
    .eq('id', orderId)
    .maybeSingle();

  if (orderError || !order) {
    console.error('Order not found:', orderError);
    return new Response(
      JSON.stringify({ error: "Order not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Verify courier
  if (!order.courier || String(order.courier.telegram_user_id) !== String(userId)) {
    return new Response(
      JSON.stringify({ error: "Not authorized" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Check delivery coordinates
  if (!order.delivery_lat || !order.delivery_lng) {
    const { data: settings } = await supabase
      .from('partner_settings')
      .select('courier_bot_token')
      .eq('partner_id', order.partner_id)
      .maybeSingle();

    if (settings?.courier_bot_token) {
      await sendTelegramMessage(
        settings.courier_bot_token,
        chatId,
        '❌ У заказа отсутствуют координаты доставки. Обратитесь к администратору.'
      );
    }
    return new Response(
      JSON.stringify({ error: "No delivery coordinates" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Get completion radius
  const { data: settings } = await supabase
    .from('partner_settings')
    .select('completion_radius_meters, courier_bot_token')
    .eq('partner_id', order.partner_id)
    .maybeSingle();

  const allowedRadius = settings?.completion_radius_meters || 100;
  const botToken = settings?.courier_bot_token;

  if (!botToken) {
    return new Response(
      JSON.stringify({ error: "Bot token not found" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Calculate distance
  const distance = calculateDistance(
    location.latitude,
    location.longitude,
    order.delivery_lat,
    order.delivery_lng
  );

  console.log(`Distance: ${distance}m, Allowed: ${allowedRadius}m`);

  // Check if within radius
  if (distance > allowedRadius) {
    await sendTelegramMessage(
      botToken,
      chatId,
      `⚠️ Вы находитесь на расстоянии ${Math.round(distance)} метров от адреса доставки.\n\nДля завершения заказа необходимо быть на месте клиента (в радиусе ${allowedRadius} метров).`
    );
    return new Response(
      JSON.stringify({ ok: true, message: "Too far from delivery address" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Calculate courier payment
  let courierPayment: number | null = null;

  const { data: orderData } = await supabase
    .from('orders')
    .select('executor_type, executor_id, executor_zone_id, courier_zone_id, distance_km, delivery_type')
    .eq('id', orderId)
    .maybeSingle();

  if (orderData && orderData.delivery_type === 'delivery') {
    if (orderData.executor_type === 'performer' && orderData.executor_zone_id) {
      const { data: zone } = await supabase
        .from('performer_delivery_zones')
        .select('courier_payment, price_uah')
        .eq('id', orderData.executor_zone_id)
        .maybeSingle();

      if (zone) {
        courierPayment = zone.courier_payment ?? zone.price_uah ?? 0;

        if (orderData.executor_id && orderData.distance_km) {
          const { data: executor } = await supabase
            .from('executors')
            .select('km_calculation_enabled, price_per_km, km_graduation_meters')
            .eq('id', orderData.executor_id)
            .maybeSingle();

          if (executor?.km_calculation_enabled && executor.price_per_km > 0) {
            const minDistance = 1;
            const graduationKm = (executor.km_graduation_meters || 100) / 1000;
            let calcDistance = Math.max(orderData.distance_km, minDistance);

            if (graduationKm > 0) {
              calcDistance = Math.round(calcDistance / graduationKm) * graduationKm;
              calcDistance = Math.max(calcDistance, minDistance);
            }

            const distancePrice = Math.round(calcDistance * executor.price_per_km);
            courierPayment += distancePrice;
          }
        }
      }
    } else if (orderData.courier_zone_id) {
      const { data: zone } = await supabase
        .from('courier_delivery_zones')
        .select('courier_payment')
        .eq('id', orderData.courier_zone_id)
        .maybeSingle();

      if (zone) {
        courierPayment = zone.courier_payment ?? 0;
      }
    }
  }

  // Complete the order
  const updateData: any = {
    status: 'completed',
    completed_at: new Date().toISOString()
  };

  if (courierPayment !== null) {
    updateData.courier_payment_amount = courierPayment;
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId);

  if (updateError) {
    console.error('Error updating order:', updateError);
    await sendTelegramMessage(
      botToken,
      chatId,
      '❌ Ошибка при завершении заказа.'
    );
    return new Response(
      JSON.stringify({ error: "Failed to update order" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Stop executor timers
  const { data: activeExecutors } = await supabase
    .from('order_executors')
    .select('id, readiness_started_at')
    .eq('order_id', orderId)
    .not('readiness_started_at', 'is', null);

  if (activeExecutors && activeExecutors.length > 0) {
    for (const oe of activeExecutors) {
      const startedAt = new Date(oe.readiness_started_at).getTime();
      const now = Date.now();
      const elapsedMinutes = Math.floor((now - startedAt) / 60000);

      await supabase
        .from('order_executors')
        .update({
          readiness_started_at: null,
          readiness_completed_time_minutes: elapsedMinutes
        })
        .eq('id', oe.id);
    }
  }

  // Delete messages from other executors
  const { data: orderExecutors } = await supabase
    .from('order_executors')
    .select('id, telegram_message_id, executors(id, telegram_bot_token, telegram_chat_id)')
    .eq('order_id', orderId)
    .not('telegram_message_id', 'is', null);

  if (orderExecutors && orderExecutors.length > 0) {
    for (const oe of orderExecutors) {
      if (oe.telegram_message_id && oe.executors?.telegram_bot_token && oe.executors?.telegram_chat_id) {
        try {
          await fetch(`https://api.telegram.org/bot${oe.executors.telegram_bot_token}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: oe.executors.telegram_chat_id,
              message_id: oe.telegram_message_id
            })
          });
        } catch (err) {
          console.error('Error deleting executor message:', err);
        }
      }
    }

    await supabase
      .from('order_executors')
      .update({ status: 'cancelled' })
      .eq('order_id', orderId);
  }

  // Delete message from branch group
  if (order.telegram_message_id && order.branches?.telegram_bot_token && order.branches?.telegram_chat_id) {
    try {
      await fetch(`https://api.telegram.org/bot${order.branches.telegram_bot_token}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: order.branches.telegram_chat_id,
          message_id: order.telegram_message_id
        })
      });
    } catch (err) {
      console.error('Error deleting branch group message:', err);
    }
  }

  // Clean up location request log
  await supabase
    .from('logs')
    .delete()
    .eq('partner_id', order.partner_id)
    .eq('action', `location_request_${userId}_${orderId}`);

  // Log completion
  await supabase
    .from('logs')
    .insert({
      partner_id: order.partner_id,
      section: 'orders',
      log_level: 'info',
      message: `Курьер ${order.courier.name} ${order.courier.lastname} завершил заказ с подтверждением локации`,
      details: {
        orderId,
        courierId: order.courier.id,
        courierName: `${order.courier.name} ${order.courier.lastname}`.trim(),
        distance: Math.round(distance)
      }
    });

  // Send confirmation
  const removeKeyboard = {
    remove_keyboard: true
  };

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `✅ Заказ успешно завершен!\n\nВаше расстояние от адреса доставки: ${Math.round(distance)} м`,
      reply_markup: removeKeyboard
    })
  });

  return new Response(
    JSON.stringify({ ok: true, message: "Order completed successfully" }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });
}