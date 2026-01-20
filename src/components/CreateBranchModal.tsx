import { useState, useEffect, useRef } from 'react';
import { X, Search, MapPin, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { loadGoogleMapsScript } from '../lib/googleMapsLoader';
import { Branch } from '../types';

interface CreateBranchModalProps {
  partnerId: string;
  onClose: () => void;
  onSuccess: (branch: Branch) => void;
}

export default function CreateBranchModal({ partnerId, onClose, onSuccess }: CreateBranchModalProps) {
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string | null>(null);
  const [defaultMapLat, setDefaultMapLat] = useState<number | null>(null);
  const [defaultMapLng, setDefaultMapLng] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    loadGoogleMapsApiKey();
  }, [partnerId]);

  useEffect(() => {
    if (googleMapsApiKey) {
      const lat = latitude ?? defaultMapLat;
      const lng = longitude ?? defaultMapLng;
      if (lat !== null && lng !== null) {
        initializeMap(lat, lng);
      }
    }
  }, [googleMapsApiKey, latitude, longitude, defaultMapLat, defaultMapLng]);

  const loadGoogleMapsApiKey = async () => {
    try {
      const { data } = await supabase
        .from('partner_settings')
        .select('google_maps_api_key, default_map_lat, default_map_lng')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (data?.google_maps_api_key) {
        setGoogleMapsApiKey(data.google_maps_api_key);
      }
      if (data?.default_map_lat && data?.default_map_lng) {
        setDefaultMapLat(data.default_map_lat);
        setDefaultMapLng(data.default_map_lng);
      }
    } catch (error) {
      console.error('Error loading Google Maps API key:', error);
    }
  };

  const initializeMap = async (lat: number, lng: number) => {
    if (!googleMapsApiKey || !mapRef.current) {
      return;
    }

    try {
      await loadGoogleMapsScript(googleMapsApiKey);

      const position = { lat, lng };

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: position,
          zoom: 15,
        });

        mapInstanceRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const newLat = e.latLng.lat();
            const newLng = e.latLng.lng();
            setLatitude(newLat);
            setLongitude(newLng);
            updateMarker(newLat, newLng);
            reverseGeocodePosition(newLat, newLng);
          }
        });
      } else {
        mapInstanceRef.current.setCenter(position);
      }

      if (latitude !== null && longitude !== null) {
        updateMarker(latitude, longitude);
      } else if (defaultMapLat !== null && defaultMapLng !== null) {
        updateMarker(defaultMapLat, defaultMapLng, true);
      }
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const updateMarker = (lat: number, lng: number, isDefaultLocation = false) => {
    if (!mapInstanceRef.current) return;

    const position = { lat, lng };

    if (markerRef.current) {
      markerRef.current.setPosition(position);
      if (!isDefaultLocation) {
        markerRef.current.setOptions({ opacity: 1.0 });
      } else {
        markerRef.current.setOptions({ opacity: 0.5 });
      }
    } else {
      markerRef.current = new google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        draggable: true,
        opacity: isDefaultLocation ? 0.5 : 1.0,
      });

      markerRef.current.addListener('dragend', () => {
        if (markerRef.current) {
          const newPosition = markerRef.current.getPosition();
          if (newPosition) {
            const newLat = newPosition.lat();
            const newLng = newPosition.lng();
            setLatitude(newLat);
            setLongitude(newLng);
            markerRef.current.setOptions({ opacity: 1.0 });
            reverseGeocodePosition(newLat, newLng);
          }
        }
      });
    }
  };

  const reverseGeocodePosition = async (lat: number, lng: number) => {
    if (!googleMapsApiKey) return;

    try {
      await loadGoogleMapsScript(googleMapsApiKey);
      const geocoder = new google.maps.Geocoder();
      const location = { lat, lng };

      geocoder.geocode({ location }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          setAddress(results[0].formatted_address);
        }
      });
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  };

  const handleFindAddress = async () => {
    if (!address.trim()) {
      alert('Введите адрес для поиска');
      return;
    }

    if (!googleMapsApiKey) {
      alert('Google Maps API ключ не настроен. Перейдите в Настройки → Общие → Google Карты / Геолокация');
      return;
    }

    setGeocoding(true);
    try {
      await loadGoogleMapsScript(googleMapsApiKey);
      const geocoder = new google.maps.Geocoder();

      geocoder.geocode({ address }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          const result = results[0];
          const location = result.geometry.location;
          const newLat = location.lat();
          const newLng = location.lng();

          setLatitude(newLat);
          setLongitude(newLng);
          setAddress(result.formatted_address);
        } else {
          alert('Не удалось найти адрес. Проверьте правильность ввода.');
        }
        setGeocoding(false);
      });
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Ошибка при поиске адреса');
      setGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('branches')
        .insert([{
          partner_id: partnerId,
          name,
          phone,
          address,
          latitude,
          longitude,
          telegram_bot_token: telegramBotToken || null,
          telegram_chat_id: telegramChatId || null,
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;

      onSuccess(data);
      onClose();
    } catch (error) {
      console.error('Error creating branch:', error);
      alert('Ошибка при создании филиала');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Создать филиал
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form id="create-branch-form" onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Название филиала <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Например: Центральный офис"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Номер телефона <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="+7 (999) 123-45-67"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Адрес филиала <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                placeholder="Москва, ул. Ленина, д. 1"
                rows={2}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <button
                type="button"
                onClick={handleFindAddress}
                disabled={geocoding || !googleMapsApiKey}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title={!googleMapsApiKey ? 'Настройте Google Maps API ключ в общих настройках' : 'Найти адрес'}
              >
                <Search className="w-5 h-5" />
                {geocoding ? 'Поиск...' : 'Найти'}
              </button>
            </div>
            {!googleMapsApiKey && (
              <p className="mt-2 text-sm text-amber-600">
                Google Maps API не настроен. Перейдите в Настройки → Общие
              </p>
            )}

            {googleMapsApiKey && (defaultMapLat !== null && defaultMapLng !== null) && (
              <div className="mt-3">
                <div
                  ref={mapRef}
                  className="w-full aspect-video bg-gray-200 rounded-lg overflow-hidden border border-gray-300"
                />
              </div>
            )}

            {!googleMapsApiKey && (
              <div className="mt-3 w-full aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-300 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Google Maps API не настроен</p>
                </div>
              </div>
            )}

            {googleMapsApiKey && (defaultMapLat === null || defaultMapLng === null) && (
              <div className="mt-3 w-full aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-300 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Настройте начальную точку карты в Настройках → Общие</p>
                </div>
              </div>
            )}

            {(latitude !== null && longitude !== null) || (defaultMapLat !== null && defaultMapLng !== null) ? (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Широта:</span> {(latitude ?? defaultMapLat)?.toFixed(6)}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Долгота:</span> {(longitude ?? defaultMapLng)?.toFixed(6)}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {latitude !== null && longitude !== null
                    ? 'Нажмите на карту или перетащите маркер для изменения координат'
                    : 'Кликните на карту или найдите адрес для установки точного местоположения филиала'}
                </p>
              </div>
            ) : null}
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Telegram уведомления
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Telegram Bot Token
                </label>
                <input
                  type="text"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <p className="mt-2 text-sm text-gray-600">
                  Токен бота для отправки уведомлений о заказах
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Telegram Chat ID
                </label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="-1001234567890"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <p className="mt-2 text-sm text-gray-600">
                  ID группы или чата для получения уведомлений о новых заказах
                </p>
              </div>
            </div>
          </div>
        </form>

        <div className="flex gap-3 px-6 py-4 border-t bg-white rounded-b-2xl flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
          >
            Отмена
          </button>
          <button
            type="submit"
            form="create-branch-form"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Создание...' : 'Создать филиал'}
          </button>
        </div>
      </div>
    </div>
  );
}
