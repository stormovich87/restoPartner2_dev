import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Clock, Save, AlertCircle, Globe, MapPin, CheckCircle, Search, Bot, Phone } from 'lucide-react';
import { logger } from '../../lib/logger';
import { testGoogleMapsConnection } from '../../lib/googleMaps';
import { loadGoogleMapsScript } from '../../lib/googleMapsLoader';
import { checkBotTokenUniqueness, getConflictMessage } from '../../lib/botTokenValidator';

interface GeneralSettingsProps {
  partnerId: string;
}

interface PartnerSettings {
  id?: string;
  partner_id: string;
  order_completion_norm_minutes: number;
  timezone: string;
  currency_code?: string;
  currency_symbol?: string;
  google_maps_api_key?: string;
  default_map_address?: string;
  default_map_lat?: number;
  default_map_lng?: number;
  courier_bot_token?: string;
  courier_bot_enabled?: boolean;
  external_courier_bot_token?: string;
  completion_radius_meters?: number;
  require_courier_location_on_completion?: boolean;
  business_hours_open?: string;
  business_hours_close?: string;
  is_24_hours?: boolean;
  min_pickup_order_amount?: number | null;
  binotel_api_key?: string;
  binotel_secret_key?: string;
  binotel_company_id?: string;
  binotel_enabled?: boolean;
}

