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
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string, replyMarkup?: any): Promise<{ success: boolean; messageId?: number }> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body: any = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Failed to send message:', await response.text());
      return { success: false };
    }

    const result = await response.json();
    return { success: true, messageId: result.result?.message_id };
  } catch (err) {
    console.error('Exception sending message:', err);
    return { success: false };
  }
}

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

    if (!response.ok) {
      console.error('Failed to delete message:', await response.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception deleting message:', err);
    return false;
  }
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string) {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
      }),
    });
  } catch (err) {
    console.error('Exception answering callback query:', err);
  }
}

async function sendPollToCouries(partnerId: string, courierIds: string[] | null): Promise<{ sent_count: number }> {
  const { data: settings, error: settingsError } = await supabase
    .from('partner_settings')
    .select(`
      external_courier_bot_token,
      external_courier_polling_message,
      external_courier_polling_agree_button,
      external_courier_polling_decline_button,
      external_courier_final_button_url,
      external_courier_polling_followup_questions,
      external_courier_polling_selected_couriers
    `)
    .eq('partner_id', partnerId)
    .maybeSingle();

  if (settingsError || !settings || !settings.external_courier_bot_token) {
    console.error('Settings not found or bot token missing:', settingsError);
    throw new Error('Bot token not configured');
  }

  let targetCourierIds = courierIds;
  if (!targetCourierIds && settings.external_courier_polling_selected_couriers && settings.external_courier_polling_selected_couriers.length > 0) {
    targetCourierIds = settings.external_courier_polling_selected_couriers;
  }

  let couriersQuery = supabase
    .from('couriers')
    .select('id, telegram_user_id, name, lastname')
    .eq('partner_id', partnerId)
    .eq('is_own', false)
    .eq('is_active', true)
    .not('telegram_user_id', 'is', null);

  if (targetCourierIds && targetCourierIds.length > 0) {
    couriersQuery = couriersQuery.in('id', targetCourierIds);
  }

  const { data: couriers, error: couriersError } = await couriersQuery;

  if (couriersError) {
    console.error('Error fetching couriers:', couriersError);
    throw new Error('Failed to fetch couriers');
  }

  if (!couriers || couriers.length === 0) {
    return { sent_count: 0 };
  }

  const today = new Date().toISOString().split('T')[0];
  let sentCount = 0;

  await supabase
    .from('external_courier_polling_responses')
    .update({ is_active: false })
    .eq('partner_id', partnerId)
    .eq('response_date', today)
    .eq('is_active', true);

  for (const courier of couriers) {
    if (!courier.telegram_user_id) continue;

    const telegramUserId = parseInt(courier.telegram_user_id);

    const { data: previousPoll } = await supabase
      .from('external_courier_polling_responses')
      .select('message_id, success_message_id')
      .eq('partner_id', partnerId)
      .eq('courier_id', courier.id)
      .not('message_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousPoll?.message_id) {
      await deleteMessage(settings.external_courier_bot_token, telegramUserId, previousPoll.message_id);
    }

    if (previousPoll?.success_message_id) {
      await deleteMessage(settings.external_courier_bot_token, telegramUserId, previousPoll.success_message_id);
    }

    const message = settings.external_courier_polling_message || 'Вы сегодня готовы принимать заказы?';
    const agreeButton = settings.external_courier_polling_agree_button || 'Да, готов';
    const declineButton = settings.external_courier_polling_decline_button || 'Нет, не сегодня';

    const result = await sendTelegramMessage(
      settings.external_courier_bot_token,
      telegramUserId,
      message,
      {
        inline_keyboard: [
          [
            { text: agreeButton, callback_data: `poll_agree_${courier.id}` },
            { text: declineButton, callback_data: `poll_decline_${courier.id}` }
          ]
        ]
      }
    );

    if (result.success && result.messageId) {
      await supabase
        .from('external_courier_polling_responses')
        .insert({
          partner_id: partnerId,
          courier_id: courier.id,
          response_date: today,
          is_active: false,
          is_scheduled: false,
          message_id: result.messageId,
          created_at: new Date().toISOString(),
        });

      sentCount++;
    }
  }

  return { sent_count: sentCount };
}

async function handlePollCallback(botToken: string, partnerId: string, courierId: string, isAgree: boolean, callbackQuery: TelegramUpdate['callback_query']): Promise<void> {
  if (!callbackQuery || !callbackQuery.message) return;

  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const today = new Date().toISOString().split('T')[0];

  await deleteMessage(botToken, chatId, messageId);

  if (!isAgree) {
    await supabase
      .from('external_courier_polling_responses')
      .update({
        is_active: false,
        responded_at: new Date().toISOString(),
      })
      .eq('partner_id', partnerId)
      .eq('courier_id', courierId)
      .eq('message_id', messageId);

    return;
  }

  const { data: settings } = await supabase
    .from('partner_settings')
    .select(`
      external_courier_polling_success_message,
      external_courier_polling_join_button,
      external_courier_final_button_url,
      external_courier_polling_followup_questions
    `)
    .eq('partner_id', partnerId)
    .maybeSingle();

  await supabase
    .from('external_courier_polling_responses')
    .update({
      is_active: true,
      responded_at: new Date().toISOString(),
    })
    .eq('partner_id', partnerId)
    .eq('courier_id', courierId)
    .eq('message_id', messageId);

  const followupQuestions = settings?.external_courier_polling_followup_questions || [];

  if (followupQuestions.length > 0) {
    const firstQuestion = followupQuestions[0];
    const keyboard = firstQuestion.options.map((option: string) => [{
      text: option,
      callback_data: `followup_answer_${courierId}_0_${option}`
    }]);

    await sendTelegramMessage(
      botToken,
      chatId,
      firstQuestion.question,
      { inline_keyboard: keyboard }
    );
  } else {
    const successMessage = settings?.external_courier_polling_success_message || 'Отлично! Вы добавлены в список активных курьеров на сегодня.';
    const joinButtonText = settings?.external_courier_polling_join_button || 'Перейти в группу заказов';
    const joinUrl = settings?.external_courier_final_button_url;

    let replyMarkup;
    if (joinUrl) {
      replyMarkup = {
        inline_keyboard: [[
          { text: joinButtonText, url: joinUrl }
        ]]
      };
    }

    const result = await sendTelegramMessage(botToken, chatId, successMessage, replyMarkup);

    if (result.success && result.messageId) {
      await supabase
        .from('external_courier_polling_responses')
        .update({ success_message_id: result.messageId })
        .eq('partner_id', partnerId)
        .eq('courier_id', courierId)
        .eq('message_id', messageId);
    }
  }
}

