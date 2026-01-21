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

function isDevelopmentEnvironment(): boolean {
  const url = SUPABASE_URL.toLowerCase();
  return url.includes('dev') || url.includes('localhost') || url.includes('127.0.0.1');
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    contact?: {
      phone_number: string;
      first_name: string;
      last_name?: string;
      user_id?: number;
    };
  };
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

interface UserState {
  step: 'awaiting_lastname' | 'awaiting_phone' | 'awaiting_branch' | 'awaiting_vehicle';
  name?: string;
  lastname?: string;
  phone?: string;
  branch_id?: string;
  partner_id?: string;
}

async function getUserState(telegramUserId: number): Promise<UserState | null> {
  try {
    const { data, error } = await supabase
      .from('courier_registration_states')
      .select('*')
      .eq('telegram_user_id', telegramUserId.toString())
      .maybeSingle();

    if (error) {
      console.error('Error getting user state:', error);
      return null;
    }

    if (!data) return null;

    return {
      step: data.step as any,
      name: data.name,
      lastname: data.lastname,
      phone: data.phone,
      branch_id: data.branch_id,
      partner_id: data.partner_id,
    };
  } catch (err) {
    console.error('Exception getting user state:', err);
    return null;
  }
}

async function setUserState(telegramUserId: number, state: UserState): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('courier_registration_states')
      .upsert({
        telegram_user_id: telegramUserId.toString(),
        partner_id: state.partner_id,
        step: state.step,
        name: state.name,
        lastname: state.lastname,
        phone: state.phone,
        branch_id: state.branch_id,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error setting user state:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception setting user state:', err);
    return false;
  }
}

async function deleteUserState(telegramUserId: number): Promise<void> {
  try {
    await supabase
      .from('courier_registration_states')
      .delete()
      .eq('telegram_user_id', telegramUserId.toString());
  } catch (err) {
    console.error('Exception deleting user state:', err);
  }
}

async function sendMessage(botToken: string, chatId: number, text: string, replyMarkup?: any): Promise<void> {
  try {
    const body: any = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
    };

    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error sending message:', errorText);
    }
  } catch (err) {
    console.error('Exception sending message:', err);
  }
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  } catch (err) {
    console.error('Exception answering callback query:', err);
  }
}

async function getBranches(partnerId: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name')
      .eq('partner_id', partnerId)
      .order('name');

    if (error) {
      console.error('Error getting branches:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception getting branches:', err);
    return [];
  }
}

async function checkExistingCourier(partnerId: string, telegramUserId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('couriers')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle();

    if (error) {
      console.error('Error checking existing courier:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Exception checking existing courier:', err);
    return null;
  }
}

async function createCourier(
  partnerId: string,
  telegramUserId: string,
  name: string,
  lastname: string,
  phone: string,
  branchId: string,
  vehicleType: string,
  username: string | null
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('couriers')
      .insert({
        partner_id: partnerId,
        full_name: `${name} ${lastname}`,
        phone: phone,
        branch_id: branchId,
        vehicle_type: vehicleType,
        telegram_user_id: telegramUserId,
        telegram_username: username,
        is_own: true,
      });

    if (error) {
      console.error('Error creating courier:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Exception creating courier:', err);
    return false;
  }
}

