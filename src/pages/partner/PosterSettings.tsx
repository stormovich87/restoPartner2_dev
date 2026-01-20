import { useState, useEffect } from 'react';
import { ArrowLeft, Check, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';

interface PosterSettingsProps {
  partnerId: string;
  onBack: () => void;
}

export default function PosterSettings({ partnerId, onBack }: PosterSettingsProps) {
  const [posterAccount, setPosterAccount] = useState('');
  const [posterApiToken, setPosterApiToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, [partnerId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('partner_settings')
        .select('poster_account, poster_api_token')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPosterAccount(data.poster_account || '');
        setPosterApiToken(data.poster_api_token || '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setStatus({ type: 'error', message: 'Ошибка загрузки настроек' });
      await logger.error(partnerId, 'poster', 'Ошибка загрузки настроек Poster', { error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setStatus(null);

      const { error } = await supabase
        .from('partner_settings')
        .update({
          poster_account: posterAccount || null,
          poster_api_token: posterApiToken || null
        })
        .eq('partner_id', partnerId);

      if (error) throw error;

      setStatus({ type: 'success', message: 'Настройки сохранены' });
      await logger.info(partnerId, 'poster', 'Настройки Poster обновлены');
    } catch (error) {
      console.error('Error saving settings:', error);
      setStatus({ type: 'error', message: 'Ошибка сохранения настроек' });
      await logger.error(partnerId, 'poster', 'Ошибка сохранения настроек Poster', { error: String(error) });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    try {
      setTesting(true);
      setStatus(null);

      if (!posterAccount || !posterApiToken) {
        setStatus({ type: 'error', message: 'Заполните аккаунт и токен' });
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/poster-sync`;
      console.log('[TEST] Testing connection, calling:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partner_id: partnerId,
          action: 'test'
        })
      });

      console.log('[TEST] Response status:', response.status);

      const result = await response.json();
      console.log('[TEST] Response result:', result);

      if (result.success) {
        setStatus({ type: 'success', message: 'Poster API: соединение успешно' });

        try {
          await logger.info(partnerId, 'poster', 'Успешная проверка соединения с Poster API');
        } catch (logError) {
          console.error('[TEST] Failed to log success (non-critical):', logError);
        }
      } else {
        setStatus({ type: 'error', message: `Ошибка: ${result.error || 'Проверьте аккаунт и токен'}` });

        try {
          await logger.error(partnerId, 'poster', 'Ошибка проверки соединения с Poster API', { error: result.error });
        } catch (logError) {
          console.error('[TEST] Failed to log error (non-critical):', logError);
        }
      }
    } catch (error) {
      console.error('[TEST] Test connection failed with error:', error);
      setStatus({ type: 'error', message: 'Ошибка соединения с Poster' });

      try {
        await logger.error(partnerId, 'poster', 'Ошибка тестирования соединения Poster', { error: String(error) });
      } catch (logError) {
        console.error('[TEST] Failed to log error (non-critical):', logError);
      }
    } finally {
      setTesting(false);
    }
  };

  const syncMenu = async () => {
    let syncSucceeded = false;
    let syncStats = null;
    let criticalError = false;

    try {
      setSyncing(true);
      setStatus({ type: 'info', message: 'Синхронизация меню...' });

      if (!posterAccount || !posterApiToken) {
        setStatus({ type: 'error', message: 'Сначала настройте и сохраните аккаунт и токен' });
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/poster-sync`;
      console.log('[SYNC] Step 1: Starting sync');
      console.log('[SYNC] API URL:', apiUrl);
      console.log('[SYNC] Request payload:', { partner_id: partnerId, action: 'sync' });

      let response;
      try {
        console.log('[SYNC] Step 2: Sending fetch request...');
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partner_id: partnerId,
            action: 'sync'
          })
        });
        console.log('[SYNC] Step 3: Fetch completed, status:', response.status, response.statusText);
      } catch (fetchError) {
        console.error('[SYNC] CRITICAL: Fetch request failed:', fetchError);
        criticalError = true;
        throw new Error(`Не удалось подключиться к серверу синхронизации: ${fetchError.message}`);
      }

      let result;
      try {
        console.log('[SYNC] Step 4: Parsing JSON response...');
        const responseText = await response.text();
        console.log('[SYNC] Response text (first 500 chars):', responseText.substring(0, 500));
        result = JSON.parse(responseText);
        console.log('[SYNC] Step 5: JSON parsed successfully:', result);
      } catch (parseError) {
        console.error('[SYNC] CRITICAL: Failed to parse response:', parseError);
        criticalError = true;
        throw new Error('Получен некорректный ответ от сервера');
      }

      if (result.success) {
        console.log('[SYNC] Step 6: Sync reported as successful');
        syncSucceeded = true;
        syncStats = result.stats || {};

        console.log('[SYNC] Stats:', syncStats);

        setStatus({
          type: 'success',
          message: `Меню успешно синхронизировано! Категорий: ${syncStats.categories || 0}, Товаров: ${syncStats.products || 0}, Модификаторов: ${syncStats.modifiers || 0}, Связей: ${syncStats.productModifiers || 0}`
        });

        console.log('[SYNC] Step 7: Attempting to log success (non-critical)...');
        try {
          await logger.info(partnerId, 'poster', 'Успешная синхронизация меню Poster', { stats: syncStats });
          console.log('[SYNC] Step 8: Success logged');
        } catch (logError) {
          console.warn('[SYNC] Non-critical: Failed to log success:', logError);
        }
      } else {
        console.error('[SYNC] CRITICAL: Sync reported as failed:', result.error);
        criticalError = true;
        setStatus({ type: 'error', message: `Ошибка синхронизации: ${result.error}` });

        try {
          await logger.error(partnerId, 'poster', 'Ошибка синхронизации меню Poster', { error: result.error });
        } catch (logError) {
          console.warn('[SYNC] Non-critical: Failed to log error:', logError);
        }
      }
    } catch (error) {
      console.error('[SYNC] Exception caught:', error);
      console.error('[SYNC] Error details:', {
        message: error.message,
        stack: error.stack,
        type: error.constructor.name
      });

      if (syncSucceeded && !criticalError) {
        console.log('[SYNC] Data was synced successfully, non-critical error in post-processing');
        setStatus({
          type: 'success',
          message: `Меню синхронизировано! Категорий: ${syncStats?.categories || 0}, Товаров: ${syncStats?.products || 0}, Модификаторов: ${syncStats?.modifiers || 0}, Связей: ${syncStats?.productModifiers || 0}`
        });
      } else {
        console.error('[SYNC] Critical error during sync');
        setStatus({
          type: 'error',
          message: error.message || 'Ошибка синхронизации меню'
        });
      }

      if (!syncSucceeded) {
        try {
          await logger.error(partnerId, 'poster', 'Ошибка синхронизации меню Poster', {
            error: String(error),
            criticalError,
            syncSucceeded
          });
        } catch (logError) {
          console.warn('[SYNC] Non-critical: Failed to log error:', logError);
        }
      }
    } finally {
      console.log('[SYNC] Cleanup: Setting syncing to false');
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold">Интеграция с Poster</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">Настройки API</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Аккаунт Poster
              </label>
              <input
                type="text"
                value={posterAccount}
                onChange={(e) => setPosterAccount(e.target.value)}
                placeholder="934186"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-500">
                Имя аккаунта без .joinposter.com
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API токен Poster
              </label>
              <input
                type="password"
                value={posterApiToken}
                onChange={(e) => setPosterApiToken(e.target.value)}
                placeholder="934186:xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-500">
                Формат: account:apikey
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Сохранить настройки
              </>
            )}
          </button>

          <button
            onClick={testConnection}
            disabled={testing || !posterAccount || !posterApiToken}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Проверка...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Проверить соединение
              </>
            )}
          </button>
        </div>

        {status && (
          <div
            className={`p-4 rounded-lg flex items-start gap-3 ${
              status.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : status.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            {status.type === 'success' ? (
              <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : status.type === 'error' ? (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <Loader2 className="w-5 h-5 flex-shrink-0 mt-0.5 animate-spin" />
            )}
            <p className="text-sm">{status.message}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Синхронизация меню</h2>

        <p className="text-sm text-gray-600 mb-4">
          Импортирует категории, товары, модификаторы и их связи из Poster в вашу CRM.
        </p>

        <button
          onClick={syncMenu}
          disabled={syncing || !posterAccount || !posterApiToken}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
        >
          {syncing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Синхронизация...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              Синхронизировать меню Poster
            </>
          )}
        </button>
      </div>
    </div>
  );
}
