import { useState, useEffect } from 'react';
import { X, Bot, Key, Power, UserPlus, Save, Loader2, Link } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EmployeeBotSettingsModalProps {
  partnerId: string;
  onClose: () => void;
}

export default function EmployeeBotSettingsModal({ partnerId, onClose }: EmployeeBotSettingsModalProps) {
  const [botToken, setBotToken] = useState('');
  const [botEnabled, setBotEnabled] = useState(false);
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [webhookSuccess, setWebhookSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [partnerId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('partner_settings')
        .select('employee_bot_token, employee_bot_enabled, employee_bot_allow_registration')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBotToken(data.employee_bot_token || '');
        setBotEnabled(data.employee_bot_enabled || false);
        setAllowRegistration(data.employee_bot_allow_registration ?? true);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setError('Ошибка загрузки настроек');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { error } = await supabase
        .from('partner_settings')
        .update({
          employee_bot_token: botToken.trim() || null,
          employee_bot_enabled: botEnabled,
          employee_bot_allow_registration: allowRegistration,
          updated_at: new Date().toISOString()
        })
        .eq('partner_id', partnerId);

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  const handleSetupWebhook = async () => {
    if (!botToken.trim()) {
      setError('Введите Bot Token перед настройкой webhook');
      return;
    }

    setSettingWebhook(true);
    setError(null);
    setWebhookSuccess(false);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const webhookUrl = `${supabaseUrl}/functions/v1/employee-registration-bot?partner_id=${partnerId}`;
      const telegramApiUrl = `https://api.telegram.org/bot${botToken.trim()}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

      const response = await fetch(telegramApiUrl);
      const result = await response.json();

      if (result.ok) {
        setWebhookSuccess(true);
        setTimeout(() => setWebhookSuccess(false), 3000);
      } else {
        setError(`Ошибка настройки webhook: ${result.description || 'Неизвестная ошибка'}`);
      }
    } catch (err) {
      console.error('Error setting webhook:', err);
      setError('Ошибка при настройке webhook');
    } finally {
      setSettingWebhook(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Бот для работы с сотрудниками</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/80 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-sm text-blue-800 leading-relaxed">
              Этот Telegram-бот используется для регистрации новых сотрудников,
              обновления их данных и взаимодействия с сотрудниками компании.
              Бот работает только в рамках текущего партнёра.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              Настройки успешно сохранены
            </div>
          )}

          {webhookSuccess && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              Webhook успешно настроен
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Key className="w-4 h-4 inline mr-1.5" />
              Bot Token
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono text-sm"
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              />
              <button
                onClick={handleSetupWebhook}
                disabled={settingWebhook || !botToken.trim()}
                className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                title="Настроить webhook"
              >
                {settingWebhook ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Настройка...</span>
                  </>
                ) : (
                  <>
                    <Link className="w-4 h-4" />
                    <span className="hidden sm:inline">Webhook</span>
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Получите токен у @BotFather в Telegram
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              <Power className={`w-5 h-5 ${botEnabled ? 'text-green-600' : 'text-gray-400'}`} />
              <div>
                <div className="font-semibold text-gray-900">Статус бота</div>
                <div className="text-sm text-gray-500">
                  {botEnabled ? 'Бот включен и работает' : 'Бот выключен'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setBotEnabled(!botEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                botEnabled ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  botEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Разрешённые действия</h3>

            <div className="p-4 border border-gray-200 rounded-xl">
              <div className="flex items-start gap-3">
                <UserPlus className={`w-5 h-5 flex-shrink-0 mt-0.5 ${allowRegistration ? 'text-blue-600' : 'text-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-gray-900">Работа с данными сотрудников</div>
                    <button
                      onClick={() => setAllowRegistration(!allowRegistration)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        allowRegistration ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          allowRegistration ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Команда <code className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">/start</code> для регистрации или обновления данных
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-gray-700 hover:bg-gray-200 rounded-xl transition-all font-semibold"
          >
            Закрыть
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all font-semibold disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Сохранить
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
