import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CreatePositionModalProps {
  partnerId: string;
  positionToEdit?: {
    id: string;
    name: string;
    can_delete_orders: boolean;
    can_revert_order_status?: boolean;
    can_skip_order_status?: boolean;
    permissions: string[];
    branches?: string[];
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface Branch {
  id: string;
  name: string;
}

interface SectionGroup {
  name: string;
  sections: Array<{ id: string; name: string }>;
}

const AVAILABLE_SECTIONS: SectionGroup[] = [
  {
    name: 'Основные разделы',
    sections: [
      { id: 'dashboard', name: 'Дашборд' },
      { id: 'orders', name: 'Заказы' },
      { id: 'clients', name: 'Клиенты' },
      { id: 'history', name: 'История' },
      { id: 'logs', name: 'Логи' },
      { id: 'open_shifts', name: 'Открытые смены' },
      { id: 'reports', name: 'Отчёты' }
    ]
  },
  {
    name: 'Меню',
    sections: [
      { id: 'menu_categories', name: 'Категории меню' },
      { id: 'menu_products', name: 'Товары меню' }
    ]
  },
  {
    name: 'Настройки',
    sections: [
      { id: 'general_settings', name: 'Общие настройки' },
      { id: 'branches', name: 'Филиалы' },
      { id: 'couriers', name: 'Курьеры' },
      { id: 'courier_zones', name: 'Зоны курьеров' },
      { id: 'payment_methods', name: 'Способы оплаты' },
      { id: 'executors', name: 'Исполнители' },
      { id: 'poster_settings', name: 'Настройки Poster' },
      { id: 'print_settings', name: 'Печать' }
    ]
  },
  {
    name: 'Доступы',
    sections: [
      { id: 'positions', name: 'Должности' },
      { id: 'staff', name: 'Работники' }
    ]
  },
  {
    name: 'Сотрудники',
    sections: [
      { id: 'work_schedule', name: 'График работы' },
      { id: 'employees', name: 'Сотрудники' }
    ]
  }
];

export default function CreatePositionModal({ partnerId, positionToEdit, onClose, onSuccess }: CreatePositionModalProps) {
  const [name, setName] = useState('');
  const [canDeleteOrders, setCanDeleteOrders] = useState(false);
  const [canRevertOrderStatus, setCanRevertOrderStatus] = useState(false);
  const [canSkipOrderStatus, setCanSkipOrderStatus] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set());
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBranches();
  }, [partnerId]);

  useEffect(() => {
    if (positionToEdit) {
      setName(positionToEdit.name);
      setCanDeleteOrders(positionToEdit.can_delete_orders);
      setCanRevertOrderStatus(positionToEdit.can_revert_order_status ?? false);
      setCanSkipOrderStatus(positionToEdit.can_skip_order_status ?? false);
      setSelectedSections(new Set(positionToEdit.permissions));
      if (positionToEdit.branches) {
        setSelectedBranches(new Set(positionToEdit.branches));
      } else {
        loadPositionBranches();
      }
    }
  }, [positionToEdit]);

  const loadBranches = async () => {
    try {
      const { data } = await supabase
        .from('branches')
        .select('id, name')
        .eq('partner_id', partnerId)
        .order('name');

      if (data) {
        setBranches(data);
      }
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const loadPositionBranches = async () => {
    if (!positionToEdit) return;

    try {
      const { data } = await supabase
        .from('position_branches')
        .select('branch_id')
        .eq('position_id', positionToEdit.id);

      if (data) {
        setSelectedBranches(new Set(data.map(pb => pb.branch_id)));
      }
    } catch (error) {
      console.error('Error loading position branches:', error);
    }
  };

  const toggleSection = (sectionId: string) => {
    const newSelected = new Set(selectedSections);
    if (newSelected.has(sectionId)) {
      newSelected.delete(sectionId);
    } else {
      newSelected.add(sectionId);
    }
    setSelectedSections(newSelected);
  };

  const toggleBranch = (branchId: string) => {
    const newSelected = new Set(selectedBranches);
    if (newSelected.has(branchId)) {
      newSelected.delete(branchId);
    } else {
      newSelected.add(branchId);
    }
    setSelectedBranches(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Введите название должности');
      return;
    }

    setLoading(true);
    try {
      if (positionToEdit) {
        await supabase
          .from('positions')
          .update({
            name: name.trim(),
            can_delete_orders: canDeleteOrders,
            can_revert_order_status: canRevertOrderStatus,
            can_skip_order_status: canSkipOrderStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', positionToEdit.id);

        await supabase
          .from('position_permissions')
          .delete()
          .eq('position_id', positionToEdit.id);

        if (selectedSections.size > 0) {
          const permissions = Array.from(selectedSections).map(section => ({
            position_id: positionToEdit.id,
            section
          }));

          await supabase
            .from('position_permissions')
            .insert(permissions);
        }

        await supabase
          .from('position_branches')
          .delete()
          .eq('position_id', positionToEdit.id);

        if (selectedBranches.size > 0) {
          const branchLinks = Array.from(selectedBranches).map(branch_id => ({
            position_id: positionToEdit.id,
            branch_id
          }));

          await supabase
            .from('position_branches')
            .insert(branchLinks);
        }
      } else {
        const { data: position, error: insertError } = await supabase
          .from('positions')
          .insert({
            partner_id: partnerId,
            name: name.trim(),
            can_delete_orders: canDeleteOrders,
            can_revert_order_status: canRevertOrderStatus,
            can_skip_order_status: canSkipOrderStatus
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating position:', insertError);
          alert('Ошибка при создании должности: ' + insertError.message);
          return;
        }

        if (position) {
          if (selectedSections.size > 0) {
            const permissions = Array.from(selectedSections).map(section => ({
              position_id: position.id,
              section
            }));

            await supabase
              .from('position_permissions')
              .insert(permissions);
          }

          if (selectedBranches.size > 0) {
            const branchLinks = Array.from(selectedBranches).map(branch_id => ({
              position_id: position.id,
              branch_id
            }));

            await supabase
              .from('position_branches')
              .insert(branchLinks);
          }
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving position:', error);
      alert('Ошибка при сохранении должности');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            {positionToEdit ? 'Редактировать должность' : 'Создать должность'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Название должности
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Менеджер, Оператор"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Доступы к разделам
              </label>
              <div className="space-y-3 bg-gray-50 rounded-xl p-4 max-h-80 overflow-y-auto">
                {AVAILABLE_SECTIONS.map((group) => (
                  <div key={group.name} className="space-y-2">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wide px-2">
                      {group.name}
                    </div>
                    {group.sections.map((section) => (
                      <label
                        key={section.id}
                        className="flex items-center gap-3 p-3 hover:bg-white rounded-lg transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSections.has(section.id)}
                          onChange={() => toggleSection(section.id)}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-gray-700 font-medium">{section.name}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Доступные филиалы
              </label>
              {branches.length > 0 ? (
                <div className="space-y-2 bg-gray-50 rounded-xl p-4 max-h-60 overflow-y-auto">
                  {branches.map((branch) => (
                    <label
                      key={branch.id}
                      className="flex items-center gap-3 p-3 hover:bg-white rounded-lg transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBranches.has(branch.id)}
                        onChange={() => toggleBranch(branch.id)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 font-medium">{branch.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-500">
                  Нет доступных филиалов
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Если не выбран ни один филиал, доступ будет ко всем филиалам
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl cursor-pointer hover:bg-orange-100 transition-colors">
                <input
                  type="checkbox"
                  checked={canDeleteOrders}
                  onChange={(e) => setCanDeleteOrders(e.target.checked)}
                  className="w-5 h-5 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
                />
                <div>
                  <span className="text-gray-900 font-semibold block">
                    Возможность удалять чеки
                  </span>
                  <span className="text-sm text-gray-600">
                    При включении будет отображаться кнопка удаления заказа
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors">
                <input
                  type="checkbox"
                  checked={canSkipOrderStatus}
                  onChange={(e) => setCanSkipOrderStatus(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <span className="text-gray-900 font-semibold block">
                    Возможность переводить статусы заказа вручную вперед
                  </span>
                  <span className="text-sm text-gray-600">
                    Позволяет менять статусы заказов без ограничений последовательности
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl cursor-pointer hover:bg-green-100 transition-colors">
                <input
                  type="checkbox"
                  checked={canRevertOrderStatus}
                  onChange={(e) => setCanRevertOrderStatus(e.target.checked)}
                  className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                />
                <div>
                  <span className="text-gray-900 font-semibold block">
                    Возможность откатывать статусы обратно
                  </span>
                  <span className="text-sm text-gray-600">
                    Позволяет менять статус заказа после его выполнения (например, с Выполнен обратно в Дороге или В работе)
                  </span>
                </div>
              </label>
            </div>
          </div>

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
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Сохранение...' : positionToEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
