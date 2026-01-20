import { useState, useEffect } from 'react';
import { X, Copy, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { checkBotTokenUniqueness, getConflictMessage } from '../lib/botTokenValidator';

interface ExternalCouriersSettingsModalProps {
  partnerId: string;
  onClose: () => void;
}

export default function ExternalCouriersSettingsModal({ partnerId, onClose }: ExternalCouriersSettingsModalProps) {
  const [botToken, setBotToken] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [finalButtonEnabled, setFinalButtonEnabled] = useState(false);
  const [finalButtonText, setFinalButtonText] = useState('');
  const [finalButtonUrl, setFinalButtonUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [botTokenError, setBotTokenError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [partnerId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('partner_settings')
        .select('external_courier_bot_token, external_courier_bot_username, external_courier_final_button_enabled, external_courier_final_button_text, external_courier_final_button_url')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBotToken(data.external_courier_bot_token || '');
        setBotUsername(data.external_courier_bot_username || '');
        setFinalButtonEnabled(data.external_courier_final_button_enabled || false);
        setFinalButtonText(data.external_courier_final_button_text || '');
        setFinalButtonUrl(data.external_courier_final_button_url || '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      alert('Ошибка загрузки настроек');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!botToken.trim()) {
      alert('Введите токен бота');
      return;
    }

    if (finalButtonEnabled) {
      if (!finalButtonText.trim()) {
        alert('Введите текст кнопки');
        return;
      }
      if (!finalButtonUrl.trim()) {
        alert('Введите ссылку приглашения');
        return;
      }
    }

    setBotTokenError(null);

    try {
      const { isUnique, conflictType } = await checkBotTokenUniqueness(partnerId, botToken, 'external_courier');
      if (!isUnique) {
        setBotTokenError(`Ошибка: ${getConflictMessage(conflictType || '')}`);
        return;
      }

      setSaving(true);

      const { error } = await supabase
        .from('partner_settings')
        .update({
          external_courier_bot_token: botToken.trim(),
          external_courier_bot_username: botUsername.trim() || null,
          external_courier_final_button_enabled: finalButtonEnabled,
          external_courier_final_button_text: finalButtonEnabled ? finalButtonText.trim() : null,
          external_courier_final_button_url: finalButtonEnabled ? finalButtonUrl.trim() : null,
        })
        .eq('partner_id', partnerId);

      if (error) throw error;

      if (botToken.trim()) {
        await setupWebhook();
      }

      alert('Настройки сохранены');
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  const setupWebhook = async () => {
    try {
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-courier-registration-bot?token=${encodeURIComponent(botToken.trim())}`;

      const response = await fetch(`https://api.telegram.org/bot${botToken.trim()}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query']
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to setup webhook');
      }
    } catch (error) {
      console.error('Error setting up webhook:', error);
    }
  };

  const copyWebhookUrl = () => {
    if (!botToken.trim()) {
      alert('Сначала введите токен бота');
      return;
    }

    const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-courier-registration-bot?token=${encodeURIComponent(botToken.trim())}`;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600">Загрузка...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-gray-900">Настройки бота для сторонних курьеров</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Информация</h4>
            <p className="text-sm text-blue-700">
              Этот бот будет использоваться для регистрации сторонних курьеров.
              Сторонние курьеры могут принимать заказы, но не отображаются в списке для ручного назначения.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Токен бота Telegram
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={botToken}
              onChange={(e) => {
                setBotToken(e.target.value);
                setBotTokenError(null);
              }}
              placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all ${
                botTokenError
                  ? 'border-red-500 focus:ring-red-500 bg-red-50'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {botTokenError && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{botTokenError}</p>
              </div>
            )}
            {!botTokenError && (
              <p className="text-xs text-gray-500 mt-1">
                Получите токен у @BotFather в Telegram
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Имя пользователя бота (необязательно)
            </label>
            <input
              type="text"
              value={botUsername}
              onChange={(e) => setBotUsername(e.target.value)}
              placeholder="@your_external_courier_bot"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <p className="text-xs text-gray-500 mt-1">
              Для удобства отображения
            </p>
          </div>

          {botToken && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Webhook URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-courier-registration-bot?token=...`}
                  readOnly
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-600 text-sm"
                />
                <button
                  onClick={copyWebhookUrl}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600">Скопировано</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-600">Копировать</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Webhook будет настроен автоматически при сохранении
              </p>
            </div>
          )}

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">Финальная кнопка</h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={finalButtonEnabled}
                  onChange={(e) => setFinalButtonEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {finalButtonEnabled && (
              <div className="space-y-3 mt-4 pt-4 border-t border-green-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Текст кнопки
                  </label>
                  <input
                    type="text"
                    value={finalButtonText}
                    onChange={(e) => setFinalButtonText(e.target.value)}
                    placeholder="Перейти в группу курьеров"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ссылка-приглашение в группу
                  </label>
                  <input
                    type="text"
                    value={finalButtonUrl}
                    onChange={(e) => setFinalButtonUrl(e.target.value)}
                    placeholder="https://t.me/+abc123xyz"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Создайте ссылку-приглашение в настройках вашей группы Telegram
                  </p>
                </div>
                <p className="text-xs text-green-700 bg-green-50 p-2 rounded">
                  Эта кнопка будет показана курьеру только после успешной регистрации
                </p>
              </div>
            )}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Как это работает:</h4>
            <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
              <li>Сторонний курьер пишет /start вашему боту</li>
              <li>Бот запрашивает имя, фамилию, телефон и тип транспорта</li>
              <li>После регистрации курьер добавляется в раздел "Сторонние курьеры"</li>
              <li>Курьер может принимать заказы от исполнителей с включенной опцией</li>
            </ol>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-semibold text-amber-900 mb-2">Редактирование данных:</h4>
            <p className="text-sm text-amber-700">
              Курьер может изменить свои данные (ФИО, телефон, тип транспорта), отправив боту команду <code className="px-2 py-0.5 bg-amber-100 rounded font-mono text-xs">/editregis</code>
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !botToken.trim()}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