async function handleFollowupAnswer(botToken: string, partnerId: string, courierId: string, questionIndex: number, answer: string, callbackQuery: TelegramUpdate['callback_query']): Promise<void> {
  if (!callbackQuery || !callbackQuery.message) return;

  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const today = new Date().toISOString().split('T')[0];

  await deleteMessage(botToken, chatId, messageId);

  const { data: response } = await supabase
    .from('external_courier_polling_responses')
    .select('id, followup_answers')
    .eq('partner_id', partnerId)
    .eq('courier_id', courierId)
    .eq('response_date', today)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!response) return;

  const currentAnswers = response.followup_answers || {};
  currentAnswers[questionIndex.toString()] = answer;

  await supabase
    .from('external_courier_polling_responses')
    .update({ followup_answers: currentAnswers })
    .eq('id', response.id);

  const { data: settings } = await supabase
    .from('partner_settings')
    .select(`
      external_courier_polling_success_message,
      external_courier_polling_join_button,
      external_courier_final_button_url,
      external_courier_polling_followup_questions
    `)
    .eq('partner_id', partnerId)
    .maybeSingle();

  const followupQuestions = settings?.external_courier_polling_followup_questions || [];
  const nextQuestionIndex = questionIndex + 1;

  if (nextQuestionIndex < followupQuestions.length) {
    const nextQuestion = followupQuestions[nextQuestionIndex];
    const keyboard = nextQuestion.options.map((option: string) => [{
      text: option,
      callback_data: `followup_answer_${courierId}_${nextQuestionIndex}_${option}`
    }]);

    await sendTelegramMessage(
      botToken,
      chatId,
      nextQuestion.question,
      { inline_keyboard: keyboard }
    );
  } else {
    const successMessage = settings?.external_courier_polling_success_message || 'Отлично! Вы добавлены в список активных курьеров на сегодня.';
    const joinButtonText = settings?.external_courier_polling_join_button || 'Перейти в группу заказов';
    const joinUrl = settings?.external_courier_final_button_url;

    let replyMarkup;
    if (joinUrl) {
      replyMarkup = {
        inline_keyboard: [[
          { text: joinButtonText, url: joinUrl }
        ]]
      };
    }

    const result = await sendTelegramMessage(botToken, chatId, successMessage, replyMarkup);

    if (result.success && result.messageId) {
      await supabase
        .from('external_courier_polling_responses')
        .update({ success_message_id: result.messageId })
        .eq('id', response.id);
    }
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
    const url = new URL(req.url);
    const botToken = url.searchParams.get('token');

    if (botToken) {
      const update: TelegramUpdate = await req.json();
      console.log('Received Telegram callback:', JSON.stringify(update));

      if (update.callback_query) {
        const callbackData = update.callback_query.data || '';

        if (callbackData.startsWith('poll_agree_') || callbackData.startsWith('poll_decline_')) {
          await answerCallbackQuery(botToken, update.callback_query.id);

          const isAgree = callbackData.startsWith('poll_agree_');
          const courierId = callbackData.replace('poll_agree_', '').replace('poll_decline_', '');

          const { data: courier } = await supabase
            .from('couriers')
            .select('partner_id')
            .eq('id', courierId)
            .maybeSingle();

          if (courier) {
            await handlePollCallback(botToken, courier.partner_id, courierId, isAgree, update.callback_query);
          }
        } else if (callbackData.startsWith('followup_answer_')) {
          await answerCallbackQuery(botToken, update.callback_query.id);

          const parts = callbackData.replace('followup_answer_', '').split('_');
          if (parts.length >= 3) {
            const courierId = parts[0];
            const questionIndex = parseInt(parts[1]);
            const answer = parts.slice(2).join('_');

            const { data: courier } = await supabase
              .from('couriers')
              .select('partner_id')
              .eq('id', courierId)
              .maybeSingle();

            if (courier) {
              await handleFollowupAnswer(botToken, courier.partner_id, courierId, questionIndex, answer, update.callback_query);
            }
          }
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { partner_id, courier_ids, action } = body;

    if (!partner_id) {
      return new Response(
        JSON.stringify({ error: 'partner_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send_poll') {
      const result = await sendPollToCouries(partner_id, courier_ids);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});