import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { buildCourierTelegramMessage } from './_shared/order-message-builder.ts';

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
    const messageId = callbackQuery.message.message_id;

    if (!callbackData || !callbackData.startsWith('cancel_order_')) {
      return new Response(
        JSON.stringify({ ok: true, message: "Unknown callback" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const orderId = callbackData.replace('cancel_order_', '');
    console.log('Extracted orderId:', orderId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
        group_chat_message_id,
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
        courier:couriers(telegram_user_id, name, lastname)
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

    console.log('Order payment_breakdown:', JSON.stringify(order.payment_breakdown));
    console.log('Order payment_method:', JSON.stringify(order.payment_method));
    console.log('Order total_amount:', order.total_amount);
    console.log('Order cash_amount:', order.cash_amount);

    const { data: settings } = await supabase
      .from('partner_settings')
      .select('courier_bot_token')
      .eq('partner_id', order.partner_id)
      .maybeSingle();

    if (!settings?.courier_bot_token) {
      console.error('Bot token not found for partner:', order.partner_id);
      return new Response(
        JSON.stringify({ error: "Bot token not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const botToken = settings.courier_bot_token;

    if (order.courier?.telegram_user_id !== chatId.toString()) {
      await answerCallbackQuery(botToken, callbackQuery.id, "Это не ваш заказ");
      return new Response(
        JSON.stringify({ ok: true, message: "Not the assigned courier" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const courierName = order.courier?.name || 'Unknown';
    const courierLastname = order.courier?.lastname || '';

    // Stop and reset executor timers
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

    const updateData: any = {
      status: 'in_progress',
      courier_id: null,
      courier_message_id: null,
      assignment_status: null,
      telegram_message_id: null,
      courier_search_started_at: null
    };

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order:', updateError);
      await answerCallbackQuery(botToken, callbackQuery.id, "Ошибка при отмене заказа");

      await supabase
        .from('logs')
        .insert({
          partner_id: order.partner_id,
          section: 'telegram',
          log_level: 'error',
          message: 'Ошибка при отмене заказа курьером через Telegram',
          details: {
            orderId,
            courierId: order.courier_id,
            courierName: `${courierName} ${courierLastname}`.trim(),
            error: updateError.message
          }
        });

      return new Response(
        JSON.stringify({ error: "Failed to update order" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const deleteResponse = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    });

    const deleteResult = await deleteResponse.json();
    console.log('Delete courier message result:', deleteResult);

    if (order.branch?.telegram_chat_id && order.branch?.telegram_bot_token && order.group_chat_message_id) {
      const deleteGroupMessageResponse = await fetch(`https://api.telegram.org/bot${order.branch.telegram_bot_token}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: order.branch.telegram_chat_id,
          message_id: order.group_chat_message_id
        })
      });
      const deleteGroupResult = await deleteGroupMessageResponse.json();
      console.log('Delete old group message result:', deleteGroupResult);
    }

    if (order.branch?.telegram_chat_id && order.branch?.telegram_bot_token) {
      const orderForMessage = {
        ...order,
        courier: null,
        payment_breakdown: order.payment_breakdown
      };

      console.log('Building message with payment_breakdown:', JSON.stringify(orderForMessage.payment_breakdown));

      await supabase
        .from('logs')
        .insert({
          partner_id: order.partner_id,
          section: 'telegram',
          log_level: 'info',
          message: 'Построение сообщения для группы после отмены курьером',
          details: {
            orderId: order.id,
            orderNumber: order.shift_order_number || order.order_number,
            payment_breakdown: order.payment_breakdown,
            paymentMethod: order.payment_method,
            total_amount: order.total_amount,
            cash_amount: order.cash_amount
          }
        });

      const message = buildCourierTelegramMessage({
        order: orderForMessage,
        branch: order.branch,
        distanceKm: order.distance_km,
        durationMinutes: order.duration_minutes,
        paymentMethod: null,
        paymentStatus: order.payment_status,
        deliveryPrice: order.delivery_price_uah
      });

      console.log('Generated message for group:', message);

      await supabase
        .from('logs')
        .insert({
          partner_id: order.partner_id,
          section: 'telegram',
          log_level: 'info',
          message: 'Сообщение для группы построено',
          details: {
            orderId: order.id,
            orderNumber: order.shift_order_number || order.order_number,
            messageLength: message.length,
            messagePreview: message.substring(0, 500)
          }
        });

      const groupMessageResponse = await fetch(`https://api.telegram.org/bot${order.branch.telegram_bot_token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: order.branch.telegram_chat_id,
          text: message,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Принять заказ', callback_data: `accept_order_${orderId}` }]
            ]
          }
        })
      });

      const groupMessageResult = await groupMessageResponse.json();
      console.log('Group message result:', groupMessageResult);

      if (groupMessageResult.ok && groupMessageResult.result?.message_id) {
        await supabase
          .from('orders')
          .update({
            telegram_message_id: String(groupMessageResult.result.message_id),
            courier_search_started_at: new Date().toISOString()
          })
          .eq('id', orderId);
      }
    }

    await supabase
      .from('logs')
      .insert({
        partner_id: order.partner_id,
        section: 'orders',
        log_level: 'info',
        message: `Курьер ${courierName} ${courierLastname} отменил заказ через Telegram`,
        details: {
          orderId,
          courierId: order.courier_id,
          courierName: `${courierName} ${courierLastname}`.trim(),
          orderNumber: order.shift_order_number || order.order_number,
          chatId,
          messageId
        }
      });

    await answerCallbackQuery(botToken, callbackQuery.id, "Заказ отменен. Курьер снят с заказа.");

    return new Response(
      JSON.stringify({ ok: true, message: "Order cancelled successfully" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Error in courier-cancel-webhook:', error);
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