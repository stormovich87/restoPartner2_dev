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

interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: {
      id: number;
      username?: string;
      first_name: string;
      last_name?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
      };
    };
    data?: string;
  };
  message?: {
    message_id: number;
    from: {
      id: number;
      username?: string;
      first_name: string;
      last_name?: string;
    };
    chat: {
      id: number;
    };
    text?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string, showAlert: boolean = false) {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
        show_alert: showAlert,
      }),
    });
  } catch (err) {
    console.error('Exception answering callback query:', err);
  }
}

async function deleteMessage(botToken: string, chatId: number, messageId: number) {
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

async function sendMessage(botToken: string, chatId: number, text: string, replyMarkup?: any) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    const body: any = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Exception sending message:', err);
    return null;
  }
}

async function editMessage(botToken: string, chatId: number, messageId: number, text: string, replyMarkup?: any) {
  const url = `https://api.telegram.org/bot${botToken}/editMessageText`;
  try {
    const body: any = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML',
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Exception editing message:', err);
    return null;
  }
}

async function handleEnRoute(botToken: string, callbackQuery: any, orderExecutorId: string) {
  const telegramUserId = callbackQuery.from.id;
  const messageId = callbackQuery.message?.message_id;
  const chatId = callbackQuery.message?.chat?.id || telegramUserId;

  console.log('=== EXTERNAL COURIER EN ROUTE ===');
  console.log('Order executor ID:', orderExecutorId);

  const { data: orderExecutor, error: oeError } = await supabase
    .from('order_executors')
    .select(`
      *,
      executor:executors(partner_id),
      zone:performer_delivery_zones!zone_id(name, courier_payment),
      order:orders(
        *,
        branch:branches(name, address, phone, latitude, longitude),
        payment_method:payment_methods(name)
      )
    `)
    .eq('id', orderExecutorId)
    .maybeSingle();

  if (oeError || !orderExecutor) {
    await answerCallbackQuery(botToken, callbackQuery.id, 'Заказ не найден', true);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (orderExecutor.status !== 'assigned') {
    await answerCallbackQuery(botToken, callbackQuery.id, 'Заказ уже обработан', true);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { error: updateError } = await supabase
    .from('order_executors')
    .update({
      status: 'en_route',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderExecutorId);

  if (updateError) {
    await answerCallbackQuery(botToken, callbackQuery.id, 'Ошибка при обновлении статуса', true);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await supabase
    .from('orders')
    .update({
      status: 'en_route',
      en_route_at: new Date().toISOString()
    })
    .eq('id', orderExecutor.order_id);

  const order = orderExecutor.order;
  const orderNumber = order.shift_order_number || order.order_number || order.id;

  const { data: orderItems } = await supabase
    .from('order_items')
    .select('product_name, quantity, modifiers')
    .eq('order_id', order.id);

  const branchName = order.branch?.name || 'Филиал';
  const branchAddress = order.branch?.address || 'Не указан';
  const branchPhone = order.branch?.phone || 'Не указан';
  const branchLat = order.branch?.latitude;
  const branchLng = order.branch?.longitude;
  let branchNavigation = '';
  if (branchLat && branchLng) {
    branchNavigation = `<a href="https://www.google.com/maps/dir/?api=1&destination=${branchLat},${branchLng}">Навигация к филиалу</a>`;
  }

  const deliveryAddress = order.delivery_address || order.address_line || order.address || 'Не указан';
  const deliveryLat = order.delivery_lat;
  const deliveryLng = order.delivery_lng;
  let deliveryNavigation = '';
  if (deliveryLat && deliveryLng) {
    deliveryNavigation = `<a href="https://www.google.com/maps/dir/?api=1&destination=${deliveryLat},${deliveryLng}">Навигация к клиенту</a>`;
  } else {
    const encodedAddress = encodeURIComponent(deliveryAddress);
    deliveryNavigation = `<a href="https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}">Навигация к клиенту</a>`;
  }

  let addressDetails = '';
  if (order.floor) addressDetails += `\n Этаж: ${order.floor}`;
  if (order.apartment) addressDetails += `\n Квартира: ${order.apartment}`;
  if (order.entrance) addressDetails += `\n Парадная: ${order.entrance}`;
  if (order.intercom) addressDetails += `\n Домофон: ${order.intercom}`;
  if (order.office) addressDetails += `\n Офис: ${order.office}`;

  let distanceTimeBlock = '';
  if (order.distance_km && order.duration_minutes) {
    distanceTimeBlock = `\n Расстояние: ${order.distance_km.toFixed(1)} км\n Время в пути: ${order.duration_minutes} мин`;
  } else if (order.distance_km) {
    distanceTimeBlock = `\n Расстояние: ${order.distance_km.toFixed(1)} км`;
  }

  let itemsBlock = '';
  if (orderItems && orderItems.length > 0) {
    itemsBlock = '\n\n<b>Содержание заказа:</b>';
    for (const item of orderItems) {
      itemsBlock += `\n- ${item.product_name} x${item.quantity}`;
      if (item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0) {
        itemsBlock += ` (${item.modifiers.map((m: any) => m.name).join(', ')})`;
      }
    }
  }

  const paymentMethod = order.payment_method?.name || 'Не указан';
  let paymentStatus = '';
  if (paymentMethod.toLowerCase().includes('безнал') || paymentMethod.toLowerCase().includes('карт')) {
    paymentStatus = ' (Безнал/Счет)';
  }

  let deliveryPaymentBlock = '';
  const zonePayment = orderExecutor.zone?.courier_payment || 0;
  const distancePrice = orderExecutor.distance_price_uah || 0;
  const roundedDistanceKm = orderExecutor.rounded_distance_km || 0;
  const totalDeliveryPayment = orderExecutor.total_delivery_price_uah || (zonePayment + distancePrice);

  const deliveryPayer = orderExecutor.delivery_payer || 'client';
  const payerText = deliveryPayer === 'client' ? 'Оплачивает клиент' : 'Оплачивает заведение';

  if (orderExecutor.zone?.name) {
    deliveryPaymentBlock = `\n\n<b>Расчет за доставку:</b>`;
    deliveryPaymentBlock += `\n- Зона \"${orderExecutor.zone.name}\": ${zonePayment} грн`;
    if (distancePrice > 0 && roundedDistanceKm > 0) {
      deliveryPaymentBlock += `\n- Километраж: ${roundedDistanceKm.toFixed(1)} км = ${distancePrice.toFixed(2)} грн`;
    }
    deliveryPaymentBlock += `\n- <b>Итого за доставку: ${totalDeliveryPayment.toFixed(2)} грн</b>`;
    deliveryPaymentBlock += `\n- ${payerText}`;
  }

  let commentBlock = '';
  if (order.comment) {
    commentBlock = `\n\nКомментарий: ${order.comment}`;
  }

  const updatedMessage = `<b>🚗 В ДОРОГЕ - ЗАКАЗ #${orderNumber}</b>\n\n<b>🏪 ОТКУДА ЗАБРАТЬ:</b>\n${branchName}\n📍 ${branchAddress}\n📞 Телефон филиала: ${branchPhone}\n${branchNavigation}\n\n<b>🏠 КУДА ВЕЗТИ:</b>\n📍 ${deliveryAddress}${addressDetails}\n📞 Телефон клиента: ${order.phone || 'Не указан'}\n${deliveryNavigation}${distanceTimeBlock}${itemsBlock}\n\n<b>💰 СУММА ЗАКАЗА: ${order.total_amount || 0} грн</b>\n💳 Способ оплаты: ${paymentMethod}${paymentStatus}${deliveryPaymentBlock}${commentBlock}`;

  const completeButton = {
    inline_keyboard: [[
      {
        text: '✅ Выполнено',
        callback_data: `ext_complete:${orderExecutorId}`
      }
    ]]
  };

  if (messageId && chatId) {
    await editMessage(botToken, chatId, messageId, updatedMessage, completeButton);
  }

  await answerCallbackQuery(botToken, callbackQuery.id, 'Статус обновлен: В дороге', false);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleComplete(botToken: string, callbackQuery: any, orderExecutorId: string) {
  const telegramUserId = callbackQuery.from.id;
  const messageId = callbackQuery.message?.message_id;
  const chatId = callbackQuery.message?.chat?.id || telegramUserId;

  console.log('=== EXTERNAL COURIER COMPLETE ===');
  console.log('Order executor ID:', orderExecutorId);

  const { data: orderExecutor, error: oeError } = await supabase
    .from('order_executors')
    .select(`
      *,
      executor:executors(partner_id),
      zone:performer_delivery_zones!zone_id(name, courier_payment),
      order:orders(
        id,
        shift_order_number,
        order_number,
        created_at,
        en_route_at,
        total_amount
      )
    `)
    .eq('id', orderExecutorId)
    .maybeSingle();

  if (oeError || !orderExecutor) {
    await answerCallbackQuery(botToken, callbackQuery.id, 'Заказ не найден', true);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (orderExecutor.status !== 'en_route') {
    if (orderExecutor.status === 'completed') {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Заказ уже выполнен', true);
    } else {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Сначала нажмите "Выехал"', true);
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const completedAt = new Date();

  const { error: updateError } = await supabase
    .from('order_executors')
    .update({
      status: 'completed',
      updated_at: completedAt.toISOString(),
    })
    .eq('id', orderExecutorId);

  if (updateError) {
    await answerCallbackQuery(botToken, callbackQuery.id, 'Ошибка при завершении заказа', true);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const order = orderExecutor.order;
  const orderNumber = order.shift_order_number || order.order_number || order.id;

  const zonePayment = orderExecutor.zone?.courier_payment || 0;
  const distancePrice = orderExecutor.distance_price_uah || 0;
  const totalDeliveryPayment = orderExecutor.total_delivery_price_uah || (zonePayment + distancePrice);

  await supabase
    .from('orders')
    .update({
      status: 'completed',
      completed_at: completedAt.toISOString(),
      courier_payment_amount: totalDeliveryPayment
    })
    .eq('id', orderExecutor.order_id);

  const orderCreatedAt = new Date(order.created_at);
  const totalTimeMs = completedAt.getTime() - orderCreatedAt.getTime();
  const totalMinutes = Math.floor(totalTimeMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  let totalTimeStr = '';
  if (hours > 0) {
    totalTimeStr = `${hours} ч ${minutes} мин`;
  } else {
    totalTimeStr = `${minutes} мин`;
  }

  let deliveryTimeStr = '';
  if (order.en_route_at) {
    const enRouteAt = new Date(order.en_route_at);
    const deliveryTimeMs = completedAt.getTime() - enRouteAt.getTime();
    const deliveryMinutes = Math.floor(deliveryTimeMs / 60000);
    const dHours = Math.floor(deliveryMinutes / 60);
    const dMinutes = deliveryMinutes % 60;
    if (dHours > 0) {
      deliveryTimeStr = `${dHours} ч ${dMinutes} мин`;
    } else {
      deliveryTimeStr = `${dMinutes} мин`;
    }
  }

  let completedMessage = `<b>✅ ЗАКАЗ #${orderNumber} ВЫПОЛНЕН</b>\n\n`;
  completedMessage += `<b>📊 Статистика:</b>\n`;
  completedMessage += `⏱ Общее время: ${totalTimeStr}\n`;
  if (deliveryTimeStr) {
    completedMessage += `🚗 Время доставки: ${deliveryTimeStr}\n`;
  }
  completedMessage += `\n<b>💰 Заработано за доставку: ${totalDeliveryPayment.toFixed(2)} грн</b>`;

  if (messageId && chatId) {
    await editMessage(botToken, chatId, messageId, completedMessage);
  }

  await answerCallbackQuery(botToken, callbackQuery.id, 'Заказ выполнен!', false);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const update: TelegramUpdate = await req.json();
    console.log('=== EXTERNAL COURIER ACCEPT ORDER WEBHOOK CALLED ===');
    console.log('Received Telegram update:', JSON.stringify(update));

    const url = new URL(req.url);
    const botToken = url.searchParams.get('token');
    console.log('Bot token from URL:', botToken ? 'present' : 'missing');

    if (!botToken) {
      console.error('Bot token not provided in URL');
      return new Response(JSON.stringify({ error: 'Bot token not provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!update.callback_query) {
      console.log('No callback_query in update, skipping');
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callbackQuery = update.callback_query;
    const data = callbackQuery.data;
    const telegramUserId = callbackQuery.from.id;
    console.log('Callback data:', data);

    if (data?.startsWith('ext_en_route:')) {
      return await handleEnRoute(botToken, callbackQuery, data.replace('ext_en_route:', ''));
    }

    if (data?.startsWith('ext_complete:')) {
      return await handleComplete(botToken, callbackQuery, data.replace('ext_complete:', ''));
    }

    if (data?.startsWith('eta_')) {
      console.log('=== EXTERNAL COURIER ETA SELECTION ===');
      const messageId = callbackQuery.message?.message_id;
      const chatId = callbackQuery.message?.chat?.id || telegramUserId;

      const { data: courierState, error: stateError } = await supabase
        .from('external_courier_states')
        .select('*')
        .eq('telegram_user_id', telegramUserId.toString())
        .maybeSingle();

      if (stateError || !courierState) {
        console.error('Courier state not found:', stateError);
        await answerCallbackQuery(botToken, callbackQuery.id, 'Состояние не найдено', true);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (courierState.step !== 'awaiting_eta') {
        console.log('Wrong step, expected awaiting_eta, got:', courierState.step);
        await answerCallbackQuery(botToken, callbackQuery.id);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const etaMinutes = parseInt(data.replace('eta_', ''));
      if (isNaN(etaMinutes)) {
        await answerCallbackQuery(botToken, callbackQuery.id, 'Неверное значение', true);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Selected ETA minutes:', etaMinutes);

      if (messageId && chatId) {
        await deleteMessage(botToken, chatId, messageId);
        console.log('Deleted ETA question message:', messageId);
      }

      const etaPickupAt = new Date(Date.now() + etaMinutes * 60 * 1000);

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          eta_pickup_minutes: etaMinutes,
          eta_pickup_at: etaPickupAt.toISOString(),
          eta_source: 'manual_button',
        })
        .eq('id', courierState.order_id);

      if (updateError) {
        console.error('Error updating order with ETA:', updateError);
      } else {
        console.log('Order updated with ETA:', etaMinutes, 'minutes, pickup at:', etaPickupAt.toISOString());
      }

      const { data: orderExecutors } = await supabase
        .from('order_executors')
        .select('id')
        .eq('order_id', courierState.order_id)
        .eq('status', 'assigned');

      if (orderExecutors && orderExecutors.length > 0) {
        for (const oe of orderExecutors) {
          await supabase
            .from('order_executors')
            .update({
              eta_pickup_minutes: etaMinutes,
              eta_pickup_at: etaPickupAt.toISOString()
            })
            .eq('id', oe.id);
        }
      }

      await supabase
        .from('external_courier_states')
        .delete()
        .eq('telegram_user_id', telegramUserId.toString());

      console.log('Cleared courier state');

      await answerCallbackQuery(botToken, callbackQuery.id, `Время установлено: ${etaMinutes} мин`, false);

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data?.startsWith('accept_order:')) {
      console.log('Callback data does not start with accept_order:, skipping');
      await answerCallbackQuery(botToken, callbackQuery.id);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orderExecutorId = data.replace('accept_order:', '');
    console.log('=== EXTERNAL COURIER ACCEPT ORDER ===');
    console.log('Order executor ID:', orderExecutorId);
    console.log('Telegram user ID:', telegramUserId);
    console.log('User data:', JSON.stringify(callbackQuery.from));

    const { data: orderExecutor, error: oeError } = await supabase
      .from('order_executors')
      .select(`
        *,
        executor:executors(*),
        zone:performer_delivery_zones!zone_id(name, courier_payment),
        order:orders(
          *,
          branch:branches(name, address, phone, latitude, longitude),
          payment_method:payment_methods(name)
        )
      `)
      .eq('id', orderExecutorId)
      .maybeSingle();

    if (oeError || !orderExecutor) {
      console.error('Order executor not found:', oeError);
      await answerCallbackQuery(botToken, callbackQuery.id, 'Заказ не найден', true);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Order executor found:', {
      id: orderExecutor.id,
      status: orderExecutor.status,
      executor_id: orderExecutor.executor_id,
      allow_external: orderExecutor.executor?.allow_external_couriers
    });

    if (orderExecutor.status === 'assigned') {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Этот заказ уже принят другим курьером', true);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (orderExecutor.status === 'completed' || orderExecutor.status === 'cancelled') {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Этот заказ уже завершён или отменён', true);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Searching for courier with telegram_user_id:', telegramUserId.toString(), 'partner_id:', orderExecutor.executor.partner_id);

    const { data: courier, error: courierError } = await supabase
      .from('couriers')
      .select('id, name, lastname, partner_id, is_external, is_own, is_active')
      .eq('telegram_user_id', telegramUserId.toString())
      .eq('partner_id', orderExecutor.executor.partner_id)
      .eq('is_active', true)
      .maybeSingle();

    console.log('Courier search result:', { courier, courierError });

    if (!orderExecutor.executor.allow_external_couriers && (courierError || !courier)) {
      console.error('Courier not found and external couriers not allowed:', courierError);
      await answerCallbackQuery(botToken, callbackQuery.id, 'Вы не зарегистрированы как курьер', true);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (courier && courier.is_own && !courier.is_external) {
      console.log('Courier is registered as company courier, not external - cannot accept order');

      const { data: partnerSettings } = await supabase
        .from('partner_settings')
        .select('external_courier_bot_token')
        .eq('partner_id', orderExecutor.executor.partner_id)
        .maybeSingle();

      let replyMarkup;
      if (partnerSettings?.external_courier_bot_token) {
        try {
          const botInfoResponse = await fetch(`https://api.telegram.org/bot${partnerSettings.external_courier_bot_token}/getMe`);
          if (botInfoResponse.ok) {
            const botInfoData = await botInfoResponse.json();
            const botUsername = botInfoData.result?.username;
            if (botUsername) {
              replyMarkup = {
                inline_keyboard: [[
                  {
                    text: 'Зарегистрироваться как сторонний курьер',
                    url: `https://t.me/${botUsername}?start=register`
                  }
                ]]
              };
            }
          }
        } catch (err) {
          console.error('Error getting bot username:', err);
        }
      }

      await answerCallbackQuery(botToken, callbackQuery.id);

      await sendMessage(
        botToken,
        telegramUserId,
        `Вы не можете принять этот заказ, так как вы зарегистрированы как <b>курьер фирмы</b>.\n\n` +
        `Для приема заказов от сторонних исполнителей вам необходимо зарегистрироваться как <b>сторонний курьер</b>.\n\n` +
        `После регистрации вы сможете принимать такие заказы.`,
        replyMarkup
      );

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (orderExecutor.executor.allow_external_couriers && !courier) {
      console.log('External couriers allowed, courier not found in DB - will use Telegram data');
    } else if (courier) {
      console.log('Courier found in DB:', courier.id, 'is_external:', courier.is_external);
    }

    let courierFullName: string;
    let courierId: string | null = null;

    if (courier) {
      courierFullName = `${courier.name}${courier.lastname ? ' ' + courier.lastname : ''}`;
      courierId = courier.id;
    } else {
      const firstName = callbackQuery.from.first_name || '';
      const lastName = callbackQuery.from.last_name || '';
      const username = callbackQuery.from.username || '';
      courierFullName = `${firstName} ${lastName}`.trim() || username || `Курьер ${telegramUserId}`;
    }

    const currentMessageId = orderExecutor.telegram_message_id;
    const currentBranchId = orderExecutor.branch_id;

    console.log('Updating order_executor:', {
      orderExecutorId,
      courierId,
      courierFullName,
      currentStatus: orderExecutor.status
    });

    const { error: updateError } = await supabase
      .from('order_executors')
      .update({
        status: 'assigned',
        courier_id: courierId,
        courier_name: courierFullName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderExecutorId)
      .eq('status', 'searching');

    if (updateError) {
      console.error('Error updating order executor:', updateError);
      await answerCallbackQuery(botToken, callbackQuery.id, 'Ошибка при принятии заказа', true);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Order executor updated successfully');

    if (currentMessageId) {
      let deleteBotToken = orderExecutor.executor?.telegram_bot_token;
      let deleteChatId = orderExecutor.executor?.telegram_chat_id;

      if (currentBranchId && orderExecutor.executor?.distribute_by_branches) {
        const { data: branchSettings } = await supabase
          .from('executor_branch_telegram_settings')
          .select('telegram_bot_token, telegram_chat_id')
          .eq('executor_id', orderExecutor.executor_id)
          .eq('branch_id', currentBranchId)
          .maybeSingle();

        if (branchSettings) {
          deleteBotToken = branchSettings.telegram_bot_token || deleteBotToken;
          deleteChatId = branchSettings.telegram_chat_id || deleteChatId;
        }
      }

      if (deleteBotToken && deleteChatId) {
        await deleteMessage(
          deleteBotToken,
          parseInt(deleteChatId),
          parseInt(currentMessageId)
        );
        console.log('Deleted message from executor group:', currentMessageId);
      }
    }

    const { data: allOrderExecutors } = await supabase
      .from('order_executors')
      .select(`
        id,
        telegram_message_id,
        branch_id,
        executor:executors(telegram_bot_token, telegram_chat_id, distribute_by_branches)
      `)
      .eq('order_id', orderExecutor.order_id)
      .eq('executor_id', orderExecutor.executor_id)
      .eq('status', 'searching')
      .neq('id', orderExecutorId);

    if (allOrderExecutors && allOrderExecutors.length > 0) {
      for (const oe of allOrderExecutors) {
        if (oe.telegram_message_id) {
          let delBotToken = oe.executor?.telegram_bot_token;
          let delChatId = oe.executor?.telegram_chat_id;

          if (oe.branch_id && oe.executor?.distribute_by_branches) {
            const { data: brSettings } = await supabase
              .from('executor_branch_telegram_settings')
              .select('telegram_bot_token, telegram_chat_id')
              .eq('executor_id', orderExecutor.executor_id)
              .eq('branch_id', oe.branch_id)
              .maybeSingle();

            if (brSettings) {
              delBotToken = brSettings.telegram_bot_token || delBotToken;
              delChatId = brSettings.telegram_chat_id || delChatId;
            }
          }

          if (delBotToken && delChatId) {
            await deleteMessage(
              delBotToken,
              parseInt(delChatId),
              parseInt(oe.telegram_message_id)
            );
          }
        }
      }

      await supabase
        .from('order_executors')
        .update({ status: 'cancelled' })
        .eq('order_id', orderExecutor.order_id)
        .eq('executor_id', orderExecutor.executor_id)
        .eq('status', 'searching')
        .neq('id', orderExecutorId);
    }

    const order = orderExecutor.order;
    const orderNumber = order.shift_order_number || order.order_number || order.id;

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_name, quantity, base_price, total_price, modifiers')
      .eq('order_id', order.id);

    const branchName = order.branch?.name || 'Филиал';
    const branchAddress = order.branch?.address || 'Не указан';
    const branchPhone = order.branch?.phone || 'Не указан';
    const branchLat = order.branch?.latitude;
    const branchLng = order.branch?.longitude;
    let branchNavigation = '';
    if (branchLat && branchLng) {
      branchNavigation = `<a href=\"https://www.google.com/maps/dir/?api=1&destination=${branchLat},${branchLng}\">Навигация к филиалу</a>`;
    }

    const deliveryAddress = order.delivery_address || order.address_line || order.address || 'Не указан';
    const deliveryLat = order.delivery_lat;
    const deliveryLng = order.delivery_lng;
    let deliveryNavigation = '';
    if (deliveryLat && deliveryLng) {
      deliveryNavigation = `<a href=\"https://www.google.com/maps/dir/?api=1&destination=${deliveryLat},${deliveryLng}\">Навигация к клиенту</a>`;
    } else {
      const encodedAddress = encodeURIComponent(deliveryAddress);
      deliveryNavigation = `<a href=\"https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}\">Навигация к клиенту</a>`;
    }

    let addressDetails = '';
    if (order.floor) addressDetails += `\nЭтаж: ${order.floor}`;
    if (order.apartment) addressDetails += `\nКвартира: ${order.apartment}`;
    if (order.entrance) addressDetails += `\nПарадная: ${order.entrance}`;
    if (order.intercom) addressDetails += `\nДомофон: ${order.intercom}`;
    if (order.office) addressDetails += `\nОфис: ${order.office}`;

    let distanceTimeBlock = '';
    if (order.distance_km && order.duration_minutes) {
      distanceTimeBlock = `\nРасстояние: ${order.distance_km.toFixed(1)} км\nВремя в пути: ${order.duration_minutes} мин`;
    } else if (order.distance_km) {
      distanceTimeBlock = `\nРасстояние: ${order.distance_km.toFixed(1)} км`;
    }

    let itemsBlock = '';
    if (orderItems && orderItems.length > 0) {
      itemsBlock = '\n\n<b>Содержание заказа:</b>';
      for (const item of orderItems) {
        itemsBlock += `\n- ${item.product_name} x${item.quantity}`;
        if (item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0) {
          itemsBlock += ` (${item.modifiers.map((m: any) => m.name).join(', ')})`;
        }
      }
    }

    const paymentMethod = order.payment_method?.name || 'Не указан';
    let paymentStatus = '';
    if (paymentMethod.toLowerCase().includes('безнал') || paymentMethod.toLowerCase().includes('карт')) {
      paymentStatus = ' (Безнал/Счет)';
    }

    let deliveryPaymentBlock = '';
    const zonePayment = orderExecutor.zone?.courier_payment || 0;
    const distancePrice = orderExecutor.distance_price_uah || 0;
    const roundedDistanceKm = orderExecutor.rounded_distance_km || 0;
    const totalDeliveryPayment = orderExecutor.total_delivery_price_uah || (zonePayment + distancePrice);

    const deliveryPayer = orderExecutor.delivery_payer || 'client';
    const payerText = deliveryPayer === 'client' ? 'Оплачивает клиент' : 'Оплачивает заведение';

    if (orderExecutor.zone?.name) {
      deliveryPaymentBlock = `\n\n<b>Расчет за доставку:</b>`;
      deliveryPaymentBlock += `\n- Зона \"${orderExecutor.zone.name}\": ${zonePayment} грн`;
      if (distancePrice > 0 && roundedDistanceKm > 0) {
        deliveryPaymentBlock += `\n- Километраж: ${roundedDistanceKm.toFixed(1)} км = ${distancePrice.toFixed(2)} грн`;
      }
      deliveryPaymentBlock += `\n- <b>Итого за доставку: ${totalDeliveryPayment.toFixed(2)} грн</b>`;
      deliveryPaymentBlock += `\n- ${payerText}`;
    }

    let commentBlock = '';
    if (order.comment) {
      commentBlock = `\n\nКомментарий: ${order.comment}`;
    }

    const privateMessage = `<b>✅ ВЫ ПРИНЯЛИ ЗАКАЗ #${orderNumber}</b>\n\n<b>🏪 ОТКУДА ЗАБРАТЬ:</b>\n${branchName}\n📍 ${branchAddress}\n📞 Телефон филиала: ${branchPhone}\n${branchNavigation}\n\n<b>🏠 КУДА ВЕЗТИ:</b>\n📍 ${deliveryAddress}${addressDetails}\n📞 Телефон клиента: ${order.phone || 'Не указан'}\n${deliveryNavigation}${distanceTimeBlock}${itemsBlock}\n\n<b>💰 СУММА ЗАКАЗА: ${order.total_amount || 0} грн</b>\n💳 Способ оплаты: ${paymentMethod}${paymentStatus}${deliveryPaymentBlock}${commentBlock}`;

    const enRouteButton = {
      inline_keyboard: [[
        {
          text: '🚗 Выехал',
          callback_data: `ext_en_route:${orderExecutorId}`
        }
      ]]
    };

    const privateMessageResult = await sendMessage(botToken, telegramUserId, privateMessage, enRouteButton);
    console.log('Private message sent, result:', privateMessageResult?.ok ? 'success' : 'failed');

    if (privateMessageResult?.ok && privateMessageResult?.result?.message_id) {
      await supabase
        .from('order_executors')
        .update({ courier_private_message_id: privateMessageResult.result.message_id.toString() })
        .eq('id', orderExecutorId);
      console.log('Saved courier private message ID:', privateMessageResult.result.message_id);
    }

    await answerCallbackQuery(botToken, callbackQuery.id, 'Заказ принят!', false);

    console.log('Preparing to send ETA question to user:', telegramUserId);

    await supabase
      .from('external_courier_states')
      .delete()
      .eq('telegram_user_id', telegramUserId.toString());

    await supabase
      .from('external_courier_states')
      .insert({
        telegram_user_id: telegramUserId.toString(),
        partner_id: orderExecutor.executor.partner_id,
        order_id: order.id,
        courier_id: courierId,
        step: 'awaiting_eta',
        eta_question_sent_at: new Date().toISOString(),
      });

    console.log('Saved ETA question state for user:', telegramUserId);

    let readinessInfo = '';
    if (orderExecutor.readiness_minutes && orderExecutor.readiness_started_at) {
      const startTime = new Date(orderExecutor.readiness_started_at).getTime();
      const now = Date.now();
      const elapsedMinutes = Math.floor((now - startTime) / 60000);
      const remainingMinutes = Math.max(0, orderExecutor.readiness_minutes - elapsedMinutes);

      if (remainingMinutes > 0) {
        readinessInfo = `\n\n<b>⏰ Заказ будет готов через: ${remainingMinutes} мин</b>`;
      } else {
        readinessInfo = `\n\n<b>✅ Заказ готов к выдаче</b>`;
      }
    }

    const etaQuestionText = `⏱ Через сколько минут вы сможете забрать заказ?${readinessInfo}`;

    const etaButtons = {
      inline_keyboard: [
        [
          { text: '10 мин', callback_data: `eta_10` },
          { text: '15 мин', callback_data: `eta_15` },
          { text: '20 мин', callback_data: `eta_20` },
        ],
        [
          { text: '30 мин', callback_data: `eta_30` },
          { text: '45 мин', callback_data: `eta_45` },
          { text: '60 мин', callback_data: `eta_60` },
        ],
      ]
    };

    const etaMessageResult = await sendMessage(botToken, telegramUserId, etaQuestionText, etaButtons);
    console.log('ETA question sent, result:', etaMessageResult?.ok ? 'success' : 'failed', 'message_id:', etaMessageResult?.result?.message_id);

    if (etaMessageResult?.ok && etaMessageResult?.result?.message_id) {
      await supabase
        .from('external_courier_states')
        .update({
          eta_question_message_id: etaMessageResult.result.message_id,
        })
        .eq('telegram_user_id', telegramUserId.toString());

      console.log('Updated ETA question state with message ID:', etaMessageResult.result.message_id);
    } else {
      console.error('Failed to send ETA question:', etaMessageResult);
    }

    console.log('Order accepted by courier:', courierId || `external_${telegramUserId}`, 'name:', courierFullName);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing update:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});