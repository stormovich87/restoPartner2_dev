import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PaymentBreakdownItem {
  method_id: string;
  method_name: string;
  method_type: string;
  amount: number;
  status?: string | null;
  cash_given?: number | null;
}

function buildPaymentInfo(order: any, paymentMethod: any): { paymentText: string; changeText: string } {
  let paymentText = '';
  let changeText = '';

  const paymentBreakdown = order.payment_breakdown as PaymentBreakdownItem[] | null;

  if (paymentBreakdown && Array.isArray(paymentBreakdown) && paymentBreakdown.length > 0) {
    const paymentParts: string[] = [];
    let totalCashGiven = 0;
    let totalCashAmount = 0;
    let hasNonCash = false;
    let allNonCashPaid = true;

    paymentBreakdown.forEach((split: PaymentBreakdownItem, index: number) => {
      if (split.method_type === 'cash') {
        paymentParts.push(`наличкой ${split.amount.toFixed(0)} грн`);

        if (split.cash_given) {
          totalCashGiven += split.cash_given;
        }
        totalCashAmount += split.amount;
      } else {
        hasNonCash = true;
        if (split.status !== 'paid') {
          allNonCashPaid = false;
        }

        const isAdditional = index > 0 ? ' (добавочный счет)' : '';
        paymentParts.push(`${split.method_name} ${split.amount.toFixed(0)} грн${isAdditional}`);
      }
    });

    paymentText = paymentParts.join(', ');

    if (hasNonCash) {
      const statusText = allNonCashPaid ? 'Оплачено' : 'Не оплачено';
      paymentText += ` ${statusText}`;
    }

    if (totalCashGiven > totalCashAmount) {
      const change = totalCashGiven - totalCashAmount;
      changeText = `\n💵 Подготовить сдачу: ${change.toFixed(2)} грн (с ${totalCashGiven.toFixed(2)} грн)`;
    }
  } else if (paymentMethod && order.total_amount != null) {
    const amount = order.total_amount || 0;

    if (paymentMethod.method_type === 'cash') {
      paymentText = `наличкой ${amount.toFixed(2)} грн`;

      if (order.cash_amount && order.cash_amount > amount) {
        const change = order.cash_amount - amount;
        changeText = `\n💵 Подготовить сдачу: ${change.toFixed(2)} грн (с ${order.cash_amount.toFixed(2)} грн)`;
      }
    } else {
      const statusText = order.payment_status === 'paid' ? 'Оплачено' : 'Не оплачено';
      paymentText = `${paymentMethod.name} ${amount.toFixed(2)} грн ${statusText}`;
    }
  } else {
    paymentText = paymentMethod?.name || 'Не указан';
  }

  return { paymentText, changeText };
}

