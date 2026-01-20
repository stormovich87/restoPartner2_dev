import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Settings, Send, Users, UserPlus, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import CreateCourierModal from '../../components/CreateCourierModal';
import EditCourierModal from '../../components/EditCourierModal';
import ExternalCouriersSettingsModal from '../../components/ExternalCouriersSettingsModal';
import ExternalCourierPollingModal from '../../components/ExternalCourierPollingModal';
import ExternalCourierInvitations from '../../components/ExternalCourierInvitations';

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
  is_own: boolean;
  is_external: boolean;
  cabinet_token?: string;
  created_at: string;
  branches?: {
    name: string;
  };
}

interface CouriersProps {
  partnerId: string;
}

export default function Couriers({ partnerId }: CouriersProps) {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [courierType, setCourierType] = useState<'own' | 'external'>('own');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [deletingCourier, setDeletingCourier] = useState<Courier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showExternalSettings, setShowExternalSettings] = useState(false);
  const [showPollingModal, setShowPollingModal] = useState(false);
  const [externalSubTab, setExternalSubTab] = useState<'list' | 'invitations'>('list');
  const [botUsername, setBotUsername] = useState<string | null>(null);

  useEffect(() => {
    loadBranches();
    loadCouriers();
  }, [partnerId, selectedBranch, courierType]);

  useEffect(() => {
    const loadBotUsername = async () => {
      try {
        const { data } = await supabase
          .from('partner_settings')
          .select('external_courier_bot_token')
          .eq('partner_id', partnerId)
          .maybeSingle();

        if (data?.external_courier_bot_token) {
          const response = await fetch(`https://api.telegram.org/bot${data.external_courier_bot_token}/getMe`);
          if (response.ok) {
            const result = await response.json();
            setBotUsername(result.result?.username || null);
          }
        }
      } catch (error) {
        console.error('Error loading bot username:', error);
      }
    };

    if (courierType === 'external') {
      loadBotUsername();
    }
  }, [partnerId, courierType]);

  const loadBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('partner_id', partnerId)
        .order('name');

      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const loadCouriers = async () => {
    try {
      setLoading(true);
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-couriers`;

      let url = `${apiUrl}?action=list&partner_id=${partnerId}&is_own=${courierType === 'own'}`;
      if (selectedBranch !== 'all') {
        url += `&branch_id=${selectedBranch}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      setCouriers(result.data || []);
    } catch (error) {
      console.error('Error loading couriers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCourier) return;

    setIsDeleting(true);
    const courierToDelete = deletingCourier;

    setCouriers(prev => prev.filter(c => c.id !== courierToDelete.id));
    setDeletingCourier(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-couriers`;

      const response = await fetch(`${apiUrl}?action=delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: courierToDelete.id,
          partner_id: partnerId,
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);
    } catch (error) {
      console.error('Error deleting courier:', error);
      alert('Ошибка при удалении курьера');
      loadCouriers();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (courier: Courier) => {
    const newIsActive = !courier.is_active;

    setCouriers(prev => prev.map(c =>
      c.id === courier.id ? { ...c, is_active: newIsActive } : c
    ));

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
          partner_id: partnerId,
          is_active: newIsActive,
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);
    } catch (error) {
      console.error('Error updating courier:', error);
      alert('Ошибка при обновлении статуса курьера');
      setCouriers(prev => prev.map(c =>
        c.id === courier.id ? { ...c, is_active: courier.is_active } : c
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
          Курьеры
        </h2>
        <div className="flex gap-3">
          {courierType === 'external' && (
            <>
              <button
                onClick={() => setShowPollingModal(true)}
                className="px-6 py-3 bg-white border border-green-300 text-green-700 rounded-xl hover:bg-green-50 transition-all font-semibold flex items-center gap-2"
              >
                <Send className="w-5 h-5" />
                Опрос курьеров
              </button>
              <button
                onClick={() => setShowExternalSettings(true)}
                className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold flex items-center gap-2"
              >
                <Settings className="w-5 h-5" />
                Настройки бота
              </button>
            </>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Курьер
          </button>
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setCourierType('own')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all ${
            courierType === 'own'
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
              : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
          }`}
        >
          Наши курьеры
        </button>
        <button
          onClick={() => setCourierType('external')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all ${
            courierType === 'external'
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
              : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
          }`}
        >
          Сторонние курьеры
        </button>
      </div>

      {courierType === 'external' && (
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setExternalSubTab('list')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              externalSubTab === 'list'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Список
            <span className="ml-1 px-2 py-0.5 bg-white/50 rounded-full text-xs font-semibold">
              {couriers.length}
            </span>
          </button>
          <button
            onClick={() => setExternalSubTab('invitations')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              externalSubTab === 'invitations'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Приглашения
          </button>
        </div>
      )}

      {courierType === 'external' && externalSubTab === 'invitations' ? (
        <ExternalCourierInvitations
          partnerId={partnerId}
          botUsername={botUsername}
          onOpenCourier={(courierId) => {
            const courier = couriers.find(c => c.id === courierId);
            if (courier) {
              setEditingCourier(courier);
            } else {
              loadCouriers().then(() => {
                const c = couriers.find(c => c.id === courierId);
                if (c) setEditingCourier(c);
              });
            }
          }}
        />
      ) : (
        <>
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Фильтр по филиалу
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full max-w-xs"
            >
              <option value="all">Все филиалы</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          {couriers.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-12 text-center">
          <p className="text-gray-600 font-medium mb-4">У вас пока нет курьеров</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Создать первого курьера
          </button>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Имя</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Фамилия</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Username</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Филиал</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Тип транспорта</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Активен</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {couriers.map((courier) => {
                  const vehicleTypeLabels: Record<string, string> = {
                    'on_foot': '🚶 Пеший',
                    'bicycle': '🚴 Велосипед',
                    'scooter': '🛴 Скутер',
                    'car': '🚗 Автомобиль'
                  };

                  return (
                  <tr key={courier.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{courier.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-700">{courier.lastname || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-700">{courier.telegram_username || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-700">{courier.branches?.name || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-700">{courier.vehicle_type ? vehicleTypeLabels[courier.vehicle_type] || courier.vehicle_type : '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(courier)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          courier.is_active ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            courier.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {courier.telegram_username && (
                          <button
                            onClick={() => window.open(`https://t.me/${courier.telegram_username}`, '_blank')}
                            className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Написать в Telegram"
                          >
                            <MessageCircle className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditingCourier(courier)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setDeletingCourier(courier)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
          )}
        </>
      )}

      {showCreateModal && (
        <CreateCourierModal
          partnerId={partnerId}
          isOwn={courierType === 'own'}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newCourier) => {
            setCouriers(prev => [newCourier, ...prev]);
            setShowCreateModal(false);
          }}
        />
      )}

      {editingCourier && (
        <EditCourierModal
          courier={editingCourier}
          onClose={() => setEditingCourier(null)}
          onSuccess={(updatedCourier) => {
            setCouriers(prev => prev.map(c => c.id === updatedCourier.id ? updatedCourier : c));
            setEditingCourier(null);
          }}
        />
      )}

      {deletingCourier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Подтверждение удаления
            </h3>
            <p className="text-gray-600 mb-6">
              Вы уверены, что хотите удалить курьера <span className="font-semibold text-gray-900">"{deletingCourier.name}"</span>?
              <br />
              <br />
              Это действие невозможно отменить.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingCourier(null)}
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

      {showExternalSettings && (
        <ExternalCouriersSettingsModal
          partnerId={partnerId}
          onClose={() => setShowExternalSettings(false)}
        />
      )}

      {showPollingModal && (
        <ExternalCourierPollingModal
          partnerId={partnerId}
          onClose={() => setShowPollingModal(false)}
        />
      )}
    </div>
  );
}
