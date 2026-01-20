import { useState } from 'react';
import { X } from 'lucide-react';

interface PaymentMethod {
  id: string;
  partner_id: string;
  name: string;
  method_type: 'cash' | 'cashless';
  is_active: boolean;
}

interface EditPaymentMethodModalProps {
  method: PaymentMethod;
  onClose: () => void;
  onSuccess: (method: PaymentMethod) => void;
}

export default function EditPaymentMethodModal({ method, onClose, onSuccess }: EditPaymentMethodModalProps) {
  const [formData, setFormData] = useState({
    name: method.name,
    method_type: method.method_type,
    is_active: method.is_active,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name) {
      setError('Введите название типа оплаты');
      return;
    }

    setLoading(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-payment-methods`;

      const response = await fetch(`${apiUrl}?action=update`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: method.id,
          partner_id: method.partner_id,
          ...formData,
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      onSuccess(result.data);
    } catch (error) {
      console.error('Error updating payment method:', error);
      setError('Ошибка при обновлении типа оплаты');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Редактировать тип оплаты</h3>
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
              Название типа оплаты <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Например: Наличными, Терминал, Безнал"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Тип <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors hover:bg-blue-50 ${
                formData.method_type === 'cash' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}>
                <input
                  type="radio"
                  name="method_type"
                  value="cash"
                  checked={formData.method_type === 'cash'}
                  onChange={(e) => setFormData({ ...formData, method_type: e.target.value as 'cash' })}
                  className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-gray-900">Нал</div>
                  <div className="text-sm text-gray-600">Наличные средства</div>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors hover:bg-blue-50 ${
                formData.method_type === 'cashless' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}>
                <input
                  type="radio"
                  name="method_type"
                  value="cashless"
                  checked={formData.method_type === 'cashless'}
                  onChange={(e) => setFormData({ ...formData, method_type: e.target.value as 'cashless' })}
                  className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-gray-900">Безнал</div>
                  <div className="text-sm text-gray-600">Безналичный расчёт (терминал, онлайн)</div>
                </div>
              </label>
            </div>
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
    </div>
  );
}
