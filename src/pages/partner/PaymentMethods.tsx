import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import CreatePaymentMethodModal from '../../components/CreatePaymentMethodModal';
import EditPaymentMethodModal from '../../components/EditPaymentMethodModal';

interface PaymentMethod {
  id: string;
  partner_id: string;
  name: string;
  method_type: 'cash' | 'cashless';
  is_active: boolean;
  created_at: string;
}

interface PaymentMethodsProps {
  partnerId: string;
}

export default function PaymentMethods({ partnerId }: PaymentMethodsProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [deletingMethod, setDeletingMethod] = useState<PaymentMethod | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadPaymentMethods();
  }, [partnerId]);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-payment-methods`;

      const response = await fetch(`${apiUrl}?action=list&partner_id=${partnerId}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      setPaymentMethods(result.data || []);
    } catch (error) {
      console.error('Error loading payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingMethod) return;

    setIsDeleting(true);
    const methodToDelete = deletingMethod;

    setPaymentMethods(prev => prev.filter(m => m.id !== methodToDelete.id));
    setDeletingMethod(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-payment-methods`;

      const response = await fetch(`${apiUrl}?action=delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: methodToDelete.id,
          partner_id: partnerId,
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);
    } catch (error) {
      console.error('Error deleting payment method:', error);
      alert('Ошибка при удалении типа оплаты');
      loadPaymentMethods();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (method: PaymentMethod) => {
    const newIsActive = !method.is_active;

    setPaymentMethods(prev => prev.map(m =>
      m.id === method.id ? { ...m, is_active: newIsActive } : m
    ));

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
          partner_id: partnerId,
          is_active: newIsActive,
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);
    } catch (error) {
      console.error('Error updating payment method:', error);
      alert('Ошибка при обновлении статуса');
      setPaymentMethods(prev => prev.map(m =>
        m.id === method.id ? { ...m, is_active: method.is_active } : m
      ));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          Типы оплаты
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Создать тип оплаты
        </button>
      </div>

      {paymentMethods.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-12 text-center">
          <p className="text-gray-600 font-medium mb-4">У вас пока нет типов оплаты</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Создать первый тип оплаты
          </button>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Название</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Тип</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Активен</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paymentMethods.map((method) => (
                  <tr key={method.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{method.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        method.method_type === 'cash'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {method.method_type === 'cash' ? 'Нал' : 'Безнал'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(method)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          method.is_active ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            method.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingMethod(method)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setDeletingMethod(method)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreatePaymentMethodModal
          partnerId={partnerId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newMethod) => {
            setPaymentMethods(prev => [newMethod, ...prev]);
            setShowCreateModal(false);
          }}
        />
      )}

      {editingMethod && (
        <EditPaymentMethodModal
          method={editingMethod}
          onClose={() => setEditingMethod(null)}
          onSuccess={(updatedMethod) => {
            setPaymentMethods(prev => prev.map(m => m.id === updatedMethod.id ? updatedMethod : m));
            setEditingMethod(null);
          }}
        />
      )}

      {deletingMethod && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Подтверждение удаления
            </h3>
            <p className="text-gray-600 mb-6">
              Вы уверены, что хотите удалить тип оплаты <span className="font-semibold text-gray-900">"{deletingMethod.name}"</span>?
              <br />
              <br />
              Это действие невозможно отменить.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingMethod(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold disabled:opacity-50"
              >
                {isDeleting ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
