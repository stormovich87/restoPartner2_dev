import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Webhook } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import CreateBranchModal from '../../components/CreateBranchModal';
import EditBranchModal from '../../components/EditBranchModal';

interface Branch {
  id: string;
  name: string;
  phone: string;
  address: string;
  status: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  created_at: string;
}

interface BranchesProps {
  partnerId: string;
}

export default function Branches({ partnerId }: BranchesProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settingWebhook, setSettingWebhook] = useState<string | null>(null);

  useEffect(() => {
    loadBranches();
  }, [partnerId]);

  const loadBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error loading branches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = (newBranch: Branch) => {
    setBranches(prev => [newBranch, ...prev]);
    setShowCreateModal(false);
  };

  const handleEditSuccess = (updatedBranch: Branch) => {
    setBranches(prev => prev.map(b => b.id === updatedBranch.id ? updatedBranch : b));
    setEditingBranch(null);
  };

  const handleDelete = async () => {
    if (!deletingBranch) return;

    setIsDeleting(true);
    const branchToDelete = deletingBranch;

    setBranches(prev => prev.filter(b => b.id !== branchToDelete.id));
    setDeletingBranch(null);

    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branchToDelete.id)
        .eq('partner_id', partnerId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting branch:', error);
      alert('Ошибка при удалении филиала');
      loadBranches();
    } finally {
      setIsDeleting(false);
    }
  };

  const setupWebhook = async (branch: Branch) => {
    if (!branch.telegram_bot_token) {
      alert('У филиала не настроен Telegram Bot Token. Перейдите в редактирование филиала и добавьте токен.');
      return;
    }

    setSettingWebhook(branch.id);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/setup-branch-webhook`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bot_token: branch.telegram_bot_token
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при настройке webhook');
      }

      alert('Webhook успешно настроен! Теперь кнопка "Принять заказ" будет работать.');
    } catch (error) {
      console.error('Error setting up webhook:', error);
      alert(`Ошибка при настройке webhook: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setSettingWebhook(null);
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
          Филиалы
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Филиал
        </button>
      </div>

      {branches.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-12 text-center">
          <p className="text-gray-600 font-medium mb-4">У вас пока нет филиалов</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Создать первый филиал
          </button>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Название</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Телефон</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Адрес</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Статус</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {branches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{branch.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-700">{branch.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-700">{branch.address}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                          branch.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : branch.status === 'paused'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {branch.status === 'active' ? 'Активен' : branch.status === 'paused' ? 'Приостановлен' : 'Неактивен'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {branch.telegram_bot_token && (
                          <button
                            onClick={() => setupWebhook(branch)}
                            disabled={settingWebhook === branch.id}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Настроить Webhook"
                          >
                            {settingWebhook === branch.id ? (
                              <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Webhook className="w-5 h-5" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => setEditingBranch(branch)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setDeletingBranch(branch)}
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
        <CreateBranchModal
          partnerId={partnerId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {editingBranch && (
        <EditBranchModal
          branch={editingBranch}
          partnerId={partnerId}
          onClose={() => setEditingBranch(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {deletingBranch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Подтверждение удаления
            </h3>
            <p className="text-gray-600 mb-6">
              Вы уверены, что хотите удалить филиал <span className="font-semibold text-gray-900">"{deletingBranch.name}"</span>?
              <br />
              <br />
              Это действие невозможно отменить. Все связанные данные будут потеряны.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingBranch(null)}
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