function buildGroupMessage(order: any, branch: any, paymentMethod: any): string {
  const orderNumber = order.shift_order_number || order.order_number || order.id;
  const address = order.address_line || 'Не указан';
  const encodedAddress = encodeURIComponent(address);

  let scheduledBlock = '';
  if (order.scheduled_at) {
    const scheduledDate = new Date(order.scheduled_at);
    const day = String(scheduledDate.getDate()).padStart(2, '0');
    const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
    const year = scheduledDate.getFullYear();
    const hours = String(scheduledDate.getHours()).padStart(2, '0');
    const minutes = String(scheduledDate.getMinutes()).padStart(2, '0');
    scheduledBlock = `\n🕐 ⚠️ ЗАКАЗ НА ВРЕМЯ: ${day}.${month}.${year} в ${hours}:${minutes}\n`;
  }

  let distanceBlock = '';
  if (order.distance_km != null && order.duration_minutes != null) {
    const distance = Number(order.distance_km).toFixed(1);
    distanceBlock = `🛣 Расстояние / время пути: ${distance} км / ${order.duration_minutes} мин\n\n`;
  }

  let commentBlock = '';
  if (order.comment) {
    commentBlock = `\n💬 Комментарий: ${order.comment}`;
  }

  let deliveryBlock = '';
  if (order.delivery_price_uah != null && order.delivery_price_uah > 0) {
    deliveryBlock = `\n🚗 Доставка: ${Number(order.delivery_price_uah).toFixed(2)} грн`;
  }

  let addressDetailsBlock = '';
  if (order.floor) {
    addressDetailsBlock += `\n🏢 Этаж: ${order.floor}`;
  }
  if (order.apartment) {
    addressDetailsBlock += `\n🚪 Квартира: ${order.apartment}`;
  }
  if (order.entrance) {
    addressDetailsBlock += `\n🚶 Парадная: ${order.entrance}`;
  }
  if (order.intercom) {
    addressDetailsBlock += `\n🔔 Домофон: ${order.intercom}`;
  }
  if (order.office) {
    addressDetailsBlock += `\n🏢 Офис: ${order.office}`;
  }

  const { paymentText, changeText } = buildPaymentInfo(order, paymentMethod);
  const totalAmount = order.total_amount || 0;

  return (
`🆕 <b>НОВЫЙ ЗАКАЗ #${orderNumber}</b>${scheduledBlock}
🏢 Филиал: ${branch?.name || 'Не указан'}
🏪 Адрес филиала: ${branch?.address || 'Не указан'}
☎️ Телефон филиала: ${branch?.phone || 'Не указан'}

──────────────────

📱 Телефон клиента: ${order.phone || 'Не указан'}
📍 Адрес доставки: ${address}${addressDetailsBlock}

📍 <a href=\"https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}\">Проложить маршрут</a>
${distanceBlock}
📦 Состав заказа: ${order.order_items_summary || 'Не указан'}${commentBlock}

──────────────────

💰 Сумма заказа: ${Number(totalAmount).toFixed(0)} грн${deliveryBlock}
💳 Оплата: ${paymentText}${changeText}
`
  );
}

