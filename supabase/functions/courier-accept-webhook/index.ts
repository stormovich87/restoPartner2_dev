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

function formatOrderItems(orderItems: Array<{
  product_name: string;
  quantity: number;
  base_price: number;
  total_price: number;
  modifiers?: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
}>): { itemsText: string; subtotal: number } {
  let itemsText = '';
  let subtotal = 0;

  orderItems.forEach((item, index) => {
    const itemTotal = item.total_price;
    const unitPrice = item.total_price / item.quantity;
    subtotal += itemTotal;

    itemsText += `\n${index + 1}. ${item.product_name}`;

    if (item.modifiers && item.modifiers.length > 0) {
      item.modifiers.forEach(mod => {
        if (mod.quantity > 0) {
          itemsText += `\n   + ${mod.name} x${mod.quantity}`;
          if (mod.price !== 0) {
            itemsText += ` (${mod.price > 0 ? '+' : ''}${mod.price.toFixed(2)} грн)`;
          }
        }
      });
    }

    itemsText += `\n   ${unitPrice.toFixed(2)} грн x ${item.quantity} = ${itemTotal.toFixed(2)} грн`;
  });

  return { itemsText, subtotal };
}

function buildCourierPrivateMessage({
  order,
  branch,
  distanceKm,
  durationMinutes,
  paymentMethod,
  paymentStatus,
  orderItems,
  deliveryPrice,
  paymentBreakdown
}: {
  order: any;
  branch: any;
  distanceKm?: number | null;
  durationMinutes?: number | null;
  paymentMethod?: any;
  paymentStatus?: string | null;
  orderItems?: Array<any>;
  deliveryPrice?: number | null;
  paymentBreakdown?: PaymentBreakdownItem[] | null;
}): string {
  const orderNumber = order.shift_order_number || order.order_number || order.id;

  const address =
    order.delivery_address ||
    order.address_line ||
    `${order.street || ''} ${order.house_number || ''}`.trim() ||
    'Не указан';

  const encodedAddress = encodeURIComponent(address);

  let itemsBlock = '';
  if (orderItems && orderItems.length > 0) {
    const { itemsText } = formatOrderItems(orderItems);
    itemsBlock = itemsText;
  } else {
    itemsBlock = order.order_items_summary || 'Не указан';
  }

  const distance =
    distanceKm != null ? Number(distanceKm).toFixed(1) : 'Не указан';

  const duration =
    durationMinutes != null ? `${durationMinutes}` : 'Не указан';

  const methodName = paymentMethod?.name || 'Не указан';

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

  let commentBlock = '';
  if (order.comment) {
    commentBlock = `\n💬 Комментарий: ${order.comment}\n`;
  }

  let paymentText = '';
  let changeText = '';

  const breakdown = paymentBreakdown || order.payment_breakdown;
  if (breakdown && Array.isArray(breakdown) && breakdown.length > 0) {
    const paymentParts: string[] = [];
    const changeParts: string[] = [];

    breakdown.forEach((split: PaymentBreakdownItem) => {
      if (split.method_type === 'cash') {
        paymentParts.push(`наличкой ${split.amount.toFixed(2)} грн`);

        if (split.cash_given && split.cash_given > split.amount) {
          const change = split.cash_given - split.amount;
          changeParts.push(`${change.toFixed(2)} грн (с ${split.cash_given.toFixed(2)} грн)`);
        }
      } else {
        const statusText = split.status === 'paid' ? 'Оплачено' : 'Не оплачено';
        paymentParts.push(`${split.method_name} ${split.amount.toFixed(2)} грн ${statusText}`);
      }
    });

    paymentText = paymentParts.join(', ');

    if (changeParts.length > 0) {
      changeText = `\n💵 Подготовить сдачу: ${changeParts.join(', ')}`;
    }
  } else if (paymentMethod?.method_type === 'cash' &&
      order.cash_amount > order.total_amount) {
    const change = order.cash_amount - order.total_amount;
    paymentText = methodName;
    changeText = `\n💵 Подготовить сдачу: ${change.toFixed(2)} грн (с ${order.cash_amount.toFixed(2)} грн)`;
  } else {
    paymentText = methodName;
  }

  let deliveryBlock = '';
  if (deliveryPrice != null && deliveryPrice > 0) {
    deliveryBlock = `\n🚗 Доставка: ${deliveryPrice.toFixed(2)} грн`;
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

  return (
`<b>ЗАКАЗ #${orderNumber}</b>${scheduledBlock}

🏢 Филиал: ${branch?.name || 'Не указан'}
🏪 Адрес филиала: ${branch?.address || 'Не указан'}
☎️ Телефон филиала: ${branch?.phone || 'Не указан'}

──────────────────

📱 Телефон клиента: ${order.phone || 'Не указан'}
📍 Адрес доставки: ${address}${addressDetailsBlock}

📍 <a href="https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}">Проложить маршрут</a>

🛣 Расстояние: ${distance} км
⏱ Время в пути: ${duration} мин

──────────────────

📦 Состав заказа:
${itemsBlock}
${commentBlock}──────────────────

💰 Сумма заказа: ${order.total_amount || 'Не указан'} грн${deliveryBlock}
💳 Оплата: ${paymentText}${changeText}
`
  );
}

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

    if (!body.callback_query) {
      return new Response(
        JSON.stringify({ error: "Not a callback query" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const callbackQuery = body.callback_query;
    const callbackData = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const groupMessageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id;

    console.log('=== COURIER ACCEPT WEBHOOK CALLED ===');
    console.log('Callback data:', {
      callbackData,
      chatId,
      chatType: callbackQuery.message.chat.type,
      groupMessageId,
      userId,
      userName: callbackQuery.from.first_name
    });

    if (!callbackData || (!callbackData.startsWith('accept_order_') && !callbackData.startsWith('accept_order:'))) {
      console.log('INFO: Not an accept_order callback, ignoring. Callback data:', callbackData);
      return new Response(
        JSON.stringify({ ok: true, message: "Unknown callback" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const extractedId = callbackData.replace('accept_order_', '').replace('accept_order:', '');
    console.log('Extracted ID:', extractedId, 'groupMessageId:', groupMessageId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let orderExecutor: any = null;
    let oeQueryError: any = null;

    const { data: oeById, error: oeByIdError } = await supabase
      .from('order_executors')
      .select(`
        id, order_id, executor_id, status, branch_id, zone_id, telegram_message_id,
        delivery_payer, distance_price_uah, rounded_distance_km, total_delivery_price_uah,
        executor:executors(id, partner_id, name, telegram_bot_token, telegram_chat_id, distribute_by_branches, allow_external_couriers),
        zone:performer_delivery_zones!zone_id(name, courier_payment)
      `)
      .eq('id', extractedId)
      .maybeSingle();

    if (oeById) {
      orderExecutor = oeById;
      oeQueryError = oeByIdError;
      console.log('Found order_executor by ID:', extractedId);
    } else {
      console.log('Order executor not found by ID, trying by telegram_message_id:', groupMessageId);
      const { data: oeByMsgId, error: oeByMsgIdError } = await supabase
        .from('order_executors')
        .select(`
          id, order_id, executor_id, status, branch_id, zone_id, telegram_message_id,
          delivery_payer, distance_price_uah, rounded_distance_km, total_delivery_price_uah,
          executor:executors(id, partner_id, name, telegram_bot_token, telegram_chat_id, distribute_by_branches, allow_external_couriers),
          zone:performer_delivery_zones!zone_id(name, courier_payment)
        `)
        .eq('telegram_message_id', String(groupMessageId))
        .eq('status', 'searching')
        .maybeSingle();

      if (oeByMsgId) {
        orderExecutor = oeByMsgId;
        oeQueryError = oeByMsgIdError;
        console.log('Found order_executor by telegram_message_id:', groupMessageId);
      } else {
        oeQueryError = oeByIdError || oeByMsgIdError;
      }
    }

    console.log('Order executor query result:', { found: !!orderExecutor, error: oeQueryError, extractedId, orderExecutorData: orderExecutor ? { id: orderExecutor.id, status: orderExecutor.status, executor_id: orderExecutor.executor_id } : null });

    if (orderExecutor) {
      console.log('Found order_executor, processing as executor order');
      const execBotToken = orderExecutor.executor?.telegram_bot_token || '';

      if (orderExecutor.status === 'assigned') {
        await answerCallbackQuery(execBotToken, callbackQuery.id, 'Этот заказ уже принят другим курьером');
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (orderExecutor.status === 'completed' || orderExecutor.status === 'cancelled') {
        await answerCallbackQuery(execBotToken, callbackQuery.id, 'Этот заказ уже завершён или отменён');
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: courier } = await supabase
        .from('couriers')
        .select('id, name, lastname, partner_id')
        .eq('telegram_user_id', userId.toString())
        .eq('partner_id', orderExecutor.executor.partner_id)
        .eq('is_active', true)
        .maybeSingle();

      console.log('Courier search for executor order:', { found: !!courier, allowExternal: orderExecutor.executor?.allow_external_couriers, userId });

      if (!courier && !orderExecutor.executor?.allow_external_couriers) {
        console.error('Courier not found for executor order and external couriers not allowed');
        await answerCallbackQuery(execBotToken, callbackQuery.id, 'Вы не зарегистрированы как курьер');
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
        courierFullName = `${firstName} ${lastName}`.trim() || username || `Courier ${userId}`;
        console.log('Using Telegram data for external courier:', courierFullName);
      }
      const orderExecutorId = orderExecutor.id;
      const { error: updateError } = await supabase
        .from('order_executors')
        .update({ status: 'assigned', courier_id: courierId, courier_name: courierFullName, updated_at: new Date().toISOString() })
        .eq('id', orderExecutorId)
        .eq('status', 'searching');

      if (updateError) {
        await answerCallbackQuery(execBotToken, callbackQuery.id, 'Ошибка при принятии заказа');
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (orderExecutor.telegram_message_id && orderExecutor.executor?.telegram_chat_id) {
        await fetch(`https://api.telegram.org/bot${execBotToken}/deleteMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: orderExecutor.executor.telegram_chat_id, message_id: parseInt(orderExecutor.telegram_message_id) })
        }).catch(err => console.error('Error deleting executor group message:', err));
      }

      await supabase.from('order_executors').update({ status: 'cancelled' })
        .eq('order_id', orderExecutor.order_id).eq('executor_id', orderExecutor.executor_id).eq('status', 'searching').neq('id', orderExecutorId);

      const { data: execOrder } = await supabase.from('orders').select(`*, branch:branches(name, address, phone, latitude, longitude), payment_method:payment_methods(name)`)
        .eq('id', orderExecutor.order_id).maybeSingle();

      if (execOrder) {
        const orderNumber = execOrder.shift_order_number || execOrder.order_number || execOrder.id;
        const { data: orderItems } = await supabase.from('order_items').select('product_name, quantity, modifiers').eq('order_id', execOrder.id);
        const branchName = execOrder.branch?.name || 'Филиал';
        const branchAddress = execOrder.branch?.address || 'Не указан';
        const branchPhone = execOrder.branch?.phone || 'Не указан';
        let branchNav = execOrder.branch?.latitude && execOrder.branch?.longitude ? `\n<a href="https://www.google.com/maps/dir/?api=1&destination=${execOrder.branch.latitude},${execOrder.branch.longitude}">Навигация к филиалу</a>` : '';
        const deliveryAddress = execOrder.delivery_address || execOrder.address_line || 'Не указан';
        let deliveryNav = execOrder.delivery_lat && execOrder.delivery_lng
          ? `\n<a href="https://www.google.com/maps/dir/?api=1&destination=${execOrder.delivery_lat},${execOrder.delivery_lng}">Навигация к клиенту</a>`
          : `\n<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(deliveryAddress)}">Навигация к клиенту</a>`;
        let addressDetails = '';
        if (execOrder.floor) addressDetails += `\nЭтаж: ${execOrder.floor}`;
        if (execOrder.apartment) addressDetails += `\nКвартира: ${execOrder.apartment}`;
        if (execOrder.entrance) addressDetails += `\nПарадная: ${execOrder.entrance}`;
        if (execOrder.intercom) addressDetails += `\nДомофон: ${execOrder.intercom}`;
        let itemsBlock = '';
        if (orderItems && orderItems.length > 0) {
          itemsBlock = '\n\n<b>Содержание заказа:</b>';
          for (const item of orderItems) { itemsBlock += `\n- ${item.product_name} x${item.quantity}`; }
        }
        const zonePayment = orderExecutor.zone?.courier_payment || 0;
        const distancePrice = orderExecutor.distance_price_uah || 0;
        const totalDeliveryPayment = orderExecutor.total_delivery_price_uah || (zonePayment + distancePrice);
        let deliveryPaymentBlock = orderExecutor.zone?.name
          ? `\n\n<b>За доставку: ${totalDeliveryPayment.toFixed(2)} грн</b> (${orderExecutor.delivery_payer === 'client' ? 'Оплачивает клиент' : 'Оплачивает заведение'})`
          : '';
        let commentBlock = execOrder.comment ? `\n\nКомментарий: ${execOrder.comment}` : '';

        const privateMessage = `<b>ВЫ ПРИНЯЛИ ЗАКАЗ #${orderNumber}</b>\n\n<b>ОТКУДА ЗАБРАТЬ:</b>\n${branchName}\n${branchAddress}\nТелефон филиала: ${branchPhone}${branchNav}\n\n<b>КУДА ВЕЗТИ:</b>\n${deliveryAddress}${addressDetails}\nТелефон клиента: ${execOrder.phone || 'Не указан'}${deliveryNav}${itemsBlock}\n\n<b>СУММА ЗАКАЗА: ${execOrder.total_amount || 0} грн</b>\nСпособ оплаты: ${execOrder.payment_method?.name || 'Не указан'}${deliveryPaymentBlock}${commentBlock}`;

        const { data: settings } = await supabase.from('partner_settings').select('courier_bot_token').eq('partner_id', orderExecutor.executor.partner_id).maybeSingle();
        const botTokenToUse = settings?.courier_bot_token || execBotToken;
        if (botTokenToUse) {
          const msgResult = await fetch(`https://api.telegram.org/bot${botTokenToUse}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: userId, text: privateMessage, parse_mode: 'HTML' })
          });
          const msgData = await msgResult.json();
          if (msgData.ok && msgData.result?.message_id) {
            await supabase.from('order_executors').update({ courier_private_message_id: msgData.result.message_id.toString() }).eq('id', orderExecutorId);
          }
        }
      }

      await answerCallbackQuery(execBotToken, callbackQuery.id, 'Заказ принят!');
      console.log('Executor order accepted by courier:', courierId || 'external');
      return new Response(JSON.stringify({ ok: true, message: "Executor order accepted" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Not an order_executor, checking orders table');
    const orderId = extractedId;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        partner_id,
        branch_id,
        courier_id,
        order_number,
        shift_order_number,
        telegram_message_id,
        courier_message_id,
        phone,
        address_line,
        apartment,
        entrance,
        floor,
        intercom,
        office,
        comment,
        order_items_summary,
        distance_km,
        duration_minutes,
        delivery_price_uah,
        total_amount,
        cash_amount,
        payment_status,
        payment_breakdown,
        scheduled_at,
        branch:branches(id, name, address, phone, telegram_chat_id, telegram_bot_token),
        payment_method:payment_methods(id, name, method_type),
        courier:couriers(id, telegram_user_id, name, lastname)
      `)
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error('Order not found:', orderError, 'orderId:', orderId, 'extractedId:', extractedId);
      return new Response(
        JSON.stringify({ error: "Order not found", orderId, extractedId }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (order.courier_id) {
      await answerCallbackQuery(order.branch.telegram_bot_token, callbackQuery.id, "❌ Заказ уже принят другим курьером");
      return new Response(
        JSON.stringify({ ok: true, message: "Order already taken" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: courier, error: courierError } = await supabase
      .from('couriers')
      .select('id, name, lastname, phone, telegram_user_id, telegram_username, vehicle_type')
      .eq('telegram_user_id', String(userId))
      .eq('partner_id', order.partner_id)
      .maybeSingle();

    if (courierError || !courier) {
      console.error('Courier not found:', courierError);
      await answerCallbackQuery(order.branch.telegram_bot_token, callbackQuery.id, "❌ Вы не зарегистрированы как курьер");
      return new Response(
        JSON.stringify({ error: "Courier not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        courier_id: courier.id,
        group_chat_message_id: groupMessageId,
        telegram_message_id: null,
        courier_search_started_at: null
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order:', updateError);
      await answerCallbackQuery(order.branch.telegram_bot_token, callbackQuery.id, "❌ Ошибка при назначении заказа");
      return new Response(
        JSON.stringify({ error: "Failed to update order" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: executorError } = await supabase
      .from('order_executors')
      .insert({
        order_id: orderId,
        executor_id: courier.id,
        courier_id: courier.id,
        branch_id: order.branch_id,
        status: 'accepted'
      });

    if (executorError) {
      console.error('Error creating order executor:', executorError);
    }

    if (order.branch?.telegram_chat_id && order.branch?.telegram_bot_token && groupMessageId) {
      await fetch(`https://api.telegram.org/bot${order.branch.telegram_bot_token}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: order.branch.telegram_chat_id,
          message_id: groupMessageId
        })
      }).catch(err => console.error('Error deleting group message:', err));
    }

    const { data: settings } = await supabase
      .from('partner_settings')
      .select('courier_bot_token')
      .eq('partner_id', order.partner_id)
      .maybeSingle();

    if (!settings?.courier_bot_token) {
      console.error('Courier bot token not found');
      await answerCallbackQuery(order.branch.telegram_bot_token, callbackQuery.id, "✅ Заказ принят");
      return new Response(
        JSON.stringify({ ok: true, message: "Order accepted but courier bot not configured" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: orderItemsData } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    const message = buildCourierPrivateMessage({
      order,
      branch: order.branch,
      distanceKm: order.distance_km,
      durationMinutes: order.duration_minutes,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      orderItems: orderItemsData || undefined,
      deliveryPrice: order.delivery_price_uah,
      paymentBreakdown: order.payment_breakdown
    });

    const courierMessageResponse = await fetch(`https://api.telegram.org/bot${settings.courier_bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: userId,
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚗 Выехал', callback_data: `en_route_${orderId}` }],
            [{ text: '✅ Выполнено', callback_data: `complete_order_${orderId}` }],
            [{ text: '❌ Отменить заказ', callback_data: `cancel_order_${orderId}` }]
          ]
        }
      })
    });

    const courierMessageResult = await courierMessageResponse.json();
    console.log('Courier message result:', courierMessageResult);

    if (courierMessageResult.ok && courierMessageResult.result?.message_id) {
      await supabase
        .from('orders')
        .update({ courier_message_id: String(courierMessageResult.result.message_id) })
        .eq('id', orderId);
    }

    await supabase
      .from('logs')
      .insert({
        partner_id: order.partner_id,
        section: 'orders',
        log_level: 'info',
        message: `Курьер ${courier.name} ${courier.lastname} принял заказ через Telegram`,
        details: {
          orderId,
          courierId: courier.id,
          courierName: `${courier.name} ${courier.lastname}`.trim(),
          orderNumber: order.shift_order_number || order.order_number,
          userId,
          groupMessageId
        }
      });

    await answerCallbackQuery(order.branch.telegram_bot_token, callbackQuery.id, "✅ Заказ принят");

    return new Response(
      JSON.stringify({ ok: true, message: "Order accepted successfully" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Error in courier-accept-webhook:', error);
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

async function answerCallbackQuery(botToken: string, callbackQueryId: string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
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