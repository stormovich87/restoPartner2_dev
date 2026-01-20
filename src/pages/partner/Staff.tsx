import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import CreateStaffMemberModal from '../../components/CreateStaffMemberModal';

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  position_id: string;
  phone: string | null;
  telegram_user_id: string | null;
  telegram_username: string | null;
  login: string;
  is_active: boolean;
  created_at: string;
  positions?: {
    name: string;
  };
}

interface StaffProps {
  partnerId: string;
}

export default function Staff({ partnerId }: StaffProps) {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState<StaffMember | null>(null);

  useEffect(() => {
    loadStaffMembers();
  }, [partnerId]);

  const loadStaffMembers = async () => {
    try {
      const { data } = await supabase
        .from('staff_members')
        .select('*, positions(name)')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });

      if (data) {
        setStaffMembers(data);
      }
    } catch (error) {
      console.error('Error loading staff members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (staff: StaffMember) => {
    setStaffToEdit(staff);
    setShowModal(true);
  };

  const handleDelete = async (staffId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого работника?')) {
      return;
    }

    try {
      await supabase
        .from('staff_members')
        .delete()
        .eq('id', staffId);

      loadStaffMembers();
    } catch (error) {
      console.error('Error deleting staff member:', error);
      alert('Ошибка при удалении работника');
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setStaffToEdit(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  const activeStaff = staffMembers.filter(s => s.is_active);
  const inactiveStaff = staffMembers.filter(s => !s.is_active);
  const displayedStaff = activeTab === 'active' ? activeStaff : inactiveStaff;

  return (
    <div className="space-y-6">
      {showModal && (
        <CreateStaffMemberModal
          partnerId={partnerId}
          staffToEdit={staffToEdit}
          onClose={handleModalClose}
          onSuccess={() => {
            handleModalClose();
            loadStaffMembers();
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Работники</h2>
        <button
          onClick={() => {
            setStaffToEdit(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold"
        >
          <Plus className="w-5 h-5" />
          <span>Работника</span>
        </button>
      </div>

      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-6 py-3 font-semibold transition-all ${
            activeTab === 'active'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Работающие ({activeStaff.length})
        </button>
        <button
          onClick={() => setActiveTab('inactive')}
          className={`px-6 py-3 font-semibold transition-all ${
            activeTab === 'inactive'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Уволенные ({inactiveStaff.length})
        </button>
      </div>

      {displayedStaff.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-600 font-medium">
            {activeTab === 'active' ? 'Нет работающих сотрудников' : 'Нет уволенных сотрудников'}
          </p>
          {activeTab === 'active' && (
            <p className="text-sm text-gray-500 mt-2">Добавьте первого работника для начала работы</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
            <thead className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  ФИО
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Должность
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Телефон
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Логин
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Дата добавления
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedStaff.map((staff) => {
                const isSuper = staff.login === '1';

                return (
                  <tr key={staff.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <span className="font-semibold text-gray-900">
                        {staff.first_name} {staff.last_name}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-gray-700">{staff.positions?.name || '—'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-gray-700">{staff.phone || '—'}</span>
                    </td>
                    <td className="px-6 py-5">
                      {isSuper ? (
                        <span className="text-gray-400">••••••</span>
                      ) : (
                        <span className="text-gray-700">{staff.login}</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-gray-600 text-sm">
                        {new Date(staff.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {staff.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Работает
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-full font-medium">
                          <XCircle className="w-3.5 h-3.5" />
                          Уволен
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      {isSuper ? (
                        <span className="text-xs text-gray-400">Защищен</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(staff)}
                            className="p-2.5 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors shadow-sm border border-cyan-200"
                            title="Редактировать"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(staff.id)}
                            className="p-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors shadow-sm border border-red-200"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
