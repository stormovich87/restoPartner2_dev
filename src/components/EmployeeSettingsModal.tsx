import { useState, useEffect } from 'react';
import { X, Calendar, Save, MapPin, Clock, Navigation } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EmployeeSettingsModalProps {
  partnerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EmployeeSettingsModal({ partnerId, onClose, onSuccess }: EmployeeSettingsModalProps) {
  const [shiftVisibilityDays, setShiftVisibilityDays] = useState(2);
  const [shiftLocationRadius, setShiftLocationRadius] = useState(50);
  const [shiftRequireLocation, setShiftRequireLocation] = useState(true);
  const [shiftRequireLocationOnClose, setShiftRequireLocationOnClose] = useState(false);
  const [shiftGraceMinutes, setShiftGraceMinutes] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [partnerId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('partner_settings')
        .select('employee_shift_visibility_days, shift_location_radius_meters, shift_require_location, require_location_on_shift_close, shift_grace_minutes')
        .eq('partner_id', partnerId)
        .single();

      if (error) throw error;

      if (data) {
        setShiftVisibilityDays(data.employee_shift_visibility_days || 2);
        setShiftLocationRadius(data.shift_location_radius_meters ?? 50);
        setShiftRequireLocation(data.shift_require_location ?? true);
        setShiftRequireLocationOnClose(data.require_location_on_shift_close ?? false);
        setShiftGraceMinutes(data.shift_grace_minutes ?? 0);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setError('Ошибка загрузки настроек');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('partner_settings')
        .update({
          employee_shift_visibility_days: shiftVisibilityDays,
          shift_location_radius_meters: shiftLocationRadius,
          shift_require_location: shiftRequireLocation,
          require_location_on_shift_close: shiftRequireLocationOnClose,
          shift_grace_minutes: shiftGraceMinutes
        })
        .eq('partner_id', partnerId);

      if (updateError) throw updateError;

      onSuccess();
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Ошибка при сохранении настроек');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50 sticky top-0">
          <h2 className="text-xl font-bold text-gray-900">Настройки сотрудников</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/80 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Кабинет сотрудника</h3>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1.5" />
                Видимость ближайших смен (дней)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                value={shiftVisibilityDays}
                onChange={(e) => setShiftVisibilityDays(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                required
              />
              <p className="mt-2 text-xs text-gray-500">
                Количество дней вперед для отображения ближайших смен
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Открытие/закрытие смены</h3>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={shiftRequireLocation}
                    onChange={(e) => setShiftRequireLocation(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-12 h-6 rounded-full transition-colors ${shiftRequireLocation ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform absolute top-0.5 ${shiftRequireLocation ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                  </div>
                </div>
                <div>
                  <div className="font-medium text-gray-900 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-blue-600" />
                    Требовать геолокацию при открытии смены
                  </div>
                  <p className="text-xs text-gray-500">
                    Если выключено, смена открывается без проверки местоположения
                  </p>
                </div>
              </label>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={shiftRequireLocationOnClose}
                    onChange={(e) => setShiftRequireLocationOnClose(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-12 h-6 rounded-full transition-colors ${shiftRequireLocationOnClose ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform absolute top-0.5 ${shiftRequireLocationOnClose ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                  </div>
                </div>
                <div>
                  <div className="font-medium text-gray-900 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-green-600" />
                    Требовать геолокацию при закрытии смены
                  </div>
                  <p className="text-xs text-gray-500">
                    Если включено, смена закрывается только при нахождении в радиусе филиала
                  </p>
                </div>
              </label>
            </div>

            {(shiftRequireLocation || shiftRequireLocationOnClose) && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1.5" />
                  Радиус от филиала (метры)
                </label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={shiftLocationRadius}
                  onChange={(e) => setShiftLocationRadius(parseInt(e.target.value) || 50)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  required
                />
                <p className="mt-2 text-xs text-gray-500">
                  Сотрудник должен находиться в этом радиусе от филиала для открытия/закрытия смены
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1.5" />
                Допустимый зазор (минут)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={shiftGraceMinutes}
                onChange={(e) => setShiftGraceMinutes(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                required
              />
              <p className="mt-2 text-xs text-gray-500">
                Время после начала смены, которое не считается опозданием. Например: смена в 09:00, зазор 5 минут, опоздание считается с 09:05
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-all font-semibold"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all font-semibold disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
