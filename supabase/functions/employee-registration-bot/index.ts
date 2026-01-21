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
    photo?: Array<{
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      file_size?: number;
    }>;
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
  step: 'awaiting_lastname' | 'awaiting_position' | 'awaiting_branch' | 'awaiting_phone' | 'awaiting_email' | 'awaiting_card' | 'awaiting_photo' | 'awaiting_cabinet_change_confirm' | 'awaiting_cabinet_login' | 'awaiting_cabinet_password';
  firstname?: string;
  lastname?: string;
  position_id?: string;
  branch_id?: string;
  phone?: string;
  email?: string;
  telegram_username?: string;
  card_number?: string;
  hire_date?: string;
  partner_id?: string;
  is_editing?: boolean;
  employee_id?: string;
  last_bot_message_id?: number;
  photo_file_id?: string;
  photo_url?: string;
  cabinet_login?: string;
  cabinet_password?: string;
}

const transliterationMap: { [key: string]: string } = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
  'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i',
  'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
  'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
  'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch',
  'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '',
  'э': 'e', 'ю': 'yu', 'я': 'ya',
  'є': 'ye', 'і': 'i', 'ї': 'yi', 'ґ': 'g',
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D',
  'Е': 'E', 'Ё': 'E', 'Ж': 'Zh', 'З': 'Z', 'И': 'I',
  'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N',
  'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T',
  'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch',
  'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '',
  'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
  'Є': 'Ye', 'І': 'I', 'Ї': 'Yi', 'Ґ': 'G',
};

function transliterate(text: string): string {
  return text
    .split('')
    .map(char => transliterationMap[char] || char)
    .join('');
}