function buildCourierPrivateMessage(order: any, branch: any, paymentMethod: any): string {
  const orderNumber = order.shift_order_number || order.order_number || order.id;
  const address = order.address_line || 'Не указан';
  const encodedAddress = encodeURIComponent(address);

  let scheduledBlock = '';
  if (order.scheduled_at) {
    const scheduledDate = new Date(order.scheduled_at);
    const day = String(scheduledDate.getDate()).padStart(2, '0');
    const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
    const year = scheduledDate.getFullYear();
    const hours = String(scheduledDate.getHours()).padStart(2, '0');
    const minutes = String(scheduledDate.getMinutes()).padStart(2, '0');
    scheduledBlock = `\n\n🕐 <b>⚠️ ЗАКАЗ НА ВРЕМЯ:</b>\n<b>${day}.${month}.${year} в ${hours}:${minutes}</b>\n`;
  }

  const distance = order.distance_km != null ? Number(order.distance_km).toFixed(1) : 'Не указан';
  const duration = order.duration_minutes != null ? `${order.duration_minutes}` : 'Не указан';

  let commentBlock = '';
  if (order.comment) {
    commentBlock = `\n💬 Комментарий: ${order.comment}\n`;
  }

  let deliveryBlock = '';
  if (order.delivery_price_uah != null && order.delivery_price_uah > 0) {
    deliveryBlock = `\n🚗 Доставка: ${Number(order.delivery_price_uah).toFixed(2)} грн`;
  }

  let addressDetailsBlock = '';
  if (order.floor) {
    addressDetailsBlock += `\n🏢 Этаж: ${order.floor}`;
  }
  if (order.apartment) {
    addressDetailsBlock += `\n🚪 Квартира: ${order.apartment}`;
  }
  if (order.entrance) {
    addressDetailsBlock += `\n🚶 Парадная: ${order.entrance}`;
  }
  if (order.intercom) {
    addressDetailsBlock += `\n🔔 Домофон: ${order.intercom}`;
  }
  if (order.office) {
    addressDetailsBlock += `\n🏢 Офис: ${order.office}`;
  }

  const { paymentText, changeText } = buildPaymentInfo(order, paymentMethod);
  const totalAmount = order.total_amount || 0;

  return (
`<b>ЗАКАЗ #${orderNumber}</b>${scheduledBlock}

🏢 Филиал: ${branch?.name || 'Не указан'}
🏪 Адрес филиала: ${branch?.address || 'Не указан'}
☎️ Телефон филиала: ${branch?.phone || 'Не указан'}

──────────────────

📱 Телефон клиента: ${order.phone || 'Не указан'}
📍 Адрес доставки: ${address}${addressDetailsBlock}

📍 <a href=\"https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}\">Проложить маршрут</a>

🛣 Расстояние: ${distance} км
⏱ Время в пути: ${duration} мин

──────────────────

📦 Состав заказа: ${order.order_items_summary || 'Не указан'}
${commentBlock}──────────────────

💰 Сумма заказа: ${Number(totalAmount).toFixed(2)} грн${deliveryBlock}
💳 Оплата: ${paymentText}${changeText}
`
  );
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

async function handleEnRoute(supabase: any, callbackQuery: any, orderId: string, userId: number) {
  console.log('=== EN ROUTE CALLED ===');
  console.log('Order ID:', orderId);
  console.log('User ID:', userId);

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

  console.log('Order query result:', { data: order, error: orderError });

  if (orderError || !order) {
    await answerCallbackQuery(supabase, callbackQuery.id, "❌ Заказ не найден");
    return new Response(
      JSON.stringify({ error: "Order not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (!order.courier || String(order.courier.telegram_user_id) !== String(userId)) {
    await answerCallbackQuery(supabase, callbackQuery.id, "❌ Этот заказ назначен другому курьеру");
    return new Response(
      JSON.stringify({ error: "Not authorized" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'en_route',
      en_route_at: new Date().toISOString()
    })
    .eq('id', orderId);

  if (updateError) {
    console.error('Error updating order:', updateError);
    await answerCallbackQuery(supabase, callbackQuery.id, "❌ Ошибка при обновлении статуса");
    return new Response(
      JSON.stringify({ error: "Failed to update order" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

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

  await answerCallbackQuery(supabase, callbackQuery.id, "✅ Статус обновлен: В дороге");

  return new Response(
    JSON.stringify({ ok: true, message: "Order status updated to en_route" }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleCompleteOrder(supabase: any, callbackQuery: any, orderId: string, userId: number) {
  console.log('=== COMPLETE ORDER CALLED ===');
  console.log('Order ID:', orderId);
  console.log('User ID:', userId);

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id, partner_id, status, courier_id, telegram_message_id,
      delivery_lat, delivery_lng,
      branches(telegram_bot_token, telegram_chat_id),
      courier:couriers(id, telegram_user_id, name, lastname)
    `)
    .eq('id', orderId)
    .maybeSingle();

  console.log('Order query result:', { data: order, error: orderError });

  if (!order) {
    console.error('Order not found for ID:', orderId);
    console.error('Query error:', orderError);

    const { data: archivedOrder } = await supabase
      .from('archived_orders')
      .select('id, status')
      .eq('id', orderId)
      .maybeSingle();

    console.log('Checking archived_orders:', archivedOrder);

    await answerCallbackQuery(supabase, callbackQuery.id, "❌ Заказ не найден");
    return new Response(JSON.stringify({ error: "Order not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: settings } = await supabase
    .from('partner_settings')
    .select('courier_bot_token, completion_radius_meters, require_courier_location_on_completion')
    .eq('partner_id', order.partner_id)
    .maybeSingle();

  if (!settings?.courier_bot_token) {
    await answerCallbackQuery(supabase, callbackQuery.id, "❌ Ошибка конфигурации");
    return new Response(
      JSON.stringify({ error: "Bot token not found" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (!order.courier || String(order.courier.telegram_user_id) !== String(userId)) {
    await answerCallbackQuery(supabase, callbackQuery.id, "❌ Этот заказ назначен другому курьеру");
    return new Response(
      JSON.stringify({ error: "Not authorized" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (order.status !== 'en_route') {
    await answerCallbackQuery(supabase, callbackQuery.id, "⚠️ Вы должны сначала выехать");
    return new Response(
      JSON.stringify({ ok: true, message: "Must be en_route first" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (settings.require_courier_location_on_completion) {
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

    await answerCallbackQuery(supabase, callbackQuery.id, "📍 Отправьте ваше местоположение");
  } else {
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
      await answerCallbackQuery(supabase, callbackQuery.id, "❌ Ошибка при завершении заказа");
      return new Response(
        JSON.stringify({ error: "Failed to update order" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

    await supabase
      .from('logs')
      .insert({
        partner_id: order.partner_id,
        section: 'orders',
        log_level: 'info',
        message: `Курьер ${order.courier.name} ${order.courier.lastname} завершил заказ`,
        details: {
          orderId,
          courierId: order.courier.id,
          courierName: `${order.courier.name} ${order.courier.lastname}`.trim()
        }
      });

    await answerCallbackQuery(supabase, callbackQuery.id, "✅ Заказ завершен");
  }

  return new Response(
    JSON.stringify({ ok: true, message: "Order completed successfully" }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleLocationShared(supabase: any, body: any) {
  const message = body.message;
  const userId = message.from.id;
  const chatId = message.chat.id;
  const location = message.location;

  console.log('Received location:', { userId, chatId, location });

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

  if (!order.courier || String(order.courier.telegram_user_id) !== String(userId)) {
    return new Response(
      JSON.stringify({ error: "Not authorized" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

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

  const distance = calculateDistance(
    location.latitude,
    location.longitude,
    order.delivery_lat,
    order.delivery_lng
  );

  console.log(`Distance: ${distance}m, Allowed: ${allowedRadius}m`);

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

  await supabase
    .from('logs')
    .delete()
    .eq('partner_id', order.partner_id)
    .eq('action', `location_request_${userId}_${orderId}`);

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

async function answerCallbackQuery(supabase: any, callbackQueryId: string, text: string) {
  try {
    const { data: settings } = await supabase
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

async function handleStartCommand(supabase: any, body: any) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleTextMessage(supabase: any, body: any) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleRegistrationCallback(supabase: any, callbackQuery: any, callbackData: string) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleBranchSelection(supabase: any, callbackQuery: any, branchId: string) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleVehicleSelection(supabase: any, callbackQuery: any, vehicleType: string) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleAcceptOrder(supabase: any, callbackQuery: any, orderId: string) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCancelOrder(supabase: any, callbackQuery: any, orderId: string, chatId: number, messageId: number, userId: number) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    console.log('Received webhook:', JSON.stringify(body, null, 2));

    if (body.message?.text?.startsWith('/start')) {
      return await handleStartCommand(supabase, body);
    }

    if (body.message?.location) {
      return await handleLocationShared(supabase, body);
    }

    if (body.message?.text && !body.message.text.startsWith('/')) {
      return await handleTextMessage(supabase, body);
    }

    if (!body.callback_query) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callbackQuery = body.callback_query;
    const callbackData = callbackQuery.data;
    const chatId = callbackQuery.message?.chat?.id;
    const messageId = callbackQuery.message?.message_id;
    const userId = callbackQuery.from.id;

    console.log('Callback data:', callbackData);

    if (callbackData.startsWith('reg_')) {
      return await handleRegistrationCallback(supabase, callbackQuery, callbackData);
    }

    if (callbackData.startsWith('branch_')) {
      return await handleBranchSelection(supabase, callbackQuery, callbackData.replace('branch_', ''));
    }

    if (callbackData.startsWith('vehicle_')) {
      return await handleVehicleSelection(supabase, callbackQuery, callbackData.replace('vehicle_', ''));
    }

    if (callbackData.startsWith('accept_order_')) {
      return await handleAcceptOrder(supabase, callbackQuery, callbackData.replace('accept_order_', ''));
    }

    if (callbackData.startsWith('cancel_order_')) {
      return await handleCancelOrder(supabase, callbackQuery, callbackData.replace('cancel_order_', ''), chatId, messageId, userId);
    }

    if (callbackData.startsWith('en_route_')) {
      return await handleEnRoute(supabase, callbackQuery, callbackData.replace('en_route_', ''), userId);
    }

    if (callbackData.startsWith('complete_order_')) {
      return await handleCompleteOrder(supabase, callbackQuery, callbackData.replace('complete_order_', ''), userId);
    }

    return new Response(JSON.stringify({ ok: true, message: "Unknown action" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Error in courier-bot-webhook:', error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});