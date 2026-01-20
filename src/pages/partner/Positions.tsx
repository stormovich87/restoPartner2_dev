import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import CreatePositionModal from '../../components/CreatePositionModal';

interface Position {
  id: string;
  name: string;
  can_delete_orders: boolean;
  can_revert_order_status?: boolean;
  can_skip_order_status?: boolean;
  is_visible: boolean;
  created_at: string;
  permissions: string[];
  branches?: Array<{ id: string; name: string }>;
}

interface PositionsProps {
  partnerId: string;
}

const SECTION_NAMES: Record<string, string> = {
  orders: 'Заказы',
  branches: 'Филиалы',
  couriers: 'Курьеры',
  courier_zones: 'Зоны курьеров',
  executors: 'Исполнители',
  payment_methods: 'Способы оплаты',
  menu_categories: 'Категории меню',
  menu_products: 'Товары меню',
  general_settings: 'Общие настройки',
  poster_settings: 'Настройки Poster',
  accesses: 'Доступы'
};

export default function Positions({ partnerId }: PositionsProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [positionToEdit, setPositionToEdit] = useState<Position | null>(null);

  useEffect(() => {
    loadPositions();
  }, [partnerId]);

  const loadPositions = async () => {
    try {
      const { data: positionsData } = await supabase
        .from('positions')
        .select('*')
        .eq('partner_id', partnerId)
        .or('is_super_admin.is.null,is_super_admin.eq.false')
        .order('created_at', { ascending: true });

      if (positionsData) {
        const positionsWithPermissionsAndBranches = await Promise.all(
          positionsData.map(async (position) => {
            const [permissionsRes, branchesRes] = await Promise.all([
              supabase
                .from('position_permissions')
                .select('section')
                .eq('position_id', position.id),
              supabase
                .from('position_branches')
                .select('branch_id, branches(id, name)')
                .eq('position_id', position.id)
            ]);

            return {
              ...position,
              permissions: permissionsRes.data?.map(p => p.section) || [],
              branches: branchesRes.data?.map(b => ({
                id: (b as any).branches.id,
                name: (b as any).branches.name
              })) || []
            };
          })
        );

        setPositions(positionsWithPermissionsAndBranches);
      }
    } catch (error) {
      console.error('Error loading positions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (position: Position) => {
    setPositionToEdit({
      id: position.id,
      name: position.name,
      can_delete_orders: position.can_delete_orders,
      can_revert_order_status: position.can_revert_order_status,
      can_skip_order_status: position.can_skip_order_status,
      permissions: position.permissions,
      branches: position.branches?.map(b => b.id) || []
    });
    setShowModal(true);
  };

  const handleToggleVisibility = async (positionId: string, currentVisibility: boolean) => {
    try {
      await supabase
        .from('positions')
        .update({ is_visible: !currentVisibility })
        .eq('id', positionId);

      loadPositions();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Ошибка при изменении видимости');
    }
  };

  const handleDelete = async (positionId: string) => {
    const { data: staffCount } = await supabase
      .from('staff_members')
      .select('id', { count: 'exact', head: true })
      .eq('position_id', positionId);

    if ((staffCount as any)?.count > 0) {
      if (!confirm(`К этой должности привязаны работники (${(staffCount as any).count} чел.). При удалении они потеряют доступы и все настройки. Продолжить?`)) {
        return;
      }
    } else {
      if (!confirm('Вы уверены, что хотите удалить эту должность?')) {
        return;
      }
    }

    try {
      await supabase
        .from('positions')
        .delete()
        .eq('id', positionId);

      loadPositions();
    } catch (error) {
      console.error('Error deleting position:', error);
      alert('Ошибка при удалении должности');
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setPositionToEdit(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showModal && (
        <CreatePositionModal
          partnerId={partnerId}
          positionToEdit={positionToEdit}
          onClose={handleModalClose}
          onSuccess={() => {
            handleModalClose();
            loadPositions();
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Должности</h2>
        <button
          onClick={() => {
            setPositionToEdit(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold"
        >
          <Plus className="w-5 h-5" />
          <span>Должность</span>
        </button>
      </div>

      {positions.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-600 font-medium">Нет созданных должностей</p>
          <p className="text-sm text-gray-500 mt-2">Создайте первую должность для управления доступами работников</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
            <thead className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Название
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Доступы к разделам
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Филиалы
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Разрешения
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Видимость в боте
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {positions.map((position) => (
                <tr key={position.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <span className="font-semibold text-gray-900">{position.name}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-1">
                      {position.permissions.length === 0 ? (
                        <span className="text-sm text-gray-500">Нет доступов</span>
                      ) : (
                        position.permissions.map((section) => (
                          <span
                            key={section}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full font-medium"
                          >
                            {SECTION_NAMES[section] || section}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {position.branches && position.branches.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {position.branches.map((branch) => (
                          <span
                            key={branch.id}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium"
                          >
                            {branch.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Все филиалы</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1.5">
                      {position.can_delete_orders && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full font-medium">
                          Удаление чеков
                        </span>
                      )}
                      {position.can_skip_order_status && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
                          Смена статуса вперед
                        </span>
                      )}
                      {position.can_revert_order_status && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                          Откат статуса обратно
                        </span>
                      )}
                      {!position.can_delete_orders && !position.can_skip_order_status && !position.can_revert_order_status && (
                        <span className="text-sm text-gray-500">Нет разрешений</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <button
                      onClick={() => handleToggleVisibility(position.id, position.is_visible)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                        position.is_visible
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title={position.is_visible ? 'Видима в боте' : 'Скрыта в боте'}
                    >
                      {position.is_visible ? (
                        <>
                          <Eye className="w-4 h-4" />
                          <span className="text-sm">Видима</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-4 h-4" />
                          <span className="text-sm">Скрыта</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(position)}
                        className="p-2.5 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors shadow-sm border border-cyan-200"
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(position.id)}
                        className="p-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors shadow-sm border border-red-200"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
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
    </div>
  );
}