function generateCabinetSlug(firstname: string, lastname: string): string {
  const transliteratedFirst = transliterate(firstname.trim());
  const transliteratedLast = transliterate(lastname.trim());
  return `${transliteratedFirst}-${transliteratedLast}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateDefaultLogin(firstname: string, lastname: string): string {
  const transliteratedFirst = transliterate(firstname.trim());
  const transliteratedLast = transliterate(lastname.trim());
  return `${transliteratedFirst.toLowerCase()}.${transliteratedLast.toLowerCase()}`
    .replace(/[^a-z0-9.]/g, '')
    .substring(0, 32);
}

function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function getUserState(telegramUserId: number): Promise<UserState | null> {
  try {
    const { data, error } = await supabase
      .from('employee_registration_states')
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
      firstname: data.firstname,
      lastname: data.lastname,
      position_id: data.position_id,
      branch_id: data.branch_id,
      phone: data.phone,
      email: data.email,
      telegram_username: data.telegram_username,
      card_number: data.card_number,
      hire_date: data.hire_date,
      partner_id: data.partner_id,
      is_editing: data.is_editing || false,
      employee_id: data.employee_id || undefined,
      last_bot_message_id: data.last_bot_message_id ? parseInt(data.last_bot_message_id) : undefined,
      photo_file_id: data.photo_file_id || undefined,
      photo_url: data.photo_url || undefined,
      cabinet_login: data.cabinet_login || undefined,
      cabinet_password: data.cabinet_password || undefined,
    };
  } catch (err) {
    console.error('Exception getting user state:', err);
    return null;
  }
}

async function setUserState(telegramUserId: number, state: UserState): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('employee_registration_states')
      .upsert({
        telegram_user_id: telegramUserId.toString(),
        partner_id: state.partner_id,
        step: state.step,
        firstname: state.firstname || null,
        lastname: state.lastname || null,
        position_id: state.position_id || null,
        branch_id: state.branch_id || null,
        phone: state.phone || null,
        email: state.email || null,
        telegram_username: state.telegram_username || null,
        card_number: state.card_number || null,
        hire_date: state.hire_date || null,
        is_editing: state.is_editing || false,
        employee_id: state.employee_id || null,
        last_bot_message_id: state.last_bot_message_id?.toString() || null,
        photo_file_id: state.photo_file_id || null,
        photo_url: state.photo_url || null,
        cabinet_login: state.cabinet_login || null,
        cabinet_password: state.cabinet_password || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'telegram_user_id'
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
      .from('employee_registration_states')
      .delete()
      .eq('telegram_user_id', telegramUserId.toString());
  } catch (err) {
    console.error('Exception deleting user state:', err);
  }
}

async function deleteTelegramMessage(botToken: string, chatId: number, messageId: number): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/deleteMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    });
  } catch (err) {
    console.error('Error deleting message:', err);
  }
}

async function deleteMessageDelayed(botToken: string, chatId: number, messageId: number, delayMs: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, delayMs));
  await deleteTelegramMessage(botToken, chatId, messageId);
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

    const result = await response.json();

    if (result.ok) {
      return { success: true, messageId: result.result?.message_id };
    } else {
      console.error('Telegram API error:', result);
      return { success: false };
    }
  } catch (err) {
    console.error('Error sending message:', err);
    return { success: false };
  }
}

async function sendAndTrackMessage(
  botToken: string,
  chatId: number,
  telegramUserId: number,
  text: string,
  state: UserState | null,
  replyMarkup?: any,
  userMessageId?: number,
  deleteUserMessage: boolean = true
): Promise<{ success: boolean; messageId?: number }> {
  if (state?.last_bot_message_id) {
    await deleteTelegramMessage(botToken, chatId, state.last_bot_message_id);
  }

  if (userMessageId && deleteUserMessage) {
    await deleteTelegramMessage(botToken, chatId, userMessageId);
  }

  const result = await sendTelegramMessage(botToken, chatId, text, replyMarkup);

  if (result.success && result.messageId && state) {
    state.last_bot_message_id = result.messageId;
  }

  return result;
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || '',
    }),
  });
}

async function getPartnerSettings(partnerId: string) {
  const { data, error } = await supabase
    .from('partner_settings')
    .select('employee_bot_token, employee_bot_enabled, employee_bot_allow_registration, employee_cabinet_url, app_url')
    .eq('partner_id', partnerId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

async function getPositions(partnerId: string) {
  const { data, error } = await supabase
    .from('positions')
    .select('id, name')
    .eq('partner_id', partnerId)
    .eq('is_visible', true)
    .order('name');

  if (error) {
    console.error('Error fetching positions:', error);
    return [];
  }

  return data || [];
}

async function getBranches(partnerId: string) {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name')
    .eq('partner_id', partnerId)
    .order('name');

  if (error) {
    console.error('Error fetching branches:', error);
    return [];
  }

  return data || [];
}

async function getExistingEmployee(partnerId: string, telegramUserId: string) {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('partner_id', partnerId)
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching employee:', error);
    return null;
  }

  return data;
}

async function downloadAndUploadPhoto(botToken: string, fileId: string, partnerId: string, employeeId: string): Promise<string | null> {
  try {
    console.log('[Photo Upload] Starting download for fileId:', fileId);
    const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
    const fileResponse = await fetch(getFileUrl);
    const fileData = await fileResponse.json();

    if (!fileData.ok || !fileData.result?.file_path) {
      console.error('[Photo Upload] Failed to get file path:', fileData);
      return null;
    }

    const filePath = fileData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    console.log('[Photo Upload] Downloading from:', downloadUrl);

    const photoResponse = await fetch(downloadUrl);
    if (!photoResponse.ok) {
      console.error('[Photo Upload] Failed to download photo, status:', photoResponse.status);
      return null;
    }

    const photoBlob = await photoResponse.blob();
    const fileExt = filePath.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${employeeId}-${Date.now()}.${fileExt}`;
    const storagePath = `${partnerId}/${fileName}`;

    const mimeTypeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    const contentType = mimeTypeMap[fileExt] || 'image/jpeg';
    console.log('[Photo Upload] Using MIME type:', contentType, 'for extension:', fileExt);

    const arrayBuffer = await photoBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    console.log('[Photo Upload] Uploading to storage path:', storagePath);
    const { error: uploadError } = await supabase.storage
      .from('employee-photos')
      .upload(storagePath, uint8Array, {
        contentType: contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[Photo Upload] Failed to upload:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('employee-photos')
      .getPublicUrl(storagePath);

    console.log('[Photo Upload] Upload successful, URL:', publicUrl);
    return publicUrl;
  } catch (err) {
    console.error('[Photo Upload] Exception:', err);
    return null;
  }
}

async function generateUniqueCabinetSlug(partnerId: string, firstname: string, lastname: string): Promise<string> {
  let baseSlug = generateCabinetSlug(firstname, lastname);
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const { data } = await supabase
      .from('employees')
      .select('id')
      .eq('cabinet_slug', slug)
      .maybeSingle();

    if (!data) break;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  return slug;
}

async function generateUniqueLogin(partnerId: string, firstname: string, lastname: string): Promise<string> {
  let baseLogin = generateDefaultLogin(firstname, lastname);
  let login = baseLogin;
  let suffix = 2;

  while (true) {
    const { data } = await supabase
      .from('employees')
      .select('id')
      .eq('partner_id', partnerId)
      .eq('cabinet_login', login)
      .maybeSingle();

    if (!data) break;
    login = `${baseLogin}${suffix}`;
    suffix++;
  }

  return login;
}

async function saveEmployee(state: UserState, telegramUserId: string) {
  const employeeData: any = {
    partner_id: state.partner_id,
    first_name: state.firstname,
    last_name: state.lastname,
    position_id: state.position_id,
    branch_id: state.branch_id,
    phone: state.phone,
    email: state.email,
    telegram_username: state.telegram_username,
    telegram_user_id: telegramUserId,
    bank_card_number: state.card_number,
    hire_date: state.hire_date,
    current_status: 'working',
    is_active: true,
  };

  if (state.photo_url) {
    employeeData.photo_url = state.photo_url;
  }
  if (state.photo_file_id) {
    employeeData.photo_file_id = state.photo_file_id;
  }
  if (state.cabinet_login) {
    employeeData.cabinet_login = state.cabinet_login;
  }
  if (state.cabinet_password) {
    employeeData.cabinet_password = state.cabinet_password;
  }

  if (state.is_editing && state.employee_id) {
    const { data: existingEmployee } = await supabase
      .from('employees')
      .select('cabinet_slug')
      .eq('id', state.employee_id)
      .single();

    if (!existingEmployee?.cabinet_slug) {
      const slug = await generateUniqueCabinetSlug(state.partner_id!, state.firstname!, state.lastname!);
      employeeData.cabinet_slug = slug;
    }

    const { error } = await supabase
      .from('employees')
      .update(employeeData)
      .eq('id', state.employee_id);

    if (error) {
      console.error('Error updating employee:', error);
      return false;
    }
  } else {
    const slug = await generateUniqueCabinetSlug(state.partner_id!, state.firstname!, state.lastname!);
    employeeData.cabinet_slug = slug;

    const { data, error } = await supabase
      .from('employees')
      .insert(employeeData)
      .select()
      .single();

    if (error) {
      console.error('Error creating employee:', error);
      return false;
    }

    const { error: historyError } = await supabase
      .from('employment_history')
      .insert({
        employee_id: data.id,
        start_date: state.hire_date || new Date().toISOString().split('T')[0],
        status_type: 'worked',
      });

    if (historyError) {
      console.error('Error inserting history:', historyError);
    }
  }

  return true;
}

async function handleStartCommand(update: TelegramUpdate, botToken: string, partnerId: string): Promise<number | undefined> {
  const chatId = update.message!.chat.id;
  const chatType = update.message!.chat.type;
  const telegramUserId = update.message!.from.id;
  const firstname = update.message!.from.first_name;
  const userMessageId = update.message!.message_id;

  const isGroupChat = chatType !== 'private';
  const targetChatId = isGroupChat ? telegramUserId : chatId;

  if (isGroupChat) {
    await deleteTelegramMessage(botToken, chatId, userMessageId);
  }

  const existingState = await getUserState(telegramUserId);
  if (existingState?.last_bot_message_id) {
    await deleteTelegramMessage(botToken, targetChatId, existingState.last_bot_message_id);
  }

  if (isGroupChat && existingState) {
    await deleteUserState(telegramUserId);
  }

  const existingEmployee = await getExistingEmployee(partnerId, telegramUserId.toString());

  let result;
  let newState: UserState;

  if (existingEmployee) {
    result = await sendTelegramMessage(
      botToken,
      targetChatId,
      `Здравствуйте, <b>${existingEmployee.first_name}</b>!\n\n` +
      'Вы уже зарегистрированы в системе. Давайте обновим ваши данные.\n\n' +
      'Введите вашу <b>Фамилию</b>:'
    );

    newState = {
      step: 'awaiting_lastname',
      firstname: existingEmployee.first_name,
      partner_id: partnerId,
      is_editing: true,
      employee_id: existingEmployee.id,
      last_bot_message_id: result.messageId,
      photo_url: existingEmployee.photo_url,
      photo_file_id: existingEmployee.photo_file_id,
      cabinet_login: existingEmployee.cabinet_login,
      cabinet_password: existingEmployee.cabinet_password,
    };
  } else {
    result = await sendTelegramMessage(
      botToken,
      targetChatId,
      `Здравствуйте, <b>${firstname}</b>!\n\n` +
      'Добро пожаловать в систему регистрации сотрудников.\n\n' +
      'Для начала, введите вашу <b>Фамилию</b>:'
    );

    newState = {
      step: 'awaiting_lastname',
      firstname: firstname,
      partner_id: partnerId,
      is_editing: false,
      last_bot_message_id: result.messageId,
    };
  }

  await setUserState(telegramUserId, newState);
  return result.messageId;
}

async function handlePasswordCommand(update: TelegramUpdate, botToken: string, partnerId: string): Promise<void> {
  const chatId = update.message!.chat.id;
  const chatType = update.message!.chat.type;
  const telegramUserId = update.message!.from.id;
  const userMessageId = update.message!.message_id;

  const isGroupChat = chatType !== 'private';
  const targetChatId = isGroupChat ? telegramUserId : chatId;

  if (isGroupChat) {
    await deleteTelegramMessage(botToken, chatId, userMessageId);
  }

  const employee = await getExistingEmployee(partnerId, telegramUserId.toString());

  if (!employee) {
    const result = await sendTelegramMessage(
      botToken,
      targetChatId,
      'Вы не зарегистрированы в системе. Отправьте /start для регистрации.'
    );
    if (result.messageId) {
      EdgeRuntime.waitUntil(deleteMessageDelayed(botToken, targetChatId, result.messageId, 10000));
    }
    return;
  }

  if (!employee.cabinet_login || !employee.cabinet_password) {
    const result = await sendTelegramMessage(
      botToken,
      targetChatId,
      'У вас еще не настроены данные для входа в кабинет. Обратитесь к администратору или обновите данные через /start'
    );
    if (result.messageId) {
      EdgeRuntime.waitUntil(deleteMessageDelayed(botToken, targetChatId, result.messageId, 10000));
    }
    return;
  }

  const keyboard = {
    inline_keyboard: [[
      { text: 'Да, покажите', callback_data: 'show_credentials' },
      { text: 'Нет', callback_data: 'cancel_credentials' }
    ]]
  };

  await sendTelegramMessage(
    botToken,
    targetChatId,
    'Вы забыли логин или пароль от кабинета?',
    keyboard
  );
}

async function handleKabinetCommand(update: TelegramUpdate, botToken: string, partnerId: string, cabinetBaseUrl: string): Promise<void> {
  const chatId = update.message!.chat.id;
  const chatType = update.message!.chat.type;
  const telegramUserId = update.message!.from.id;
  const userMessageId = update.message!.message_id;

  const isGroupChat = chatType !== 'private';
  const targetChatId = isGroupChat ? telegramUserId : chatId;

  if (isGroupChat) {
    await deleteTelegramMessage(botToken, chatId, userMessageId);
  }

  const employee = await getExistingEmployee(partnerId, telegramUserId.toString());

  if (!employee) {
    const result = await sendTelegramMessage(
      botToken,
      targetChatId,
      'Вы не зарегистрированы в системе. Отправьте /start для регистрации.'
    );
    if (result.messageId) {
      EdgeRuntime.waitUntil(deleteMessageDelayed(botToken, targetChatId, result.messageId, 10000));
    }
    return;
  }

  if (!employee.cabinet_slug) {
    const result = await sendTelegramMessage(
      botToken,
      targetChatId,
      'У вас еще не создан личный кабинет. Обратитесь к администратору.'
    );
    if (result.messageId) {
      EdgeRuntime.waitUntil(deleteMessageDelayed(botToken, targetChatId, result.messageId, 10000));
    }
    return;
  }

  const cabinetUrl = `${cabinetBaseUrl}/${employee.cabinet_slug}`;

  const keyboard = {
    inline_keyboard: [[
      {
        text: 'Открыть кабинет',
        web_app: { url: cabinetUrl }
      }
    ]]
  };

  await sendTelegramMessage(
    botToken,
    targetChatId,
    `<b>Личный кабинет сотрудника</b>\n\n` +
    `Нажмите кнопку ниже, чтобы открыть ваш личный кабинет.`,
    keyboard
  );
}

async function handleShowCredentials(update: TelegramUpdate, botToken: string, partnerId: string): Promise<void> {
  const callbackQuery = update.callback_query!;
  const chatId = callbackQuery.message!.chat.id;
  const telegramUserId = callbackQuery.from.id;
  const originalMessageId = callbackQuery.message!.message_id;

  await answerCallbackQuery(botToken, callbackQuery.id);

  const employee = await getExistingEmployee(partnerId, telegramUserId.toString());

  if (!employee || !employee.cabinet_login || !employee.cabinet_password) {
    await deleteTelegramMessage(botToken, chatId, originalMessageId);
    return;
  }

  await deleteTelegramMessage(botToken, chatId, originalMessageId);

  const result = await sendTelegramMessage(
    botToken,
    chatId,
    `<b>Ваши данные для входа:</b>\n\n` +
    `Логин: <code>${employee.cabinet_login}</code>\n` +
    `Пароль: <code>${employee.cabinet_password}</code>\n\n` +
    `<i>Это сообщение будет удалено через 1 минуту.</i>`
  );

  if (result.messageId) {
    EdgeRuntime.waitUntil(deleteMessageDelayed(botToken, chatId, result.messageId, 60000));
  }
}

async function handleCancelCredentials(update: TelegramUpdate, botToken: string): Promise<void> {
  const callbackQuery = update.callback_query!;
  const chatId = callbackQuery.message!.chat.id;
  const originalMessageId = callbackQuery.message!.message_id;

  await answerCallbackQuery(botToken, callbackQuery.id);
  await deleteTelegramMessage(botToken, chatId, originalMessageId);
}

async function handleAcceptReplacement(
  update: TelegramUpdate,
  botToken: string,
  partnerId: string,
  data: string
): Promise<void> {
  const callbackQuery = update.callback_query!;
  const chatId = callbackQuery.message!.chat.id;
  const originalMessageId = callbackQuery.message!.message_id;

  const parts = data.split(':');
  const shiftId = parts[1];
  const employeeId = parts[2];

  const { data: shift } = await supabase
    .from('schedule_shifts')
    .select('id, replacement_status, replacement_employee_id, start_time, end_time, branch:branches(name)')
    .eq('id', shiftId)
    .maybeSingle();

  if (!shift) {
    await answerCallbackQuery(botToken, callbackQuery.id, 'Смена не найдена');
    return;
  }

  if (shift.replacement_status === 'accepted' && shift.replacement_employee_id) {
    await answerCallbackQuery(botToken, callbackQuery.id, 'Смена уже принята другим сотрудником');
    await deleteTelegramMessage(botToken, chatId, originalMessageId);
    return;
  }

  await answerCallbackQuery(botToken, callbackQuery.id);
  await deleteTelegramMessage(botToken, chatId, originalMessageId);

  const branchName = (shift.branch as { name: string } | null)?.name || 'Не указан';
  const shiftTime = `${shift.start_time.substring(0, 5)} - ${shift.end_time.substring(0, 5)}`;

  let message = `<b>Через сколько вы сможете быть на смене?</b>\n\n`;
  message += `Филиал: ${branchName}\n`;
  message += `Время: ${shiftTime}\n\n`;
  message += `Выберите время прибытия:`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '10 мин', callback_data: `eta_replacement:${shiftId}:${employeeId}:10` },
        { text: '20 мин', callback_data: `eta_replacement:${shiftId}:${employeeId}:20` },
        { text: '30 мин', callback_data: `eta_replacement:${shiftId}:${employeeId}:30` }
      ],
      [
        { text: '40 мин', callback_data: `eta_replacement:${shiftId}:${employeeId}:40` },
        { text: '60 мин', callback_data: `eta_replacement:${shiftId}:${employeeId}:60` },
        { text: '90 мин', callback_data: `eta_replacement:${shiftId}:${employeeId}:90` }
      ],
      [
        { text: '120 мин', callback_data: `eta_replacement:${shiftId}:${employeeId}:120` }
      ]
    ]
  };

  await sendTelegramMessage(botToken, String(chatId), message, replyMarkup);
}

