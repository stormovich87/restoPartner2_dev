import { useState, useEffect } from 'react';
import { X, Save, Trash2, Settings, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

interface HistorySettingsModalProps {
  partnerId: string;
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

interface HistorySettings {
  history_retention_days: number | null;
  history_auto_cleanup_enabled: boolean;
}

export default function HistorySettingsModal({
  partnerId,
  isOpen,
  onClose,
  onSettingsUpdated,
}: HistorySettingsModalProps) {
  const [settings, setSettings] = useState<HistorySettings>({
    history_retention_days: null,
    history_auto_cleanup_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaningManually, setCleaningManually] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, partnerId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('partner_settings')
        .select('history_retention_days, history_auto_cleanup_enabled')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          history_retention_days: data.history_retention_days,
          history_auto_cleanup_enabled: data.history_auto_cleanup_enabled || false,
        });
      }
    } catch (error) {
      console.error('Error loading history settings:', error);
      setMessage({ type: 'error', text: 'Ошибка загрузки настроек' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      if (settings.history_auto_cleanup_enabled && (!settings.history_retention_days || settings.history_retention_days < 1)) {
        setMessage({ type: 'error', text: 'Укажите период хранения для автоматической очистки' });
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('partner_settings')
        .update({
          history_retention_days: settings.history_retention_days,
          history_auto_cleanup_enabled: settings.history_auto_cleanup_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('partner_id', partnerId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Настройки сохранены' });
      await logger.info(partnerId, 'history_settings', 'Настройки истории обновлены', {
        history_retention_days: settings.history_retention_days,
        history_auto_cleanup_enabled: settings.history_auto_cleanup_enabled,
      });

      onSettingsUpdated();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error saving history settings:', error);
      setMessage({ type: 'error', text: 'Ошибка сохранения настроек' });
    } finally {
      setSaving(false);
    }
  };

  const handleManualCleanup = async () => {
    if (!settings.history_retention_days || settings.history_retention_days < 1) {
      setMessage({ type: 'error', text: 'Укажите период хранения для очистки' });
      return;
    }

    if (!confirm(`Вы уверены, что хотите удалить все заказы старше ${settings.history_retention_days} дней? Это действие необратимо.`)) {
      return;
    }

    setCleaningManually(true);
    setMessage(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cleanup-archived-orders`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partner_id: partnerId,
            retention_days: settings.history_retention_days,
            mode: 'manual',
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при очистке истории');
      }

      const deletedCount = data.results?.[0]?.deleted_count || 0;
      setMessage({
        type: 'success',
        text: `Очистка завершена. Удалено заказов: ${deletedCount}`,
      });

      await logger.info(partnerId, 'history_cleanup', 'Ручная очистка истории', {
        retention_days: settings.history_retention_days,
        deleted_count: deletedCount,
      });

      onSettingsUpdated();
    } catch (error) {
      console.error('Error during manual cleanup:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Ошибка при очистке истории' });
      await logger.error(partnerId, 'history_cleanup', 'Ошибка ручной очистки', { error: String(error) });
    } finally {
      setCleaningManually(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6" />
            <h2 className="text-xl font-bold">Настройки истории заказов</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {message && (
          <div
            className={`mx-6 mt-6 p-4 rounded-xl flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-gray-500">Загрузка настроек...</div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                Настройте автоматическую очистку старых заказов из истории. Заказы старше указанного периода будут автоматически удаляться каждую ночь в 3:00.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span>Период хранения истории (дни)</span>
                </div>
              </label>
              <input
                type="number"
                min="1"
                value={settings.history_retention_days || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    history_retention_days: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Оставьте пустым для хранения всей истории"
              />
              <p className="mt-2 text-sm text-gray-600">
                Заказы старше указанного количества дней будут удалены. Оставьте пустым, чтобы хранить всю историю.
              </p>
            </div>

            <div className="border-t pt-6">
              <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={settings.history_auto_cleanup_enabled}
                  onChange={(e) =>
                    setSettings({ ...settings, history_auto_cleanup_enabled: e.target.checked })
                  }
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-900">
                    Включить автоматическую очистку
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                    Система будет автоматически удалять старые заказы каждую ночь в 3:00
                  </p>
                </div>
              </label>
            </div>

            <div className="border-t pt-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-semibold text-amber-900 mb-2">Ручная очистка</p>
                <p className="text-sm text-amber-800">
                  Удалить все заказы старше указанного периода прямо сейчас. Это действие необратимо.
                </p>
              </div>
              <button
                onClick={handleManualCleanup}
                disabled={cleaningManually || !settings.history_retention_days}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-5 h-5" />
                {cleaningManually ? 'Очистка...' : 'Очистить историю сейчас'}
              </button>
            </div>

            <div className="flex gap-3 pt-6 border-t">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Сохранение...' : 'Сохранить настройки'}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