async function resolvePartnerId(botToken: string): Promise<string | null> {
  const isDev = isDevelopmentEnvironment();

  console.log('🔍 Environment:', isDev ? 'DEV' : 'PROD');
  console.log('🔍 Attempting to resolve partner_id for bot token');

  try {
    const { data: partner, error: partnerError } = await supabase
      .from('partner_settings')
      .select('partner_id')
      .eq('courier_bot_token', botToken)
      .eq('courier_bot_enabled', true)
      .maybeSingle();

    if (!partnerError && partner?.partner_id) {
      console.log('✅ Partner resolved via partner_settings:', partner.partner_id);
      return partner.partner_id;
    }

    if (partnerError) {
      console.error('⚠️ Error querying partner_settings:', partnerError);
    } else {
      console.log('⚠️ No partner found in partner_settings with this courier_bot_token (or bot disabled)');
    }
  } catch (err) {
    console.error('❌ Exception querying partner_settings:', err);
  }

  if (isDev) {
    console.log('🔄 DEV mode: attempting fallback to public.partners');
    try {
      const { data: partners, error: partnersError } = await supabase
        .from('partners')
        .select('id, name')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (!partnersError && partners?.id) {
        console.log('✅ DEV fallback: partner resolved from public.partners:', {
          partner_id: partners.id,
          partner_name: partners.name
        });
        return partners.id;
      }

      if (partnersError) {
        console.error('❌ Error querying public.partners:', partnersError);
      } else {
        console.error('❌ No active partners found in public.partners');
      }
    } catch (err) {
      console.error('❌ Exception during DEV fallback:', err);
    }
  }

  console.error('❌ CRITICAL: partner_id could not be resolved', {
    isDev,
    botTokenProvided: !!botToken,
    environment: SUPABASE_URL
  });

  return null;
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

    const updateType = update.message ? 'message' : update.callback_query ? 'callback_query' : 'unknown';
    const chatType = update.message?.chat?.type || update.callback_query?.message?.chat?.type || 'unknown';
    const contentData = update.message?.text || update.callback_query?.data || 'no content';

    console.log('📨 Received Telegram update:', {
      update_type: updateType,
      chat_type: chatType,
      content: contentData,
      update_id: update.update_id
    });

    const url = new URL(req.url);
    const botToken = url.searchParams.get('token');

    if (!botToken) {
      console.error('❌ Bot token not provided in URL');
      return new Response(JSON.stringify({ ok: false, error: 'Bot token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const partnerId = await resolvePartnerId(botToken);

    if (!partnerId) {
      console.error('❌ Cannot proceed: partner_id not resolved');
      return new Response(JSON.stringify({ ok: false, error: 'Partner not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Using partner_id:', partnerId);

    if (update.message) {
      const message = update.message;
      const userId = message.from.id;
      const chatId = message.chat.id;
      const text = message.text;
      const username = message.from.username || null;

      console.log('💬 Message from user:', userId, 'text:', text);

      if (text === '/start') {
        console.log('🚀 Handling /start command');

        const existingCourier = await checkExistingCourier(partnerId, userId.toString());

        if (existingCourier) {
          await sendMessage(
            botToken,
            chatId,
            `✅ Вы уже зарегистрированы как курьер!\n\n` +
            `ФИО: ${existingCourier.full_name}\n` +
            `Телефон: ${existingCourier.phone || 'не указан'}\n` +
            `Транспорт: ${existingCourier.vehicle_type || 'не указан'}`
          );
          await deleteUserState(userId);
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await setUserState(userId, {
          step: 'awaiting_lastname',
          name: message.from.first_name,
          partner_id: partnerId,
        });

        await sendMessage(
          botToken,
          chatId,
          `Привет, ${message.from.first_name}! 👋\n\n` +
          `Начинаем регистрацию курьера.\n\n` +
          `Введите вашу фамилию:`
        );

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const state = await getUserState(userId);

      if (!state) {
        await sendMessage(
          botToken,
          chatId,
          'Для начала регистрации отправьте команду /start'
        );
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (state.step === 'awaiting_lastname' && text) {
        await setUserState(userId, {
          ...state,
          step: 'awaiting_phone',
          lastname: text.trim(),
        });

        await sendMessage(
          botToken,
          chatId,
          `Отлично! Теперь отправьте ваш номер телефона.\n\n` +
          `Вы можете отправить контакт через кнопку ниже или ввести вручную в формате: +380123456789`,
          {
            keyboard: [[{ text: 'Отправить контакт', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        );

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (state.step === 'awaiting_phone') {
        let phone = '';

        if (message.contact) {
          phone = message.contact.phone_number;
        } else if (text) {
          phone = text.trim();
        }

        if (!phone) {
          await sendMessage(
            botToken,
            chatId,
            'Пожалуйста, отправьте номер телефона'
          );
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const branches = await getBranches(partnerId);

        if (branches.length === 0) {
          await sendMessage(
            botToken,
            chatId,
            'Извините, не найдено ни одного филиала. Обратитесь к администратору.'
          );
          await deleteUserState(userId);
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await setUserState(userId, {
          ...state,
          step: 'awaiting_branch',
          phone: phone,
        });

        const keyboard = branches.map(b => [{ text: b.name, callback_data: `branch_${b.id}` }]);

        await sendMessage(
          botToken,
          chatId,
          'Выберите филиал, к которому вы прикреплены:',
          { inline_keyboard: keyboard }
        );

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await sendMessage(
        botToken,
        chatId,
        'Неизвестная команда. Используйте /start для регистрации.'
      );
    }

    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const userId = callbackQuery.from.id;
      const chatId = callbackQuery.message?.chat.id;
      const data = callbackQuery.data;
      const username = callbackQuery.from.username || null;

      if (!chatId) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('🔘 Callback query from user:', userId, 'data:', data);

      await answerCallbackQuery(botToken, callbackQuery.id);

      const state = await getUserState(userId);

      if (!state) {
        await sendMessage(botToken, chatId, 'Сессия истекла. Начните заново с /start');
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (data?.startsWith('branch_')) {
        const branchId = data.replace('branch_', '');

        await setUserState(userId, {
          ...state,
          step: 'awaiting_vehicle',
          branch_id: branchId,
        });

        const keyboard = [
          [{ text: '🚗 Легковой автомобиль', callback_data: 'vehicle_car' }],
          [{ text: '🛵 Мотоцикл/Скутер', callback_data: 'vehicle_bike' }],
          [{ text: '🚶 Пешком', callback_data: 'vehicle_walking' }],
          [{ text: '🚲 Велосипед', callback_data: 'vehicle_bicycle' }],
        ];

        await sendMessage(
          botToken,
          chatId,
          'Выберите тип транспорта:',
          { inline_keyboard: keyboard }
        );

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (data?.startsWith('vehicle_')) {
        const vehicleType = data.replace('vehicle_', '');

        const created = await createCourier(
          partnerId,
          userId.toString(),
          state.name!,
          state.lastname!,
          state.phone!,
          state.branch_id!,
          vehicleType,
          username
        );

        if (created) {
          await sendMessage(
            botToken,
            chatId,
            `✅ Регистрация завершена!\n\n` +
            `ФИО: ${state.name} ${state.lastname}\n` +
            `Телефон: ${state.phone}\n` +
            `Транспорт: ${vehicleType}\n\n` +
            `Вы успешно зарегистрированы как курьер!`
          );
        } else {
          await sendMessage(
            botToken,
            chatId,
            '❌ Ошибка при регистрации. Пожалуйста, попробуйте позже или обратитесь к администратору.'
          );
        }

        await deleteUserState(userId);

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error processing request:', error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
