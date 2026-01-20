import { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateCabinetSlug, generateCabinetUrl } from '../lib/transliteration';
import CourierOrdersModal from './CourierOrdersModal';

interface Branch {
  id: string;
  name: string;
}

interface Courier {
  id: string;
  partner_id: string;
  branch_id: string;
  name: string;
  lastname?: string;
  phone: string;
  telegram_username?: string | null;
  telegram_user_id?: string | null;
  is_active: boolean;
  vehicle_type?: string;
  is_external?: boolean;
  cabinet_token?: string;
  cabinet_login?: string | null;
  cabinet_password?: string | null;
}

interface EditCourierModalProps {
  courier: Courier;
  onClose: () => void;
  onSuccess: (courier: Courier) => void;
}

export default function EditCourierModal({ courier, onClose, onSuccess }: EditCourierModalProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [formData, setFormData] = useState({
    branch_id: courier.branch_id,
    name: courier.name,
    lastname: courier.lastname || '',
    telegram_username: courier.telegram_username || '',
    phone: courier.phone,
    is_active: courier.is_active,
    vehicle_type: courier.vehicle_type || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [partnerDomain, setPartnerDomain] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);

  useEffect(() => {
    loadBranches();
    if (courier.is_external) {
      loadPartnerDomain();
    }
  }, [courier.partner_id, courier.is_external]);

  const loadBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('partner_id', courier.partner_id)
        .order('name');

      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const loadPartnerDomain = async () => {
    try {
      const { data } = await supabase
        .from('partners')
        .select('url_suffix')
        .eq('id', courier.partner_id)
        .maybeSingle();

      if (data?.url_suffix) {
        setPartnerDomain(data.url_suffix);
      }
    } catch (error) {
      console.error('Error loading partner domain:', error);
    }
  };

  const getCabinetUrl = () => {
    if (!courier.name || !courier.lastname || !partnerDomain) return '';
    const cabinetSlug = generateCabinetSlug(courier.name, courier.lastname);
    return generateCabinetUrl(partnerDomain, cabinetSlug);
  };

  const handleCopyUrl = () => {
    const url = getCabinetUrl();
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.branch_id || !formData.name || !formData.lastname) {
      setError('Заполните все обязательные поля');
      return;
    }

    setLoading(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-couriers`;

      const response = await fetch(`${apiUrl}?action=update`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: courier.id,
          partner_id: courier.partner_id,
          branch_id: formData.branch_id,
          name: formData.name,
          lastname: formData.lastname,
          telegram_username: formData.telegram_username || null,
          phone: formData.phone,
          is_active: formData.is_active,
          vehicle_type: formData.vehicle_type || null,
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      onSuccess(result.data);
    } catch (error) {
      console.error('Error updating courier:', error);
      setError('Ошибка при обновлении курьера');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Редактировать курьера</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Филиал <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.branch_id}
              onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Выберите филиал</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          {courier.telegram_user_id && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                User ID
              </label>
              <input
                type="text"
                value={courier.telegram_user_id}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                disabled
              />
            </div>
          )}

          {courier.is_external && partnerDomain && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ссылка на кабинет курьера
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={getCabinetUrl()}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-600 text-sm"
                  readOnly
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-4 py-3 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-colors flex items-center gap-2 font-medium"
                  title="Копировать ссылку"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span className="hidden sm:inline">Скопировано</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span className="hidden sm:inline">Копировать</span>
                    </>
                  )}
                </button>
                <a
                  href={getCabinetUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-colors flex items-center gap-2 font-medium"
                  title="Открыть кабинет"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">Открыть</span>
                </a>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Используйте эту ссылку для проверки кабинета на компьютере. В Telegram кабинет открывается через команду /kabinet
              </p>
            </div>
          )}

          {courier.is_external && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowOrdersModal(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-semibold flex items-center justify-center gap-2"
              >
                <Package className="w-5 h-5" />
                Заказы
              </button>
            </div>
          )}

          {courier.is_external && (courier.cabinet_login || courier.cabinet_password) && (
            <div className="bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-200">
              <p className="text-sm font-semibold text-gray-700">Авторизация в браузере</p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Логин
                </label>
                <input
                  type="text"
                  value={courier.cabinet_login || ''}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 text-sm font-mono select-all"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Пароль
                </label>
                <input
                  type="text"
                  value={courier.cabinet_password || ''}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 text-sm font-mono select-all"
                  readOnly
                />
              </div>
              <p className="text-xs text-gray-500">
                В Telegram авторизация автоматическая по User ID
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Имя <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Иван"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Фамилия <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.lastname}
              onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Иванов"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={formData.telegram_username}
              onChange={(e) => setFormData({ ...formData, telegram_username: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="@username"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Номер телефона
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+7 (999) 123-45-67"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Тип транспорта
            </label>
            <select
              value={formData.vehicle_type ?? ""}
              onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value || null })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Не указано</option>
              <option value="on_foot">🚶 Пеший</option>
              <option value="bicycle">🚴 Велосипед</option>
              <option value="scooter">🛴 Скутер</option>
              <option value="car">🚗 Автомобиль</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active_edit"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active_edit" className="ml-2 text-sm font-medium text-gray-700">
              Активен
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all font-semibold disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>

      {showOrdersModal && (
        <CourierOrdersModal
          courierId={courier.id}
          courierName={`${courier.name} ${courier.lastname || ''}`}
          onClose={() => setShowOrdersModal(false)}
        />
      )}
    </div>
  );
}
