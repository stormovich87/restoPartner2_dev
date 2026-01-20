import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Save,
  Clock,
  Users,
  Bell,
  Building2,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Calendar
} from 'lucide-react';

interface ScheduleSettingsProps {
  partnerId: string;
}

interface Branch {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string | null;
  telegram_user_id: string | null;
  position?: { name: string } | null;
  branch?: { name: string } | null;
}

interface ResponsibleManager {
  id: string;
  partner_id: string;
  employee_id: string;
  is_active: boolean;
  employee?: Employee;
  branches: Branch[];
}

interface DeclineReason {
  id: string;
  partner_id: string;
  reason_text: string;
  sort_order: number;
  is_active: boolean;
}

interface PlanningSettings {
  planning_horizon_days: number;
  last_published_shift_date: string | null;
  manager_reminders_enabled: boolean;
  manager_reminders_every_n_days: number;
  manager_reminders_times_per_day: number;
  manager_reminders_at_times: string[];
  employee_confirm_reminders_enabled: boolean;
  employee_confirm_reminders_every_n_days: number;
  employee_confirm_reminders_times_per_day: number;
  employee_confirm_reminders_at_times: string[];
  schedule_confirm_deadline_hours: number;
  timezone: string;
}

export default function ScheduleSettings({ partnerId }: ScheduleSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [settings, setSettings] = useState<PlanningSettings>({
    planning_horizon_days: 14,
    last_published_shift_date: null,
    manager_reminders_enabled: false,
    manager_reminders_every_n_days: 1,
    manager_reminders_times_per_day: 1,
    manager_reminders_at_times: ['09:00'],
    employee_confirm_reminders_enabled: false,
    employee_confirm_reminders_every_n_days: 1,
    employee_confirm_reminders_times_per_day: 1,
    employee_confirm_reminders_at_times: ['10:00'],
    schedule_confirm_deadline_hours: 24,
    timezone: 'Europe/Kiev'
  });

  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [responsibleManagers, setResponsibleManagers] = useState<ResponsibleManager[]>([]);
  const [declineReasons, setDeclineReasons] = useState<DeclineReason[]>([]);

  const [showAddManager, setShowAddManager] = useState(false);
  const [selectedEmployeeForManager, setSelectedEmployeeForManager] = useState<string>('');
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());

  const [newReasonText, setNewReasonText] = useState('');
  const [editingReasonId, setEditingReasonId] = useState<string | null>(null);
  const [editingReasonText, setEditingReasonText] = useState('');

  useEffect(() => {
    loadData();
  }, [partnerId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsRes, branchesRes, employeesRes, managersRes, reasonsRes] = await Promise.all([
        supabase
          .from('partner_settings')
          .select('planning_horizon_days, last_published_shift_date, manager_reminders_enabled, manager_reminders_every_n_days, manager_reminders_times_per_day, manager_reminders_at_times, employee_confirm_reminders_enabled, employee_confirm_reminders_every_n_days, employee_confirm_reminders_times_per_day, employee_confirm_reminders_at_times, schedule_confirm_deadline_hours, timezone')
          .eq('partner_id', partnerId)
          .maybeSingle(),
        supabase
          .from('branches')
          .select('id, name')
          .eq('partner_id', partnerId)
          .order('name'),
        supabase
          .from('employees')
          .select('id, first_name, last_name, telegram_user_id, position:positions(name), branch:branches(name)')
          .eq('partner_id', partnerId)
          .eq('is_active', true)
          .order('first_name'),
        supabase
          .from('schedule_responsible_managers')
          .select(`
            id, partner_id, employee_id, is_active,
            employee:employees(id, first_name, last_name, telegram_user_id, position:positions(name), branch:branches(name))
          `)
          .eq('partner_id', partnerId)
          .eq('is_active', true),
        supabase
          .from('schedule_decline_reasons')
          .select('*')
          .eq('partner_id', partnerId)
          .order('sort_order')
      ]);

      if (settingsRes.data) {
        setSettings({
          ...settings,
          ...settingsRes.data,
          manager_reminders_at_times: settingsRes.data.manager_reminders_at_times || ['09:00'],
          employee_confirm_reminders_at_times: settingsRes.data.employee_confirm_reminders_at_times || ['10:00']
        });
      }

      if (branchesRes.data) {
        setBranches(branchesRes.data);
      }

      if (employeesRes.data) {
        setEmployees(employeesRes.data as Employee[]);
      }

      if (managersRes.data) {
        const managersWithBranches = await Promise.all(
          managersRes.data.map(async (manager) => {
            const { data: branchLinks } = await supabase
              .from('schedule_responsible_branches')
              .select('branch_id')
              .eq('responsible_manager_id', manager.id);

            const branchIds = branchLinks?.map(b => b.branch_id) || [];
            const managerBranches = branchesRes.data?.filter(b => branchIds.includes(b.id)) || [];

            return {
              ...manager,
              employee: manager.employee as Employee,
              branches: managerBranches
            } as ResponsibleManager;
          })
        );
        setResponsibleManagers(managersWithBranches);
      }

      if (reasonsRes.data) {
        setDeclineReasons(reasonsRes.data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Ошибка загрузки настроек' });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('partner_settings')
        .update({
          planning_horizon_days: settings.planning_horizon_days,
          manager_reminders_enabled: settings.manager_reminders_enabled,
          manager_reminders_every_n_days: settings.manager_reminders_every_n_days,
          manager_reminders_times_per_day: settings.manager_reminders_at_times.length,
          manager_reminders_at_times: settings.manager_reminders_at_times,
          employee_confirm_reminders_enabled: settings.employee_confirm_reminders_enabled,
          employee_confirm_reminders_every_n_days: settings.employee_confirm_reminders_every_n_days,
          employee_confirm_reminders_times_per_day: settings.employee_confirm_reminders_at_times.length,
          employee_confirm_reminders_at_times: settings.employee_confirm_reminders_at_times,
          schedule_confirm_deadline_hours: settings.schedule_confirm_deadline_hours
        })
        .eq('partner_id', partnerId);

      if (error) throw error;

      await supabase.from('schedule_action_logs').insert({
        partner_id: partnerId,
        actor_type: 'manager',
        action_type: 'settings_updated',
        target_type: 'settings',
        details: { settings }
      });

      setMessage({ type: 'success', text: 'Настройки сохранены' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Ошибка сохранения настроек' });
    } finally {
      setSaving(false);
    }
  };

  const addResponsibleManager = async () => {
    if (!selectedEmployeeForManager) return;

    try {
      const { data, error } = await supabase
        .from('schedule_responsible_managers')
        .insert({
          partner_id: partnerId,
          employee_id: selectedEmployeeForManager,
          is_active: true
        })
        .select(`
          id, partner_id, employee_id, is_active,
          employee:employees(id, first_name, last_name, telegram_user_id, position:positions(name), branch:branches(name))
        `)
        .single();

      if (error) throw error;

      if (data) {
        setResponsibleManagers([...responsibleManagers, {
          ...data,
          employee: data.employee as Employee,
          branches: []
        }]);
        setSelectedEmployeeForManager('');
        setShowAddManager(false);

        await supabase.from('schedule_action_logs').insert({
          partner_id: partnerId,
          actor_type: 'manager',
          action_type: 'responsible_manager_added',
          target_type: 'responsible_manager',
          target_id: data.id,
          details: { employee_id: selectedEmployeeForManager }
        });
      }
    } catch (error) {
      console.error('Error adding responsible manager:', error);
      setMessage({ type: 'error', text: 'Ошибка добавления ответственного' });
    }
  };

  const removeResponsibleManager = async (managerId: string) => {
    try {
      const { error } = await supabase
        .from('schedule_responsible_managers')
        .update({ is_active: false })
        .eq('id', managerId);

      if (error) throw error;

      setResponsibleManagers(responsibleManagers.filter(m => m.id !== managerId));

      await supabase.from('schedule_action_logs').insert({
        partner_id: partnerId,
        actor_type: 'manager',
        action_type: 'responsible_manager_removed',
        target_type: 'responsible_manager',
        target_id: managerId
      });
    } catch (error) {
      console.error('Error removing responsible manager:', error);
      setMessage({ type: 'error', text: 'Ошибка удаления ответственного' });
    }
  };

  const toggleManagerBranch = async (managerId: string, branchId: string, isAdding: boolean) => {
    try {
      if (isAdding) {
        const { error } = await supabase
          .from('schedule_responsible_branches')
          .insert({
            responsible_manager_id: managerId,
            branch_id: branchId
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('schedule_responsible_branches')
          .delete()
          .eq('responsible_manager_id', managerId)
          .eq('branch_id', branchId);
        if (error) throw error;
      }

      setResponsibleManagers(responsibleManagers.map(m => {
        if (m.id === managerId) {
          const branch = branches.find(b => b.id === branchId);
          return {
            ...m,
            branches: isAdding
              ? [...m.branches, branch!]
              : m.branches.filter(b => b.id !== branchId)
          };
        }
        return m;
      }));

      await supabase.from('schedule_action_logs').insert({
        partner_id: partnerId,
        actor_type: 'manager',
        action_type: isAdding ? 'branch_zone_added' : 'branch_zone_removed',
        target_type: 'responsible_branch',
        details: { manager_id: managerId, branch_id: branchId }
      });
    } catch (error) {
      console.error('Error toggling branch:', error);
      setMessage({ type: 'error', text: 'Ошибка изменения зоны ответственности' });
    }
  };

  const addDeclineReason = async () => {
    if (!newReasonText.trim()) return;

    try {
      const maxOrder = Math.max(...declineReasons.map(r => r.sort_order), 0);

      const { data, error } = await supabase
        .from('schedule_decline_reasons')
        .insert({
          partner_id: partnerId,
          reason_text: newReasonText.trim(),
          sort_order: maxOrder + 1,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setDeclineReasons([...declineReasons, data]);
        setNewReasonText('');
      }
    } catch (error) {
      console.error('Error adding decline reason:', error);
      setMessage({ type: 'error', text: 'Ошибка добавления причины' });
    }
  };

  const updateDeclineReason = async (reasonId: string) => {
    if (!editingReasonText.trim()) return;

    try {
      const { error } = await supabase
        .from('schedule_decline_reasons')
        .update({ reason_text: editingReasonText.trim() })
        .eq('id', reasonId);

      if (error) throw error;

      setDeclineReasons(declineReasons.map(r =>
        r.id === reasonId ? { ...r, reason_text: editingReasonText.trim() } : r
      ));
      setEditingReasonId(null);
      setEditingReasonText('');
    } catch (error) {
      console.error('Error updating decline reason:', error);
      setMessage({ type: 'error', text: 'Ошибка обновления причины' });
    }
  };

  const toggleDeclineReasonActive = async (reasonId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('schedule_decline_reasons')
        .update({ is_active: isActive })
        .eq('id', reasonId);

      if (error) throw error;

      setDeclineReasons(declineReasons.map(r =>
        r.id === reasonId ? { ...r, is_active: isActive } : r
      ));
    } catch (error) {
      console.error('Error toggling decline reason:', error);
      setMessage({ type: 'error', text: 'Ошибка изменения статуса причины' });
    }
  };

  const updateReminderTimes = (
    field: 'manager_reminders_at_times' | 'employee_confirm_reminders_at_times',
    count: number
  ) => {
    const currentTimes = settings[field];
    let newTimes: string[];

    if (count > currentTimes.length) {
      newTimes = [...currentTimes];
      for (let i = currentTimes.length; i < count; i++) {
        const hour = (9 + i * 2) % 24;
        newTimes.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    } else {
      newTimes = currentTimes.slice(0, count);
    }

    setSettings({ ...settings, [field]: newTimes });
  };

  const availableEmployeesForManager = employees.filter(
    emp => !responsibleManagers.some(m => m.employee_id === emp.id)
  );

  const requiredDate = new Date();
  requiredDate.setDate(requiredDate.getDate() + settings.planning_horizon_days);
  const requiredDateStr = requiredDate.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const isHorizonCovered = settings.last_published_shift_date
    ? new Date(settings.last_published_shift_date) >= requiredDate
    : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Горизонт планирования</h2>
              <p className="text-sm text-gray-600">Минимальный период, на который должен быть составлен график</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 w-48">
              Горизонт (дней вперёд):
            </label>
            <input
              type="number"
              min="1"
              max="90"
              value={settings.planning_horizon_days}
              onChange={(e) => setSettings({
                ...settings,
                planning_horizon_days: parseInt(e.target.value) || 14
              })}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-sm text-gray-500">дней</span>
          </div>

          <div className={`p-4 rounded-xl ${isHorizonCovered ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <div className="flex items-start gap-3">
              {isHorizonCovered ? (
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              )}
              <div>
                <div className={`font-medium ${isHorizonCovered ? 'text-green-700' : 'text-amber-700'}`}>
                  {isHorizonCovered
                    ? 'Горизонт планирования покрыт'
                    : 'Горизонт планирования НЕ покрыт'
                  }
                </div>
                <div className="text-sm mt-1">
                  <span className={isHorizonCovered ? 'text-green-600' : 'text-amber-600'}>
                    Требуемая дата: <strong>{requiredDateStr}</strong>
                  </span>
                  {settings.last_published_shift_date && (
                    <span className="ml-3 text-gray-600">
                      Последняя опубликованная: {new Date(settings.last_published_shift_date).toLocaleDateString('ru-RU')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Ответственные за график</h2>
                <p className="text-sm text-gray-600">Менеджеры, которые получают напоминания о необходимости заполнить график</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddManager(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Добавить
            </button>
          </div>
        </div>

        <div className="p-6">
          {showAddManager && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3">
                <select
                  value={selectedEmployeeForManager}
                  onChange={(e) => setSelectedEmployeeForManager(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Выберите сотрудника...</option>
                  {availableEmployeesForManager.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name || ''} {emp.position?.name ? `(${emp.position.name})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addResponsibleManager}
                  disabled={!selectedEmployeeForManager}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Добавить
                </button>
                <button
                  onClick={() => {
                    setShowAddManager(false);
                    setSelectedEmployeeForManager('');
                  }}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {responsibleManagers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Нет назначенных ответственных</p>
              <p className="text-sm mt-1">Добавьте менеджеров для получения напоминаний</p>
            </div>
          ) : (
            <div className="space-y-3">
              {responsibleManagers.map(manager => {
                const isExpanded = expandedManagers.has(manager.id);
                return (
                  <div key={manager.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div
                      className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => {
                        const newExpanded = new Set(expandedManagers);
                        if (isExpanded) {
                          newExpanded.delete(manager.id);
                        } else {
                          newExpanded.add(manager.id);
                        }
                        setExpandedManagers(newExpanded);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {manager.employee?.first_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {manager.employee?.first_name} {manager.employee?.last_name || ''}
                          </div>
                          <div className="text-sm text-gray-500">
                            {manager.employee?.position?.name || 'Без должности'}
                            {manager.branches.length > 0 && (
                              <span className="ml-2 text-green-600">
                                {manager.branches.length} {manager.branches.length === 1 ? 'филиал' : 'филиала(ов)'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!manager.employee?.telegram_user_id && (
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-lg">
                            Нет Telegram
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Удалить ответственного?')) {
                              removeResponsibleManager(manager.id);
                            }
                          }}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-6 border-t border-gray-200 bg-gray-50">
                        <div className="mb-4">
                          <div className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-blue-600" />
                            Зона ответственности (филиалы)
                          </div>
                          <p className="text-xs text-gray-600">
                            Менеджер будет получать уведомления только о выбранных филиалах
                          </p>
                        </div>

                        {branches.length === 0 ? (
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm text-amber-700">
                              Нет доступных филиалов для выбора
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {branches.map(branch => {
                                const isSelected = manager.branches.some(b => b.id === branch.id);
                                return (
                                  <button
                                    key={branch.id}
                                    onClick={() => toggleManagerBranch(manager.id, branch.id, !isSelected)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                      isSelected
                                        ? 'bg-green-500 text-white shadow-md hover:bg-green-600 border-2 border-green-600'
                                        : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-green-400 hover:bg-green-50'
                                    }`}
                                  >
                                    {isSelected && <Check className="w-4 h-4 inline mr-1" />}
                                    {branch.name}
                                  </button>
                                );
                              })}
                            </div>
                            {manager.branches.length === 0 && (
                              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg">
                                <p className="text-sm text-amber-700 font-medium">
                                  Выберите филиалы, за которые отвечает этот менеджер
                                </p>
                              </div>
                            )}
                            {manager.branches.length > 0 && (
                              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-sm text-green-700">
                                  <strong>Выбрано филиалов:</strong> {manager.branches.length} из {branches.length}
                                </p>
                                <p className="text-xs text-green-600 mt-1">
                                  {manager.branches.map(b => b.name).join(', ')}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-yellow-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Напоминания ответственным</h2>
              <p className="text-sm text-gray-600">Уведомления менеджерам, если горизонт планирования не заполнен</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.manager_reminders_enabled}
                onChange={(e) => setSettings({
                  ...settings,
                  manager_reminders_enabled: e.target.checked
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">
              {settings.manager_reminders_enabled ? 'Напоминания включены' : 'Напоминания выключены'}
            </span>
          </div>

          {settings.manager_reminders_enabled && (
            <div className="space-y-4 pl-4 border-l-4 border-amber-200">
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-700 w-48">Отправлять каждые:</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.manager_reminders_every_n_days}
                  onChange={(e) => setSettings({
                    ...settings,
                    manager_reminders_every_n_days: parseInt(e.target.value) || 1
                  })}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <span className="text-sm text-gray-500">дней</span>
              </div>

              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-700 w-48">Раз в день:</label>
                <select
                  value={settings.manager_reminders_times_per_day}
                  onChange={(e) => {
                    const count = parseInt(e.target.value);
                    updateReminderTimes('manager_reminders_at_times', count);
                  }}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  {[1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-500">раз</span>
              </div>

              <div>
                <label className="text-sm text-gray-700 block mb-2">Время отправки:</label>
                <div className="flex flex-wrap gap-2">
                  {settings.manager_reminders_at_times.map((time, idx) => (
                    <input
                      key={idx}
                      type="time"
                      value={time}
                      onChange={(e) => {
                        const newTimes = [...settings.manager_reminders_at_times];
                        newTimes[idx] = e.target.value;
                        setSettings({ ...settings, manager_reminders_at_times: newTimes });
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Часовой пояс: {settings.timezone}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Напоминания сотрудникам</h2>
              <p className="text-sm text-gray-600">Уведомления о необходимости подтвердить назначенные смены</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.employee_confirm_reminders_enabled}
                onChange={(e) => setSettings({
                  ...settings,
                  employee_confirm_reminders_enabled: e.target.checked
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">
              {settings.employee_confirm_reminders_enabled ? 'Напоминания включены' : 'Напоминания выключены'}
            </span>
          </div>

          {settings.employee_confirm_reminders_enabled && (
            <div className="space-y-4 pl-4 border-l-4 border-purple-200">
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <label className="text-sm text-gray-700 w-48">Дедлайн подтверждения:</label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={settings.schedule_confirm_deadline_hours}
                    onChange={(e) => setSettings({
                      ...settings,
                      schedule_confirm_deadline_hours: parseInt(e.target.value) || 24
                    })}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <span className="text-sm text-gray-500">часов до смены</span>
                </div>
                <p className="text-xs text-gray-500 ml-52">
                  Этот дедлайн также применяется к поздней отмене смены: если до начала осталось меньше указанного времени, отмена требует подтверждения ответственного.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-700 w-48">Отправлять каждые:</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.employee_confirm_reminders_every_n_days}
                  onChange={(e) => setSettings({
                    ...settings,
                    employee_confirm_reminders_every_n_days: parseInt(e.target.value) || 1
                  })}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <span className="text-sm text-gray-500">дней</span>
              </div>

              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-700 w-48">Раз в день:</label>
                <select
                  value={settings.employee_confirm_reminders_times_per_day}
                  onChange={(e) => {
                    const count = parseInt(e.target.value);
                    updateReminderTimes('employee_confirm_reminders_at_times', count);
                  }}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  {[1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-500">раз</span>
              </div>

              <div>
                <label className="text-sm text-gray-700 block mb-2">Время отправки:</label>
                <div className="flex flex-wrap gap-2">
                  {settings.employee_confirm_reminders_at_times.map((time, idx) => (
                    <input
                      key={idx}
                      type="time"
                      value={time}
                      onChange={(e) => {
                        const newTimes = [...settings.employee_confirm_reminders_at_times];
                        newTimes[idx] = e.target.value;
                        setSettings({ ...settings, employee_confirm_reminders_at_times: newTimes });
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Часовой пояс: {settings.timezone}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Причины отказа</h2>
              <p className="text-sm text-gray-600">Варианты причин, которые сотрудники могут выбрать при отказе от смены</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-2 mb-4">
            {declineReasons.map(reason => (
              <div
                key={reason.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  reason.is_active
                    ? 'bg-white border-gray-200'
                    : 'bg-gray-50 border-gray-100 opacity-60'
                }`}
              >
                {editingReasonId === reason.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editingReasonText}
                      onChange={(e) => setEditingReasonText(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      autoFocus
                    />
                    <button
                      onClick={() => updateDeclineReason(reason.id)}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingReasonId(null);
                        setEditingReasonText('');
                      }}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className={reason.is_active ? 'text-gray-900' : 'text-gray-500'}>
                      {reason.reason_text}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingReasonId(reason.id);
                          setEditingReasonText(reason.reason_text);
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => toggleDeclineReasonActive(reason.id, !reason.is_active)}
                        className={`text-sm ${
                          reason.is_active
                            ? 'text-amber-600 hover:text-amber-700'
                            : 'text-green-600 hover:text-green-700'
                        }`}
                      >
                        {reason.is_active ? 'Скрыть' : 'Показать'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newReasonText}
              onChange={(e) => setNewReasonText(e.target.value)}
              placeholder="Новая причина отказа..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addDeclineReason();
                }
              }}
            />
            <button
              onClick={addDeclineReason}
              disabled={!newReasonText.trim()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Добавить
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Сохранение...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Сохранить настройки
            </>
          )}
        </button>
      </div>
    </div>
  );
}