export default function GeneralSettings({ partnerId }: GeneralSettingsProps) {
  const [settings, setSettings] = useState<PartnerSettings>({
    partner_id: partnerId,
    order_completion_norm_minutes: 60,
    timezone: 'UTC',
    currency_code: 'UAH',
    currency_symbol: '₴',
    google_maps_api_key: '',
    completion_radius_meters: 100,
    require_courier_location_on_completion: false,
    business_hours_open: '09:00',
    business_hours_close: '21:00',
    is_24_hours: false,
    min_pickup_order_amount: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [geocodingDefaultMap, setGeocodingDefaultMap] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [testingBinotel, setTestingBinotel] = useState(false);
  const [courierBotError, setCourierBotError] = useState<string | null>(null);
  const [externalBotError, setExternalBotError] = useState<string | null>(null);

  const defaultMapRef = useRef<HTMLDivElement>(null);
  const defaultMapInstanceRef = useRef<google.maps.Map | null>(null);
  const defaultMarkerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    loadSettings();
  }, [partnerId]);

  useEffect(() => {
    if (settings.google_maps_api_key && settings.default_map_lat && settings.default_map_lng) {
      initializeDefaultMap();
    }
  }, [settings.google_maps_api_key, settings.default_map_lat, settings.default_map_lng]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('partner_settings')
        .select('*')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      await logger.error(partnerId, 'settings', 'Ошибка загрузки настроек', { error: String(error) });
      setMessage({ type: 'error', text: 'Ошибка загрузки настроек' });
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultMap = async () => {
    if (!settings.google_maps_api_key || !defaultMapRef.current || !settings.default_map_lat || !settings.default_map_lng) {
      return;
    }

    try {
      await loadGoogleMapsScript(settings.google_maps_api_key);

      if (!defaultMapRef.current) {
        console.warn('Map container element not found');
        return;
      }

      const position = { lat: settings.default_map_lat, lng: settings.default_map_lng };

      if (!defaultMapInstanceRef.current) {
        defaultMapInstanceRef.current = new google.maps.Map(defaultMapRef.current, {
          center: position,
          zoom: 14,
        });

        defaultMapInstanceRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const newLat = e.latLng.lat();
            const newLng = e.latLng.lng();
            setSettings({
              ...settings,
              default_map_lat: newLat,
              default_map_lng: newLng,
            });
            updateDefaultMarker(newLat, newLng);
          }
        });
      } else {
        defaultMapInstanceRef.current.setCenter(position);
      }

      updateDefaultMarker(settings.default_map_lat, settings.default_map_lng);
    } catch (error) {
      console.error('Error initializing default map:', error);
    }
  };

  const updateDefaultMarker = (lat: number, lng: number) => {
    if (!defaultMapInstanceRef.current) return;

    const position = { lat, lng };

    if (defaultMarkerRef.current) {
      defaultMarkerRef.current.setPosition(position);
    } else {
      defaultMarkerRef.current = new google.maps.Marker({
        position,
        map: defaultMapInstanceRef.current,
        draggable: true,
      });

      defaultMarkerRef.current.addListener('dragend', () => {
        if (defaultMarkerRef.current) {
          const newPosition = defaultMarkerRef.current.getPosition();
          if (newPosition) {
            setSettings({
              ...settings,
              default_map_lat: newPosition.lat(),
              default_map_lng: newPosition.lng(),
            });
          }
        }
      });
    }
  };

  const handleFindDefaultMapAddress = async () => {
    if (!settings.default_map_address?.trim()) {
      setMessage({ type: 'error', text: 'Введите адрес для поиска' });
      return;
    }

    if (!settings.google_maps_api_key) {
      setMessage({ type: 'error', text: 'Сначала настройте Google Maps API ключ' });
      return;
    }

    setGeocodingDefaultMap(true);
    setMessage(null);

    try {
      await loadGoogleMapsScript(settings.google_maps_api_key);
      const geocoder = new google.maps.Geocoder();

      geocoder.geocode({ address: settings.default_map_address }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          const result = results[0];
          const location = result.geometry.location;

          setSettings({
            ...settings,
            default_map_lat: location.lat(),
            default_map_lng: location.lng(),
            default_map_address: result.formatted_address,
          });

          setMessage({ type: 'success', text: 'Адрес найден! Не забудьте сохранить настройки.' });
        } else {
          setMessage({ type: 'error', text: 'Не удалось найти адрес. Проверьте правильность ввода.' });
        }
        setGeocodingDefaultMap(false);
      });
    } catch (error) {
      console.error('Geocoding error:', error);
      setMessage({ type: 'error', text: 'Ошибка при поиске адреса' });
      setGeocodingDefaultMap(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setCourierBotError(null);
    setExternalBotError(null);

    try {
      if (settings.order_completion_norm_minutes < 1) {
        setMessage({ type: 'error', text: 'Норма выполнения должна быть больше 0 минут' });
        setSaving(false);
        return;
      }

      if (settings.courier_bot_token) {
        const { isUnique, conflictType } = await checkBotTokenUniqueness(partnerId, settings.courier_bot_token, 'courier');
        if (!isUnique) {
          setCourierBotError(`Ошибка: ${getConflictMessage(conflictType || '')}`);
          setSaving(false);
          return;
        }
      }

      if (settings.external_courier_bot_token) {
        const { isUnique, conflictType } = await checkBotTokenUniqueness(partnerId, settings.external_courier_bot_token, 'external_courier');
        if (!isUnique) {
          setExternalBotError(`Ошибка: ${getConflictMessage(conflictType || '')}`);
          setSaving(false);
          return;
        }
      }

      if (settings.id) {
        const { error } = await supabase
          .from('partner_settings')
          .update({
            order_completion_norm_minutes: settings.order_completion_norm_minutes,
            timezone: settings.timezone,
            currency_code: settings.currency_code || 'UAH',
            currency_symbol: settings.currency_symbol || '₴',
            google_maps_api_key: settings.google_maps_api_key || null,
            default_map_address: settings.default_map_address || null,
            default_map_lat: settings.default_map_lat || null,
            default_map_lng: settings.default_map_lng || null,
            courier_bot_token: settings.courier_bot_token || null,
            courier_bot_enabled: settings.courier_bot_enabled || false,
            completion_radius_meters: settings.completion_radius_meters || 100,
            require_courier_location_on_completion: settings.require_courier_location_on_completion || false,
            business_hours_open: settings.business_hours_open || '09:00',
            business_hours_close: settings.business_hours_close || '21:00',
            is_24_hours: settings.is_24_hours || false,
            min_pickup_order_amount: settings.min_pickup_order_amount || null,
            binotel_api_key: settings.binotel_api_key || null,
            binotel_secret_key: settings.binotel_secret_key || null,
            binotel_company_id: settings.binotel_company_id || null,
            binotel_enabled: settings.binotel_enabled || false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('partner_settings')
          .insert({
            partner_id: partnerId,
            order_completion_norm_minutes: settings.order_completion_norm_minutes,
            timezone: settings.timezone,
            currency_code: settings.currency_code || 'UAH',
            currency_symbol: settings.currency_symbol || '₴',
            google_maps_api_key: settings.google_maps_api_key || null,
            default_map_address: settings.default_map_address || null,
            default_map_lat: settings.default_map_lat || null,
            default_map_lng: settings.default_map_lng || null,
            courier_bot_token: settings.courier_bot_token || null,
            courier_bot_enabled: settings.courier_bot_enabled || false,
            completion_radius_meters: settings.completion_radius_meters || 100,
            require_courier_location_on_completion: settings.require_courier_location_on_completion || false,
            business_hours_open: settings.business_hours_open || '09:00',
            business_hours_close: settings.business_hours_close || '21:00',
            is_24_hours: settings.is_24_hours || false,
            min_pickup_order_amount: settings.min_pickup_order_amount || null,
            binotel_api_key: settings.binotel_api_key || null,
            binotel_secret_key: settings.binotel_secret_key || null,
            binotel_company_id: settings.binotel_company_id || null,
            binotel_enabled: settings.binotel_enabled || false,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setSettings(data);
      }

      setMessage({ type: 'success', text: 'Настройки успешно сохранены' });
      await logger.info(partnerId, 'settings', 'Настройки обновлены', {
        order_completion_norm_minutes: settings.order_completion_norm_minutes,
        timezone: settings.timezone,
        google_maps_api_key: settings.google_maps_api_key ? '***' : null,
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      await logger.error(partnerId, 'settings', 'Ошибка сохранения настроек', { error: String(error) });
      setMessage({ type: 'error', text: 'Ошибка сохранения настроек' });
    } finally {
      setSaving(false);
    }
  };

  const testGoogleMapsApi = async () => {
    if (!settings.google_maps_api_key) {
      setMessage({ type: 'error', text: 'Введите API ключ для проверки' });
      return;
    }

    setTestingApi(true);
    setMessage(null);

    try {
      const result = await testGoogleMapsConnection(settings.google_maps_api_key, partnerId);

      setMessage({
        type: result.success ? 'success' : 'error',
        text: result.message
      });

      if (result.success) {
        await logger.info(partnerId, 'settings', 'Google Maps API проверка успешна', { status: 'OK' });
      } else {
        await logger.error(partnerId, 'settings', 'Google Maps API проверка неудачна', {
          message: result.message
        });
      }
    } catch (error) {
      console.error('Error testing Google Maps API:', error);
      setMessage({ type: 'error', text: 'Ошибка при проверке подключения к Google Maps API' });
      await logger.error(partnerId, 'settings', 'Ошибка проверки Google Maps API', { error: String(error) });
    } finally {
      setTestingApi(false);
    }
  };

  const testBinotelIntegration = async () => {
    if (!settings.binotel_company_id) {
      setMessage({ type: 'error', text: 'Введите Company ID для тестирования' });
      return;
    }

    setTestingBinotel(true);
    setMessage(null);

    try {
      const testPhone = '+38 (067) 123 45 67';

      console.log('[Binotel Test] Sending test call with company ID:', settings.binotel_company_id);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/binotel-incoming-call`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            requestType: 'test',
            externalNumber: testPhone,
            internalNumber: '101',
            pbxNumber: '0800123456',
            callType: '0',
            companyID: settings.binotel_company_id,
          }).toString(),
        }
      );

      console.log('[Binotel Test] Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[Binotel Test] Response body:', result);

      if (result.status === 'success') {
        setMessage({
          type: 'success',
          text: `Тестовый звонок отправлен! Номер: ${testPhone}. Откройте консоль браузера (F12) для отладки.`
        });
        await logger.info(partnerId, 'settings', 'Binotel тест успешен', { phone: testPhone });
      } else {
        throw new Error('Unexpected response from webhook');
      }
    } catch (error) {
      console.error('[Binotel Test] Error:', error);
      setMessage({ type: 'error', text: 'Ошибка при тестировании интеграции с Binotel' });
      await logger.error(partnerId, 'settings', 'Ошибка тестирования Binotel', { error: String(error) });
    } finally {
      setTestingBinotel(false);
    }
  };

  const setupWebhook = async () => {
    if (!settings.courier_bot_token) {
      setMessage({ type: 'error', text: 'Введите токен бота' });
      return;
    }

    setSettingWebhook(true);
    setMessage(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/setup-courier-webhook`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partner_id: partnerId
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `Webhook успешно установлен: ${data.webhook_url}` });
        await logger.info(partnerId, 'settings', 'Telegram webhook для кнопки отмены установлен', {
          webhookUrl: data.webhook_url,
          webhookInfo: data.webhook_info
        });
      } else {
        setMessage({ type: 'error', text: `Ошибка: ${data.error || 'Неизвестная ошибка'}` });
        await logger.error(partnerId, 'settings', 'Ошибка установки webhook', { error: data });
      }
    } catch (error) {
      console.error('Error setting webhook:', error);
      setMessage({ type: 'error', text: 'Ошибка при установке webhook' });
      await logger.error(partnerId, 'settings', 'Ошибка установки webhook', { error: String(error) });
    } finally {
      setSettingWebhook(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-8 text-center">
        <p className="text-gray-600">Загрузка настроек...</p>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Общие настройки</h2>

      {message && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-blue-600" />
              <span>Норма выполнения заказа (минуты)</span>
            </div>
          </label>
          <input
            type="number"
            min="1"
            value={settings.order_completion_norm_minutes}
            onChange={(e) =>
              setSettings({ ...settings, order_completion_norm_minutes: parseInt(e.target.value) || 0 })
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="60"
          />
          <p className="mt-2 text-sm text-gray-600">
            Стандартное время для выполнения заказа. При превышении этого времени заказ будет подсвечен красным
            цветом. Учитывается добавочное время и перенос заказа на будущее время.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-5 h-5 text-blue-600" />
              <span>Часовой пояс</span>
            </div>
          </label>
          <select
            value={settings.timezone}
            onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="UTC">UTC (GMT+0)</option>
            <option value="Europe/Kiev">Киев (GMT+2/+3)</option>
            <option value="Europe/Moscow">Москва (GMT+3)</option>
            <option value="Europe/Minsk">Минск (GMT+3)</option>
            <option value="Europe/Warsaw">Варшава (GMT+1/+2)</option>
            <option value="Europe/London">Лондон (GMT+0/+1)</option>
            <option value="Europe/Berlin">Берлин (GMT+1/+2)</option>
            <option value="America/New_York">Нью-Йорк (GMT-5/-4)</option>
            <option value="America/Chicago">Чикаго (GMT-6/-5)</option>
            <option value="America/Los_Angeles">Лос-Анджелес (GMT-8/-7)</option>
            <option value="Asia/Dubai">Дубай (GMT+4)</option>
            <option value="Asia/Tokyo">Токио (GMT+9)</option>
            <option value="Asia/Shanghai">Шанхай (GMT+8)</option>
          </select>
          <p className="mt-2 text-sm text-gray-600">
            Выберите часовой пояс для корректного отображения времени в заказах.
            Время будет автоматически конвертироваться в выбранный часовой пояс.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-5 h-5 text-blue-600" />
              <span>Валюта</span>
            </div>
          </label>
          <select
            value={settings.currency_code || 'UAH'}
            onChange={(e) => {
              const currencyMap: Record<string, string> = {
                'UAH': '₴',
                'RUB': '₽',
                'EUR': '€',
                'USD': '$',
                'BGN': 'лв'
              };
              setSettings({
                ...settings,
                currency_code: e.target.value,
                currency_symbol: currencyMap[e.target.value] || '₴'
              });
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="UAH">Гривна (₴)</option>
            <option value="RUB">Рубль (₽)</option>
            <option value="EUR">Евро (€)</option>
            <option value="USD">Доллар ($)</option>
            <option value="BGN">Лев (лв)</option>
          </select>
          <p className="mt-2 text-sm text-gray-600">
            Выберите валюту для отображения цен. Символ валюты будет использоваться во всех разделах системы.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-blue-600" />
              <span>Минимальный заказ для самовывоса ({settings.currency_symbol || '₴'})</span>
            </div>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={settings.min_pickup_order_amount || ''}
            onChange={(e) =>
              setSettings({ ...settings, min_pickup_order_amount: e.target.value ? parseFloat(e.target.value) : null })
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="Оставьте пустым чтобы отключить"
          />
          <p className="mt-2 text-sm text-gray-600">
            Минимальная сумма заказа для самовывоса. При оформлении заказа с самовывосом будет отображаться предупреждение,
            если сумма чека меньше указанного значения.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-blue-600" />
              <span>Google Карты / Геолокация</span>
            </div>
          </label>
          <input
            type="text"
            value={settings.google_maps_api_key || ''}
            onChange={(e) => setSettings({ ...settings, google_maps_api_key: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-sm"
            placeholder="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
          />
          <p className="mt-2 text-sm text-gray-600">
            API ключ Google Maps для геокодирования адресов, определения координат и расчёта расстояний между точками.
            Используется для логистических расчётов и оптимизации доставки.
          </p>
          <p className="mt-2 text-sm text-blue-600">
            Получить ключ можно в <a href="https://console.cloud.google.com/google/maps-apis" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-700">Google Cloud Console</a>
          </p>
          <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-semibold text-amber-900 mb-2">Настройка API ключа:</p>
            <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
              <li>Включите следующие API: <strong>Maps JavaScript API</strong></li>
              <li>В разделе "Ограничения ключей API" → "Ограничения приложений" выберите <strong>"HTTP referrers"</strong></li>
              <li>Добавьте ваш домен сайта и localhost для разработки, например:
                <ul className="ml-6 mt-1 space-y-1">
                  <li><code className="bg-amber-100 px-1 rounded">https://yourdomain.com/*</code></li>
                  <li><code className="bg-amber-100 px-1 rounded">http://localhost:5173/*</code></li>
                  <li><code className="bg-amber-100 px-1 rounded">http://localhost:*</code></li>
                  <li><code className="bg-amber-100 px-1 rounded">https://*.webcontainer.io/*</code> (для preview)</li>
                </ul>
              </li>
            </ol>
          </div>
          {settings.google_maps_api_key && (
            <button
              type="button"
              onClick={testGoogleMapsApi}
              disabled={testingApi}
              className="mt-3 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
            >
              <CheckCircle className="w-5 h-5" />
              {testingApi ? 'Проверка...' : 'Проверить подключение'}
            </button>
          )}
        </div>

        <div className="border-t pt-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-blue-600" />
              <span>График работы фирмы</span>
            </div>
          </label>
          <p className="text-sm text-gray-600 mb-4">
            Установите время работы для автоматического управления сменами
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <input
                type="checkbox"
                id="is_24_hours"
                checked={settings.is_24_hours || false}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    is_24_hours: e.target.checked,
                    business_hours_open: e.target.checked ? '00:00' : '09:00',
                    business_hours_close: e.target.checked ? '23:59' : '21:00'
                  });
                }}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="is_24_hours" className="text-sm font-medium text-gray-700 cursor-pointer">
                Круглосуточно (24/7)
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Часы открытия
                </label>
                <input
                  type="time"
                  value={settings.business_hours_open || '09:00'}
                  onChange={(e) => setSettings({ ...settings, business_hours_open: e.target.value })}
                  disabled={settings.is_24_hours}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Часы закрытия
                </label>
                <input
                  type="time"
                  value={settings.business_hours_close || '21:00'}
                  onChange={(e) => setSettings({ ...settings, business_hours_close: e.target.value })}
                  disabled={settings.is_24_hours}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-blue-600" />
              <span>Настройка карты по умолчанию</span>
            </div>
          </label>
          <p className="text-sm text-gray-600 mb-4">
            Укажите начальную точку карты, которая будет использоваться по умолчанию при создании филиалов и заказов.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Адрес точки по умолчанию
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.default_map_address || ''}
                  onChange={(e) => setSettings({ ...settings, default_map_address: e.target.value })}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Москва, Красная площадь"
                />
                <button
                  type="button"
                  onClick={handleFindDefaultMapAddress}
                  disabled={geocodingDefaultMap || !settings.google_maps_api_key}
                  className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
                  title={!settings.google_maps_api_key ? 'Сначала настройте Google Maps API ключ' : 'Найти адрес'}
                >
                  <Search className="w-5 h-5" />
                  {geocodingDefaultMap ? 'Поиск...' : 'Найти'}
                </button>
              </div>
            </div>

            {settings.default_map_lat && settings.default_map_lng && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Широта
                    </label>
                    <input
                      type="text"
                      value={settings.default_map_lat.toFixed(6)}
                      readOnly
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-600 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Долгота
                    </label>
                    <input
                      type="text"
                      value={settings.default_map_lng.toFixed(6)}
                      readOnly
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-600 font-mono text-sm"
                    />
                  </div>
                </div>

                <div
                  ref={defaultMapRef}
                  className="w-full h-96 bg-gray-200 rounded-lg overflow-hidden border border-gray-300"
                />

                <p className="text-xs text-gray-500">
                  Нажмите на карту или перетащите маркер для изменения координат точки по умолчанию
                </p>
              </>
            )}

            {!settings.default_map_lat && !settings.default_map_lng && settings.google_maps_api_key && (
              <div className="w-full h-96 bg-gray-100 rounded-lg overflow-hidden border border-gray-300 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Введите адрес и нажмите "Найти" для отображения карты</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t pt-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-5 h-5 text-blue-600" />
              <span>Интеграция с Binotel</span>
            </div>
          </label>
          <p className="text-sm text-gray-600 mb-4">
            Настройте интеграцию с Binotel для получения уведомлений о входящих звонках и автоматического создания заказов.
          </p>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  checked={settings.binotel_enabled || false}
                  onChange={(e) => setSettings({ ...settings, binotel_enabled: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Включить интеграцию с Binotel</span>
              </label>
            </div>

            {settings.binotel_enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API ключ Binotel
                  </label>
                  <input
                    type="text"
                    value={settings.binotel_api_key || ''}
                    onChange={(e) => setSettings({ ...settings, binotel_api_key: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-sm"
                    placeholder="your-api-key"
                  />
                  <p className="mt-2 text-sm text-gray-600">
                    API ключ для доступа к Binotel API
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Секретный ключ Binotel
                  </label>
                  <input
                    type="password"
                    value={settings.binotel_secret_key || ''}
                    onChange={(e) => setSettings({ ...settings, binotel_secret_key: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-sm"
                    placeholder="your-secret-key"
                  />
                  <p className="mt-2 text-sm text-gray-600">
                    Секретный ключ для верификации webhook запросов от Binotel
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company ID Binotel
                  </label>
                  <input
                    type="text"
                    value={settings.binotel_company_id || ''}
                    onChange={(e) => setSettings({ ...settings, binotel_company_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-sm"
                    placeholder="12345"
                  />
                  <p className="mt-2 text-sm text-gray-600">
                    Уникальный идентификатор компании в Binotel. Используется для маршрутизации входящих вызовов.
                    Этот параметр предоставляется службой поддержки Binotel.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook URL для API CALL SETTINGS
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/binotel-incoming-call`}
                      readOnly
                      className="w-full px-4 py-3 pr-24 border border-gray-300 bg-gray-50 rounded-xl font-mono text-sm text-gray-700 cursor-pointer"
                      onClick={(e) => {
                        e.currentTarget.select();
                        navigator.clipboard.writeText(e.currentTarget.value);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/binotel-incoming-call`;
                        navigator.clipboard.writeText(url);
                        setMessage({ type: 'success', text: 'URL скопирован в буфер обмена' });
                        setTimeout(() => setMessage(null), 3000);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Копировать
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    Скопируйте этот URL и передайте в Binotel для настройки WebHook API CALL SETTINGS.
                    Binotel будет отправлять запросы в формате x-www-form-urlencoded, а система должна
                    отвечать JSON {`{"status":"success"}`}.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook URL для API CALL COMPLETED
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/binotel-call-completed`}
                      readOnly
                      className="w-full px-4 py-3 pr-24 border border-gray-300 bg-gray-50 rounded-xl font-mono text-sm text-gray-700 cursor-pointer"
                      onClick={(e) => {
                        e.currentTarget.select();
                        navigator.clipboard.writeText(e.currentTarget.value);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/binotel-call-completed`;
                        navigator.clipboard.writeText(url);
                        setMessage({ type: 'success', text: 'URL скопирован в буфер обмена' });
                        setTimeout(() => setMessage(null), 3000);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Копировать
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    Этот URL нужен для получения данных о завершенных звонках (длительность, статус, время ожидания).
                    Если в панели Binotel нет поля "API CALL COMPLETED", обратитесь в поддержку Binotel для активации.
                  </p>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-semibold text-amber-900 mb-2">Важно для статистики ожидания:</p>
                  <p className="text-sm text-amber-800">
                    Для работы раздела "Телефония" (статистика пропущенных звонков) необходимо настроить
                    оба вебхука: CALL SETTINGS и CALL COMPLETED. Без второго вебхука данные о времени ожидания
                    и статусе звонка (ANSWER/NOANSWER/BUSY) не будут сохраняться.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-semibold text-blue-900 mb-2">Как работает интеграция:</p>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>При входящем звонке Binotel отправляет уведомление в систему</li>
                    <li>В интерфейсе появляется всплывающее окно с номером телефона</li>
                    <li>Оператор может принять звонок и создать заказ с автоматически заполненным телефоном</li>
                    <li>Если у филиала указан номер телефона, звонок автоматически привязывается к филиалу</li>
                  </ol>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={testBinotelIntegration}
                    disabled={testingBinotel || !settings.binotel_company_id}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {testingBinotel ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Тестирование...
                      </>
                    ) : (
                      <>
                        <Phone className="w-4 h-4" />
                        Тестовый входящий звонок
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="border-t pt-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-5 h-5 text-blue-600" />
              <span>Telegram-бот для регистрации курьеров</span>
            </div>
          </label>
          <p className="text-sm text-gray-600 mb-4">
            Настройте Telegram-бота для автоматической регистрации курьеров. Курьеры смогут самостоятельно зарегистрироваться через бота.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Токен бота
              </label>
              <input
                type="text"
                value={settings.courier_bot_token || ''}
                onChange={(e) => {
                  setSettings({ ...settings, courier_bot_token: e.target.value });
                  setCourierBotError(null);
                }}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all font-mono text-sm ${
                  courierBotError
                    ? 'border-red-500 focus:ring-red-500 bg-red-50'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
              />
              {courierBotError && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{courierBotError}</p>
                </div>
              )}
              {!courierBotError && (
                <p className="mt-2 text-sm text-gray-600">
                  Получите токен у <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">@BotFather</a> в Telegram
                </p>
              )}
            </div>

            {settings.courier_bot_token && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-800 mb-3 font-medium">
                    Настройка Webhook для бота курьеров фирмы
                  </p>
                  <p className="text-sm text-blue-700 mb-4">
                    После нажатия этой кнопки бот будет реагировать на команду /start и курьеры смогут регистрироваться, принимать и отменять заказы.
                  </p>
                  <button
                    type="button"
                    onClick={setupWebhook}
                    disabled={settingWebhook}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
                  >
                    <Bot className="w-5 h-5" />
                    {settingWebhook ? 'Установка Webhook...' : 'Настроить Webhook для бота курьеров'}
                  </button>
                </div>
              </>
            )}

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-2">Как работает регистрация:</p>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Курьер пишет боту команду /start</li>
                <li>Бот предлагает зарегистрироваться</li>
                <li>Курьер вводит имя и фамилию</li>
                <li>Выбирает филиал из списка</li>
                <li>Выбирает тип транспорта</li>
                <li>Курьер автоматически добавляется в систему</li>
              </ol>
            </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Радиус завершения заказа (метры)
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                value={settings.completion_radius_meters || 100}
                onChange={(e) => setSettings({ ...settings, completion_radius_meters: parseInt(e.target.value) || 100 })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="100"
              />
              <p className="mt-2 text-sm text-gray-600">
                Укажите радиус в метрах от адреса доставки, в пределах которого курьер сможет завершить заказ.
                При попытке завершить заказ вне этого радиуса, курьеру будет показано сообщение с фактическим расстоянием.
              </p>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Проверять локацию курьера при завершении заказа
                  </label>
                  <p className="text-sm text-gray-600">
                    Если включено, курьер должен будет отправить свою локацию при нажатии "Выполнено".
                    Система проверит, находится ли курьер в пределах указанного радиуса от адреса доставки.
                  </p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, require_courier_location_on_completion: !settings.require_courier_location_on_completion })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-4 flex-shrink-0 ${
                    settings.require_courier_location_on_completion ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.require_courier_location_on_completion ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Сохранение...' : 'Сохранить настройки'}
        </button>
      </div>
    </div>
  );
}