async function handleEtaReplacement(
  update: TelegramUpdate,
  botToken: string,
  partnerId: string,
  data: string
): Promise<void> {
  const callbackQuery = update.callback_query!;
  const chatId = callbackQuery.message!.chat.id;
  const telegramUserId = callbackQuery.from.id;
  const originalMessageId = callbackQuery.message!.message_id;

  const parts = data.split(':');
  const shiftId = parts[1];
  const employeeId = parts[2];
  const etaMinutes = parseInt(parts[3], 10);

  const { data: shift } = await supabase
    .from('schedule_shifts')
    .select(`
      id, partner_id, branch_id, date, start_time, end_time,
      replacement_status, replacement_employee_id, employee_id,
      branch:branches(name),
      employee:employees!schedule_shifts_employee_id_fkey(id, first_name, last_name, position_id)
    `)
    .eq('id', shiftId)
    .maybeSingle();

  if (!shift) {
    await answerCallbackQuery(botToken, callbackQuery.id, 'Смена не найдена');
    return;
  }

  if (shift.replacement_status === 'accepted' && shift.replacement_employee_id && shift.replacement_employee_id !== employeeId) {
    await answerCallbackQuery(botToken, callbackQuery.id, 'Смена уже принята другим сотрудником');
    await deleteTelegramMessage(botToken, chatId, originalMessageId);
    return;
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('schedule_shifts')
    .update({
      replacement_status: 'accepted',
      replacement_employee_id: employeeId,
      replacement_accepted_at: now,
      replacement_eta_minutes: etaMinutes,
    })
    .eq('id', shiftId)
    .eq('replacement_status', 'offered');

  if (updateError) {
    console.error('Error accepting replacement:', updateError);
    await answerCallbackQuery(botToken, callbackQuery.id, 'Смена уже принята другим сотрудником');
    await deleteTelegramMessage(botToken, chatId, originalMessageId);
    return;
  }

  await answerCallbackQuery(botToken, callbackQuery.id);
  await deleteTelegramMessage(botToken, chatId, originalMessageId);

  const { data: acceptingEmployee } = await supabase
    .from('employees')
    .select('id, first_name, last_name, photo_url')
    .eq('id', employeeId)
    .maybeSingle();

  const branchName = (shift.branch as { name: string } | null)?.name || 'Не указан';
  const shiftTime = `${shift.start_time.substring(0, 5)} - ${shift.end_time.substring(0, 5)}`;
  const acceptingName = acceptingEmployee ? `${acceptingEmployee.first_name} ${acceptingEmployee.last_name || ''}`.trim() : 'Сотрудник';

  let confirmMessage = `<b>Вы приняли смену!</b>\n\n`;
  confirmMessage += `Филиал: ${branchName}\n`;
  confirmMessage += `Время: ${shiftTime}\n`;
  confirmMessage += `ETA: ${etaMinutes} мин\n\n`;
  confirmMessage += `Пожалуйста, прибудьте вовремя.`;

  await sendTelegramMessage(botToken, String(chatId), confirmMessage);

  const { data: otherMessages } = await supabase
    .from('shift_replacement_messages')
    .select('id, telegram_message_id, telegram_chat_id, event_id')
    .eq('shift_id', shiftId)
    .eq('is_active', true)
    .neq('employee_id', employeeId);

  if (otherMessages && otherMessages.length > 0) {
    for (const msg of otherMessages) {
      if (msg.telegram_message_id && msg.telegram_chat_id) {
        try {
          await deleteTelegramMessage(botToken, msg.telegram_chat_id, Number(msg.telegram_message_id));
        } catch (e) {
          console.log(`Failed to delete message ${msg.telegram_message_id}:`, e);
        }
      }

      if (msg.event_id) {
        await supabase
          .from('employee_events')
          .update({ action_status: 'cancelled' })
          .eq('id', msg.event_id);
      }
    }
  }

  await supabase
    .from('shift_replacement_messages')
    .update({ is_active: false })
    .eq('shift_id', shiftId);

  const { data: partnerSettings } = await supabase
    .from('partner_settings')
    .select('no_show_responsible_enabled, no_show_responsible_employee_ids')
    .eq('partner_id', shift.partner_id)
    .maybeSingle();

  if (partnerSettings?.no_show_responsible_enabled && partnerSettings.no_show_responsible_employee_ids?.length) {
    const { data: responsibleEmployees } = await supabase
      .from('employees')
      .select('id, first_name, last_name, telegram_user_id')
      .in('id', partnerSettings.no_show_responsible_employee_ids)
      .eq('is_active', true);

    if (responsibleEmployees) {
      for (const responsible of responsibleEmployees) {
        await supabase
          .from('employee_events')
          .insert({
            partner_id: shift.partner_id,
            employee_id: responsible.id,
            event_type: 'shift_accepted',
            title: 'Смена принята',
            message: `${acceptingName} принял смену`,
            related_shift_id: shiftId,
            related_employee_id: employeeId,
            related_employee_photo_url: acceptingEmployee?.photo_url,
            related_employee_name: acceptingName,
            related_branch_name: branchName,
            related_shift_time: shiftTime,
          });

        if (responsible.telegram_user_id) {
          let notifyMessage = `<b>Смена принята</b>\n\n`;
          notifyMessage += `${acceptingName} принял смену\n`;
          notifyMessage += `Филиал: ${branchName}\n`;
          notifyMessage += `Время: ${shiftTime}\n`;
          notifyMessage += `ETA: ${etaMinutes} мин`;

          await sendTelegramMessage(botToken, responsible.telegram_user_id, notifyMessage);
        }
      }
    }
  }

  const originalEmployeeId = shift.employee_id;
  const noShowEmployee = shift.employee as { id: string; first_name: string; last_name: string | null; position_id: string | null } | null;

  if (originalEmployeeId && noShowEmployee) {
    const { data: existingRow } = await supabase
      .from('schedule_rows')
      .select('id')
      .eq('partner_id', shift.partner_id)
      .eq('branch_id', shift.branch_id)
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (!existingRow) {
      await supabase
        .from('schedule_rows')
        .insert({
          partner_id: shift.partner_id,
          branch_id: shift.branch_id,
          employee_id: employeeId,
          position_id: noShowEmployee.position_id,
        });
    }

    await supabase
      .from('schedule_shifts')
      .insert({
        partner_id: shift.partner_id,
        branch_id: shift.branch_id,
        employee_id: employeeId,
        date: shift.date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        status: 'scheduled',
        attendance_status: 'scheduled',
        is_replacement: true,
        original_shift_id: shiftId,
      });

    console.log(`Created replacement shift for employee ${employeeId} for shift ${shiftId}`);
  }
}

async function handleNoShowAction(
  update: TelegramUpdate,
  botToken: string,
  partnerId: string,
  data: string
): Promise<void> {
  const callbackQuery = update.callback_query!;
  const chatId = callbackQuery.message!.chat.id;
  const telegramUserId = callbackQuery.from.id;
  const originalMessageId = callbackQuery.message!.message_id;

  const parts = data.split(':');
  let action = parts[0];
  let shiftId = parts[1];
  let eventId = parts[2] || parts[1];

  if (action === 'nsa' || action === 'nsr') {
    eventId = parts[1];
    action = action === 'nsa' ? 'noshow_approve' : 'noshow_reject';

    const { data: eventData } = await supabase
      .from('employee_events')
      .select('related_shift_id')
      .eq('id', eventId)
      .maybeSingle();

    if (!eventData?.related_shift_id) {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Событие не найдено');
      return;
    }
    shiftId = eventData.related_shift_id;
  }

  const responsibleEmployee = await supabase
    .from('employees')
    .select('id, first_name, last_name')
    .eq('partner_id', partnerId)
    .eq('telegram_user_id', telegramUserId.toString())
    .eq('is_active', true)
    .maybeSingle();

  if (!responsibleEmployee.data) {
    await answerCallbackQuery(botToken, callbackQuery.id, 'У вас нет прав для этого действия');
    return;
  }

  const { data: shift } = await supabase
    .from('schedule_shifts')
    .select(`
      id, no_show_reason_text, no_show_reason_status,
      employee:employees!schedule_shifts_employee_id_fkey(id, first_name, last_name, telegram_user_id),
      branch:branches(name)
    `)
    .eq('id', shiftId)
    .maybeSingle();

  if (!shift) {
    await answerCallbackQuery(botToken, callbackQuery.id, 'Смена не найдена');
    return;
  }

  if (shift.no_show_reason_status && shift.no_show_reason_status !== 'pending') {
    await answerCallbackQuery(botToken, callbackQuery.id, 'Решение уже принято');
    return;
  }

  const isApprove = action === 'noshow_approve';
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = isApprove
    ? {
        no_show_reason_status: 'approved',
        no_show_approved_by: responsibleEmployee.data.id,
        no_show_approved_at: now,
      }
    : {
        no_show_reason_status: 'rejected',
        no_show_rejected_by: responsibleEmployee.data.id,
        no_show_rejected_at: now,
      };

  const { error: updateError } = await supabase
    .from('schedule_shifts')
    .update(updateData)
    .eq('id', shiftId);

  if (updateError) {
    console.error('Error updating shift:', updateError);
    await answerCallbackQuery(botToken, callbackQuery.id, 'Ошибка при сохранении');
    return;
  }

  if (eventId) {
    await supabase
      .from('employee_events')
      .update({
        action_status: isApprove ? 'approved' : 'rejected',
        action_taken_at: now,
      })
      .eq('id', eventId);
  }

  const employeeInfo = shift.employee as { id: string; first_name: string; last_name: string | null; telegram_user_id: string | null } | null;
  const employeeName = employeeInfo
    ? `${employeeInfo.first_name}${employeeInfo.last_name ? ' ' + employeeInfo.last_name : ''}`
    : 'Сотрудник';

  const branchName = (shift.branch as { name: string } | null)?.name || 'Филиал';
  const reasonText = shift.no_show_reason_text || 'Не указана';
  const decisionText = isApprove ? 'ОДОБРЕНА' : 'ОТКЛОНЕНА';
  const responsibleName = `${responsibleEmployee.data.first_name}${responsibleEmployee.data.last_name ? ' ' + responsibleEmployee.data.last_name : ''}`;

  const updatedMessage =
    `<b>Не выход на смену</b>\n\n` +
    `<b>${employeeName}</b>\n` +
    `Филиал: ${branchName}\n\n` +
    `Причина: ${reasonText}\n\n` +
    `<b>Решение: ${decisionText}</b>\n` +
    `Ответственный: ${responsibleName}`;

  await editTelegramMessage(botToken, chatId, originalMessageId, updatedMessage);
  await answerCallbackQuery(botToken, callbackQuery.id, isApprove ? 'Причина одобрена' : 'Причина отклонена');

  if (employeeInfo?.telegram_user_id) {
    const notifyText = isApprove
      ? `<b>Ваша причина не выхода на смену одобрена</b>\n\nПричина: ${reasonText}`
      : `<b>Ваша причина не выхода на смену отклонена</b>\n\nПричина: ${reasonText}\n\nОбратитесь к руководству для уточнения.`;

    await sendTelegramMessage(botToken, employeeInfo.telegram_user_id, notifyText);

    await supabase.from('employee_events').insert({
      partner_id: partnerId,
      employee_id: employeeInfo.id,
      event_type: isApprove ? 'no_show_approved' : 'no_show_rejected',
      title: isApprove ? 'Причина одобрена' : 'Причина отклонена',
      message: notifyText.replace(/<[^>]*>/g, ''),
      related_shift_id: shiftId,
    });
  }
}

async function editTelegramMessage(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/editMessageText`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'HTML',
      }),
    });
    const result = await response.json();
    return result.ok === true;
  } catch (err) {
    console.error('Error editing message:', err);
    return false;
  }
}

async function handleLastname(update: TelegramUpdate, botToken: string, state: UserState) {
  const chatId = update.message!.chat.id;
  const telegramUserId = update.message!.from.id;
  const text = update.message!.text?.trim();
  const userMessageId = update.message!.message_id;

  if (!text) {
    await sendAndTrackMessage(botToken, chatId, telegramUserId, 'Пожалуйста, введите вашу фамилию.', state, undefined, userMessageId);
    await setUserState(telegramUserId, state);
    return;
  }

  state.lastname = text;
  state.step = 'awaiting_position';

  const positions = await getPositions(state.partner_id!);

  if (positions.length === 0) {
    await sendAndTrackMessage(
      botToken,
      chatId,
      telegramUserId,
      'В системе нет доступных должностей. Обратитесь к администратору.',
      state,
      undefined,
      userMessageId
    );
    await deleteUserState(telegramUserId);
    return;
  }

  const keyboard = {
    inline_keyboard: positions.map(pos => [{
      text: pos.name,
      callback_data: `position_${pos.id}`
    }])
  };

  await sendAndTrackMessage(
    botToken,
    chatId,
    telegramUserId,
    'Выберите вашу <b>Должность</b>:',
    state,
    keyboard,
    userMessageId
  );
  await setUserState(telegramUserId, state);
}

async function handlePosition(update: TelegramUpdate, botToken: string, state: UserState) {
  const callbackQuery = update.callback_query!;
  const chatId = callbackQuery.message!.chat.id;
  const telegramUserId = callbackQuery.from.id;
  const positionId = callbackQuery.data!.replace('position_', '');

  await answerCallbackQuery(botToken, callbackQuery.id, 'Должность выбрана');

  state.position_id = positionId;
  state.step = 'awaiting_branch';

  const branches = await getBranches(state.partner_id!);

  if (branches.length === 0) {
    if (state.last_bot_message_id) {
      await deleteTelegramMessage(botToken, chatId, state.last_bot_message_id);
    }
    const result = await sendTelegramMessage(
      botToken,
      chatId,
      'В системе нет доступных филиалов. Обратитесь к администратору.'
    );
    state.last_bot_message_id = result.messageId;
    await deleteUserState(telegramUserId);
    return;
  }

  const keyboard = {
    inline_keyboard: branches.map(branch => [{
      text: branch.name,
      callback_data: `branch_${branch.id}`
    }])
  };

  if (state.last_bot_message_id) {
    await deleteTelegramMessage(botToken, chatId, state.last_bot_message_id);
  }
  const result = await sendTelegramMessage(
    botToken,
    chatId,
    'Выберите ваш <b>Филиал</b>:',
    keyboard
  );
  state.last_bot_message_id = result.messageId;
  await setUserState(telegramUserId, state);
}

async function handleBranch(update: TelegramUpdate, botToken: string, state: UserState) {
  const callbackQuery = update.callback_query!;
  const chatId = callbackQuery.message!.chat.id;
  const telegramUserId = callbackQuery.from.id;
  const branchId = callbackQuery.data!.replace('branch_', '');

  await answerCallbackQuery(botToken, callbackQuery.id, 'Филиал выбран');

  state.branch_id = branchId;
  state.step = 'awaiting_phone';

  if (state.last_bot_message_id) {
    await deleteTelegramMessage(botToken, chatId, state.last_bot_message_id);
  }
  const result = await sendTelegramMessage(
    botToken,
    chatId,
    'Введите ваш <b>Номер телефона</b> (в формате +380XXXXXXXXX):'
  );
  state.last_bot_message_id = result.messageId;
  await setUserState(telegramUserId, state);
}

async function handlePhone(update: TelegramUpdate, botToken: string, state: UserState) {
  const chatId = update.message!.chat.id;
  const telegramUserId = update.message!.from.id;
  const phone = update.message!.text?.trim();
  const userMessageId = update.message!.message_id;

  if (!phone || !/^\+?\d{10,15}$/.test(phone)) {
    await sendAndTrackMessage(
      botToken,
      chatId,
      telegramUserId,
      'Неверный формат номера телефона. Введите номер в формате +380XXXXXXXXX:',
      state,
      undefined,
      userMessageId
    );
    await setUserState(telegramUserId, state);
    return;
  }

  state.phone = phone;
  state.step = 'awaiting_email';

  await sendAndTrackMessage(
    botToken,
    chatId,
    telegramUserId,
    'Введите ваш <b>Email</b>:',
    state,
    undefined,
    userMessageId
  );
  await setUserState(telegramUserId, state);
}

async function handleEmail(update: TelegramUpdate, botToken: string, state: UserState) {
  const chatId = update.message!.chat.id;
  const telegramUserId = update.message!.from.id;
  const email = update.message!.text?.trim();
  const userMessageId = update.message!.message_id;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await sendAndTrackMessage(
      botToken,
      chatId,
      telegramUserId,
      'Неверный формат email. Введите корректный email адрес:',
      state,
      undefined,
      userMessageId
    );
    await setUserState(telegramUserId, state);
    return;
  }

  state.email = email;

  const username = update.message!.from.username;
  state.telegram_username = username ? `@${username}` : null;

  state.step = 'awaiting_card';

  await sendAndTrackMessage(
    botToken,
    chatId,
    telegramUserId,
    'Введите <b>Номер вашей банковской карты</b> (16 цифр):',
    state,
    undefined,
    userMessageId
  );
  await setUserState(telegramUserId, state);
}

async function handleCard(update: TelegramUpdate, botToken: string, state: UserState) {
  const chatId = update.message!.chat.id;
  const telegramUserId = update.message!.from.id;
  const cardNumber = update.message!.text?.trim().replace(/\s/g, '');
  const userMessageId = update.message!.message_id;

  if (!cardNumber || !/^\d{16}$/.test(cardNumber)) {
    await sendAndTrackMessage(
      botToken,
      chatId,
      telegramUserId,
      'Неверный формат номера карты. Введите 16 цифр:',
      state,
      undefined,
      userMessageId
    );
    await setUserState(telegramUserId, state);
    return;
  }

  state.card_number = cardNumber;
  state.step = 'awaiting_photo';

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  state.hire_date = `${year}-${month}-${day}`;

  const keyboard = {
    inline_keyboard: [[
      { text: 'Пропустить', callback_data: 'skip_photo' }
    ]]
  };

  await sendAndTrackMessage(
    botToken,
    chatId,
    telegramUserId,
    'Отправьте ваше <b>Фото</b> для профиля:\n\n' +
    'Вы можете сделать фото камерой или выбрать из галереи.\n' +
    'Нажмите "Пропустить", если не хотите добавлять фото сейчас.',
    state,
    keyboard,
    userMessageId
  );
  await setUserState(telegramUserId, state);
}

async function handlePhoto(update: TelegramUpdate, botToken: string, state: UserState): Promise<void> {
  const chatId = update.message!.chat.id;
  const telegramUserId = update.message!.from.id;
  const photos = update.message!.photo;
  const userMessageId = update.message!.message_id;

  if (!photos || photos.length === 0) {
    await sendAndTrackMessage(
      botToken,
      chatId,
      telegramUserId,
      'Пожалуйста, отправьте фото или нажмите "Пропустить".',
      state,
      {
        inline_keyboard: [[
          { text: 'Пропустить', callback_data: 'skip_photo' }
        ]]
      },
      userMessageId
    );
    await setUserState(telegramUserId, state);
    return;
  }

  const largestPhoto = photos[photos.length - 1];
  state.photo_file_id = largestPhoto.file_id;

  const employeeId = state.employee_id || `temp_${telegramUserId}`;
  console.log('[Handle Photo] Attempting to upload photo for employee:', employeeId);
  const photoUrl = await downloadAndUploadPhoto(botToken, largestPhoto.file_id, state.partner_id!, employeeId);

  if (photoUrl) {
    console.log('[Handle Photo] Upload successful, new URL:', photoUrl);
    state.photo_url = photoUrl;
  } else {
    console.error('[Handle Photo] Upload FAILED, keeping old photo_url:', state.photo_url);
  }

  await proceedToCabinetSetup(botToken, chatId, telegramUserId, state, userMessageId);
}

async function handleSkipPhoto(update: TelegramUpdate, botToken: string, state: UserState): Promise<void> {
  const callbackQuery = update.callback_query!;
  const chatId = callbackQuery.message!.chat.id;
  const telegramUserId = callbackQuery.from.id;

  await answerCallbackQuery(botToken, callbackQuery.id, 'Фото пропущено');

  await proceedToCabinetSetup(botToken, chatId, telegramUserId, state);
}

async function proceedToCabinetSetup(botToken: string, chatId: number, telegramUserId: number, state: UserState, userMessageId?: number): Promise<void> {
  if (state.is_editing && state.cabinet_login && state.cabinet_password) {
    state.step = 'awaiting_cabinet_change_confirm';

    const keyboard = {
      inline_keyboard: [[
        { text: 'Да, изменить', callback_data: 'change_cabinet_credentials' },
        { text: 'Нет, оставить', callback_data: 'keep_cabinet_credentials' }
      ]]
    };

    await sendAndTrackMessage(
      botToken,
      chatId,
      telegramUserId,
      `<b>Данные для входа в кабинет</b>\n\n` +
      `Текущий логин: <code>${state.cabinet_login}</code>\n\n` +
      `Хотите изменить логин и пароль от кабинета?`,
      state,
      keyboard,
      userMessageId
    );
    await setUserState(telegramUserId, state);
  } else {
    state.step = 'awaiting_cabinet_login';

    const suggestedLogin = await generateUniqueLogin(state.partner_id!, state.firstname!, state.lastname!);

    await sendAndTrackMessage(
      botToken,
      chatId,
      telegramUserId,
      `<b>Настройка кабинета сотрудника</b>\n\n` +
      `Придумайте <b>логин</b> для входа в кабинет.\n` +
      `Предлагаемый: <code>${suggestedLogin}</code>\n\n` +
      `Введите желаемый логин или отправьте предложенный:`,
      state,
      undefined,
      userMessageId
    );
    await setUserState(telegramUserId, state);
  }
}

async function handleCabinetChangeConfirm(update: TelegramUpdate, botToken: string, state: UserState, change: boolean): Promise<void> {
  const callbackQuery = update.callback_query!;
  const chatId = callbackQuery.message!.chat.id;
  const telegramUserId = callbackQuery.from.id;

  await answerCallbackQuery(botToken, callbackQuery.id);

  if (change) {
    state.step = 'awaiting_cabinet_login';

    const suggestedLogin = await generateUniqueLogin(state.partner_id!, state.firstname!, state.lastname!);

    if (state.last_bot_message_id) {
      await deleteTelegramMessage(botToken, chatId, state.last_bot_message_id);
    }
    const result = await sendTelegramMessage(
      botToken,
      chatId,
      `Придумайте новый <b>логин</b> для входа в кабинет.\n` +
      `Предлагаемый: <code>${suggestedLogin}</code>\n\n` +
      `Введите желаемый логин:`
    );
    state.last_bot_message_id = result.messageId;
    await setUserState(telegramUserId, state);
  } else {
    await finishRegistration(botToken, chatId, telegramUserId, state);
  }
}

async function handleCabinetLogin(update: TelegramUpdate, botToken: string, state: UserState): Promise<void> {
  const chatId = update.message!.chat.id;
  const telegramUserId = update.message!.from.id;
  const login = update.message!.text?.trim().toLowerCase();
  const userMessageId = update.message!.message_id;

  if (!login || login.length < 3) {
    await sendAndTrackMessage(
      botToken,
      chatId,
      telegramUserId,
      'Логин должен содержать минимум 3 символа. Попробуйте еще раз:',
      state,
      undefined,
      userMessageId
    );
    await setUserState(telegramUserId, state);
    return;
  }

  if (!/^[a-z0-9._-]+$/.test(login)) {
    await sendAndTrackMessage(
      botToken,
      chatId,
      telegramUserId,
      'Логин может содержать только латинские буквы, цифры, точки, дефисы и подчеркивания. Попробуйте еще раз:',
      state,
      undefined,
      userMessageId
    );
    await setUserState(telegramUserId, state);
    return;
  }

  const { data: existingLogin } = await supabase
    .from('employees')
    .select('id')
    .eq('partner_id', state.partner_id!)
    .eq('cabinet_login', login)
    .neq('id', state.employee_id || '')
    .maybeSingle();

  if (existingLogin) {
    await sendAndTrackMessage(
      botToken,
      chatId,
      telegramUserId,
      'Этот логин уже занят. Выберите другой:',
      state,
      undefined,
      userMessageId
    );
    await setUserState(telegramUserId, state);
    return;
  }

  state.cabinet_login = login;
  state.step = 'awaiting_cabinet_password';

  const suggestedPassword = generateRandomPassword();

  await sendAndTrackMessage(
    botToken,
    chatId,
    telegramUserId,
    `Отлично! Теперь придумайте <b>пароль</b> для входа в кабинет.\n` +
    `Предлагаемый: <code>${suggestedPassword}</code>\n\n` +
    `Введите желаемый пароль (минимум 4 символа):`,
    state,
    undefined,
    userMessageId
  );
  await setUserState(telegramUserId, state);
}

async function handleCabinetPassword(update: TelegramUpdate, botToken: string, state: UserState): Promise<void> {
  const chatId = update.message!.chat.id;
  const telegramUserId = update.message!.from.id;
  const password = update.message!.text?.trim();
  const userMessageId = update.message!.message_id;

  if (!password || password.length < 4) {
    await sendAndTrackMessage(
      botToken,
      chatId,
      telegramUserId,
      'Пароль должен содержать минимум 4 символа. Попробуйте еще раз:',
      state,
      undefined,
      userMessageId
    );
    await setUserState(telegramUserId, state);
    return;
  }

  state.cabinet_password = password;

  await finishRegistration(botToken, chatId, telegramUserId, state, userMessageId);
}

async function finishRegistration(botToken: string, chatId: number, telegramUserId: number, state: UserState, userMessageId?: number): Promise<{ finalMessageId?: number; chatId: number }> {
  const success = await saveEmployee(state, telegramUserId.toString());

  if (state.last_bot_message_id) {
    await deleteTelegramMessage(botToken, chatId, state.last_bot_message_id);
  }
  if (userMessageId) {
    await deleteTelegramMessage(botToken, chatId, userMessageId);
  }

  let result;
  if (success) {
    const employee = await getExistingEmployee(state.partner_id!, telegramUserId.toString());
    const cabinetSlug = employee?.cabinet_slug;

    let message = state.is_editing
      ? '<b>Ваши данные успешно обновлены!</b>\n\n'
      : '<b>Регистрация успешно завершена!</b>\n\n';

    if (state.cabinet_login && state.cabinet_password) {
      message += `<b>Данные для входа в кабинет:</b>\n`;
      message += `Логин: <code>${state.cabinet_login}</code>\n`;
      message += `Пароль: <code>${state.cabinet_password}</code>\n\n`;
      message += `Для входа в кабинет используйте команду /kabinet\n`;
      message += `Если забудете пароль - /password\n\n`;
    }

    message += 'Если вам нужно обновить данные, отправьте команду /start';

    result = await sendTelegramMessage(botToken, chatId, message);
  } else {
    result = await sendTelegramMessage(
      botToken,
      chatId,
      'Произошла ошибка при сохранении данных. Пожалуйста, попробуйте снова или обратитесь к администратору.'
    );
  }

  await deleteUserState(telegramUserId);

  return { finalMessageId: result.messageId, chatId };
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
    console.log('Received update:', JSON.stringify(update));

    const url = new URL(req.url);
    const origin = url.origin;
    const cabinetBaseUrl = `${origin}/employee`;
    console.log(`[EMPLOYEE BOT] Using cabinet base URL: ${cabinetBaseUrl}`);

    const partnerId = url.searchParams.get('partner_id');

    if (!partnerId) {
      console.error('No partner_id provided');
      return new Response(JSON.stringify({ error: 'partner_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const settings = await getPartnerSettings(partnerId);
    if (!settings || !settings.employee_bot_enabled || !settings.employee_bot_allow_registration) {
      console.log('Bot is disabled or registration not allowed');
      return new Response(JSON.stringify({ ok: true, message: 'Bot disabled' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const botToken = settings.employee_bot_token;
    if (!botToken) {
      console.error('No bot token configured');
      return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let finalMessageToDelete: { messageId: number; chatId: number } | null = null;

    if (update.message) {
      const text = update.message.text?.trim();
      const telegramUserId = update.message.from.id;
      const hasPhoto = update.message.photo && update.message.photo.length > 0;

      if (text === '/start' || text?.startsWith('/start@')) {
        await handleStartCommand(update, botToken, partnerId);
      } else if (text === '/password' || text?.startsWith('/password@')) {
        await handlePasswordCommand(update, botToken, partnerId);
      } else if (text === '/kabinet' || text?.startsWith('/kabinet@')) {
        await handleKabinetCommand(update, botToken, partnerId, cabinetBaseUrl);
      } else {
        const state = await getUserState(telegramUserId);
        const chatType = update.message.chat.type;
        const isGroupChat = chatType !== 'private';

        if (!state) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else if (isGroupChat) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          switch (state.step) {
            case 'awaiting_lastname':
              await handleLastname(update, botToken, state);
              break;
            case 'awaiting_phone':
              await handlePhone(update, botToken, state);
              break;
            case 'awaiting_email':
              await handleEmail(update, botToken, state);
              break;
            case 'awaiting_card':
              await handleCard(update, botToken, state);
              break;
            case 'awaiting_photo':
              if (hasPhoto) {
                await handlePhoto(update, botToken, state);
              } else {
                const chatId = update.message.chat.id;
                const userMessageId = update.message.message_id;

                await sendAndTrackMessage(
                  botToken,
                  chatId,
                  telegramUserId,
                  'Пожалуйста, отправьте фото или нажмите "Пропустить".',
                  state,
                  {
                    inline_keyboard: [[
                      { text: 'Пропустить', callback_data: 'skip_photo' }
                    ]]
                  },
                  userMessageId
                );
                await setUserState(telegramUserId, state);
              }
              break;
            case 'awaiting_cabinet_login':
              await handleCabinetLogin(update, botToken, state);
              break;
            case 'awaiting_cabinet_password':
              await handleCabinetPassword(update, botToken, state);
              break;
          }
        }
      }
    } else if (update.callback_query) {
      const telegramUserId = update.callback_query.from.id;
      const data = update.callback_query.data!;

      if (data.startsWith('noshow_approve:') || data.startsWith('noshow_reject:') || data.startsWith('nsa:') || data.startsWith('nsr:')) {
        await handleNoShowAction(update, botToken, partnerId, data);
      } else if (data.startsWith('accept_replacement:')) {
        await handleAcceptReplacement(update, botToken, partnerId, data);
      } else if (data.startsWith('eta_replacement:')) {
        await handleEtaReplacement(update, botToken, partnerId, data);
      } else if (data === 'show_credentials') {
        await handleShowCredentials(update, botToken, partnerId);
      } else if (data === 'cancel_credentials') {
        await handleCancelCredentials(update, botToken);
      } else {
        const state = await getUserState(telegramUserId);

        if (state) {
          if (data.startsWith('position_')) {
            await handlePosition(update, botToken, state);
          } else if (data.startsWith('branch_')) {
            await handleBranch(update, botToken, state);
          } else if (data === 'skip_photo') {
            await handleSkipPhoto(update, botToken, state);
          } else if (data === 'change_cabinet_credentials') {
            await handleCabinetChangeConfirm(update, botToken, state, true);
          } else if (data === 'keep_cabinet_credentials') {
            await handleCabinetChangeConfirm(update, botToken, state, false);
          }
        }
      }
    }

    if (finalMessageToDelete) {
      EdgeRuntime.waitUntil(
        deleteMessageDelayed(botToken, finalMessageToDelete.chatId, finalMessageToDelete.messageId, 180000)
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});