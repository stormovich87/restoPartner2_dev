import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  X,
  Timer,
  AlertTriangle,
  Users,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  Search,
  RefreshCw,
  Building2
} from 'lucide-react';

interface DeadlinesSettingsModalProps {
  partnerId: string;
  onClose: () => void;
}

interface Position {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string | null;
  position_id: string | null;
  photo_url: string | null;
}

interface Branch {
  id: string;
  name: string;
}

interface BranchGroup {
  id: string;
  name: string;
  branch_ids: string[];
}

interface DeadlinesSettings {
  noShowThresholdMinutes: number;
  noShowReasonsEnabled: boolean;
  noShowReasons: string[];
  noShowResponsibleEnabled: boolean;
  noShowResponsiblePositionId: string | null;
  noShowResponsibleEmployeeIds: string[];
  earlyLeaveThresholdMinutes: number;
  replacementSearchEnabled: boolean;
  replacementNotifyScope: 'same_position' | 'all_employees';
  replacementBranchScope: 'same_branch' | 'all_branches' | 'branch_groups';
  replacementBranchGroups: BranchGroup[];
}

export default function DeadlinesSettingsModal({ partnerId, onClose }: DeadlinesSettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [settings, setSettings] = useState<DeadlinesSettings>({
    noShowThresholdMinutes: 30,
    noShowReasonsEnabled: false,
    noShowReasons: [],
    noShowResponsibleEnabled: false,
    noShowResponsiblePositionId: null,
    noShowResponsibleEmployeeIds: [],
    earlyLeaveThresholdMinutes: 5,
    replacementSearchEnabled: false,
    replacementNotifyScope: 'same_position',
    replacementBranchScope: 'same_branch',
    replacementBranchGroups: []
  });
  const [newReason, setNewReason] = useState('');
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showNotifyScopeDropdown, setShowNotifyScopeDropdown] = useState(false);
  const [showBranchScopeDropdown, setShowBranchScopeDropdown] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [showBranchDropdownFor, setShowBranchDropdownFor] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [partnerId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setShowPositionDropdown(false);
        setShowEmployeeDropdown(false);
        setShowNotifyScopeDropdown(false);
        setShowBranchScopeDropdown(false);
        setShowBranchDropdownFor(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsRes, positionsRes, employeesRes, branchesRes] = await Promise.all([
        supabase
          .from('partner_settings')
          .select('no_show_threshold_minutes, no_show_reasons_enabled, no_show_reasons, no_show_responsible_enabled, no_show_responsible_position_id, no_show_responsible_employee_ids, early_leave_threshold_minutes, replacement_search_enabled, replacement_notify_scope, replacement_branch_scope, replacement_branch_groups')
          .eq('partner_id', partnerId)
          .maybeSingle(),
        supabase
          .from('positions')
          .select('id, name')
          .eq('partner_id', partnerId)
          .eq('is_visible', true)
          .order('name'),
        supabase
          .from('employees')
          .select('id, first_name, last_name, position_id, photo_url')
          .eq('partner_id', partnerId)
          .eq('is_active', true)
          .in('current_status', ['working', 'on_vacation', 'pending_dismissal'])
          .order('first_name'),
        supabase
          .from('branches')
          .select('id, name')
          .eq('partner_id', partnerId)
          .eq('status', 'active')
          .order('name')
      ]);

      if (settingsRes.data) {
        setSettings({
          noShowThresholdMinutes: settingsRes.data.no_show_threshold_minutes || 30,
          noShowReasonsEnabled: settingsRes.data.no_show_reasons_enabled || false,
          noShowReasons: settingsRes.data.no_show_reasons || [],
          noShowResponsibleEnabled: settingsRes.data.no_show_responsible_enabled || false,
          noShowResponsiblePositionId: settingsRes.data.no_show_responsible_position_id || null,
          noShowResponsibleEmployeeIds: settingsRes.data.no_show_responsible_employee_ids || [],
          earlyLeaveThresholdMinutes: settingsRes.data.early_leave_threshold_minutes || 5,
          replacementSearchEnabled: settingsRes.data.replacement_search_enabled || false,
          replacementNotifyScope: settingsRes.data.replacement_notify_scope || 'same_position',
          replacementBranchScope: settingsRes.data.replacement_branch_scope || 'same_branch',
          replacementBranchGroups: settingsRes.data.replacement_branch_groups || []
        });
      }

      if (positionsRes.data) setPositions(positionsRes.data);
      if (employeesRes.data) setEmployees(employeesRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
    } catch (error) {
      console.error('Error loading deadlines settings:', error);
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
          no_show_threshold_minutes: settings.noShowThresholdMinutes,
          no_show_reasons_enabled: settings.noShowReasonsEnabled,
          no_show_reasons: settings.noShowReasons,
          no_show_responsible_enabled: settings.noShowResponsibleEnabled,
          no_show_responsible_position_id: settings.noShowResponsiblePositionId,
          no_show_responsible_employee_ids: settings.noShowResponsibleEmployeeIds,
          early_leave_threshold_minutes: settings.earlyLeaveThresholdMinutes,
          replacement_search_enabled: settings.replacementSearchEnabled,
          replacement_notify_scope: settings.replacementNotifyScope,
          replacement_branch_scope: settings.replacementBranchScope,
          replacement_branch_groups: settings.replacementBranchGroups
        })
        .eq('partner_id', partnerId);

      if (error) throw error;
      onClose();
    } catch (error) {
      console.error('Error saving deadlines settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const formatThresholdTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const parseThresholdTime = (timeStr: string): number => {
    const [hours, mins] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (mins || 0);
  };

  const addReason = () => {
    if (newReason.trim() && !settings.noShowReasons.includes(newReason.trim())) {
      setSettings(prev => ({
        ...prev,
        noShowReasons: [...prev.noShowReasons, newReason.trim()]
      }));
      setNewReason('');
    }
  };

  const removeReason = (index: number) => {
    setSettings(prev => ({
      ...prev,
      noShowReasons: prev.noShowReasons.filter((_, i) => i !== index)
    }));
  };

  const selectPosition = (positionId: string | null) => {
    setSettings(prev => ({
      ...prev,
      noShowResponsiblePositionId: positionId,
      noShowResponsibleEmployeeIds: []
    }));
    setShowPositionDropdown(false);
  };

  const toggleEmployee = (employeeId: string) => {
    setSettings(prev => {
      const ids = prev.noShowResponsibleEmployeeIds;
      if (ids.includes(employeeId)) {
        return { ...prev, noShowResponsibleEmployeeIds: ids.filter(id => id !== employeeId) };
      } else {
        return { ...prev, noShowResponsibleEmployeeIds: [...ids, employeeId] };
      }
    });
  };

  const filteredEmployees = employees.filter(emp => {
    if (settings.noShowResponsiblePositionId && emp.position_id !== settings.noShowResponsiblePositionId) {
      return false;
    }
    if (employeeSearch) {
      const name = `${emp.first_name} ${emp.last_name || ''}`.toLowerCase();
      return name.includes(employeeSearch.toLowerCase());
    }
    return true;
  });

  const selectedPosition = positions.find(p => p.id === settings.noShowResponsiblePositionId);
  const selectedEmployees = employees.filter(e => settings.noShowResponsibleEmployeeIds.includes(e.id));

  const addBranchGroup = () => {
    const newGroup: BranchGroup = {
      id: crypto.randomUUID(),
      name: `Группа ${settings.replacementBranchGroups.length + 1}`,
      branch_ids: []
    };
    setSettings(prev => ({
      ...prev,
      replacementBranchGroups: [...prev.replacementBranchGroups, newGroup]
    }));
    setEditingGroupId(newGroup.id);
  };

  const removeBranchGroup = (groupId: string) => {
    setSettings(prev => ({
      ...prev,
      replacementBranchGroups: prev.replacementBranchGroups.filter(g => g.id !== groupId)
    }));
    if (editingGroupId === groupId) setEditingGroupId(null);
  };

  const updateGroupName = (groupId: string, name: string) => {
    setSettings(prev => ({
      ...prev,
      replacementBranchGroups: prev.replacementBranchGroups.map(g =>
        g.id === groupId ? { ...g, name } : g
      )
    }));
  };

  const addBranchToGroup = (groupId: string, branchId: string) => {
    setSettings(prev => ({
      ...prev,
      replacementBranchGroups: prev.replacementBranchGroups.map(g =>
        g.id === groupId && !g.branch_ids.includes(branchId)
          ? { ...g, branch_ids: [...g.branch_ids, branchId] }
          : g
      )
    }));
    setShowBranchDropdownFor(null);
  };

  const removeBranchFromGroup = (groupId: string, branchId: string) => {
    setSettings(prev => ({
      ...prev,
      replacementBranchGroups: prev.replacementBranchGroups.map(g =>
        g.id === groupId
          ? { ...g, branch_ids: g.branch_ids.filter(id => id !== branchId) }
          : g
      )
    }));
  };

  const getBranchName = (branchId: string) => {
    return branches.find(b => b.id === branchId)?.name || 'Неизвестный';
  };

  const getAvailableBranchesForGroup = (groupId: string) => {
    const group = settings.replacementBranchGroups.find(g => g.id === groupId);
    if (!group) return branches;
    return branches.filter(b => !group.branch_ids.includes(b.id));
  };

  const notifyScopeLabels: Record<string, string> = {
    same_position: 'Сотрудников той же должности',
    all_employees: 'Всех сотрудников'
  };

  const branchScopeLabels: Record<string, string> = {
    same_branch: 'Только этот филиал',
    all_branches: 'Все филиалы',
    branch_groups: 'Группы филиалов'
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Загрузка...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <Timer className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Настройки дедлайнов</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h4 className="font-medium text-gray-900">Не выход на смену</h4>
            </div>

            <div className="bg-red-50 rounded-xl p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Считать не выход через
                </label>
                <input
                  type="time"
                  value={formatThresholdTime(settings.noShowThresholdMinutes)}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    noShowThresholdMinutes: parseThresholdTime(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <p className="text-sm text-gray-600">
                Отсчёт идёт от планового начала смены.
                Пока дедлайн не наступил - считается опоздание.
                После дедлайна статус смены меняется на "Не выход".
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6 space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-gray-700 font-medium">Разрешить указывать причину не выхода</span>
              <button
                onClick={() => setSettings(prev => ({ ...prev, noShowReasonsEnabled: !prev.noShowReasonsEnabled }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.noShowReasonsEnabled ? 'bg-red-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.noShowReasonsEnabled ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </label>

            {settings.noShowReasonsEnabled && (
              <div className="space-y-3 pl-4 border-l-2 border-red-200">
                <p className="text-sm text-gray-600">
                  Сотрудник сможет выбрать причину не выхода в своём кабинете.
                </p>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Список причин
                  </label>

                  {settings.noShowReasons.map((reason, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={reason}
                        onChange={(e) => {
                          const newReasons = [...settings.noShowReasons];
                          newReasons[index] = e.target.value;
                          setSettings(prev => ({ ...prev, noShowReasons: newReasons }));
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                      />
                      <button
                        onClick={() => removeReason(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addReason()}
                      placeholder="Новая причина..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    />
                    <button
                      onClick={addReason}
                      disabled={!newReason.trim()}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <Timer className="w-5 h-5 text-orange-600" />
              <h4 className="font-medium text-gray-900">Раннее закрытие смены</h4>
            </div>

            <div className="bg-orange-50 rounded-xl p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Считать ранним закрытием если ушёл раньше на
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={settings.earlyLeaveThresholdMinutes}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      earlyLeaveThresholdMinutes: Math.max(1, Math.min(120, parseInt(e.target.value) || 1))
                    }))}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <span className="text-gray-700">минут</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Если смена закрыта раньше запланированного времени на указанное количество минут или больше,
                в графике работы будет отображаться метка "Закрыто раньше".
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-600" />
              <h4 className="font-medium text-gray-900">Ответственные за не выход</h4>
            </div>

            <label className="flex items-center justify-between">
              <span className="text-gray-700">Подключить ответственных</span>
              <button
                onClick={() => setSettings(prev => ({ ...prev, noShowResponsibleEnabled: !prev.noShowResponsibleEnabled }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.noShowResponsibleEnabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.noShowResponsibleEnabled ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </label>

            {settings.noShowResponsibleEnabled && (
              <div className="space-y-4 pl-4 border-l-2 border-blue-200">
                <p className="text-sm text-gray-600">
                  Ответственные получат уведомления в Telegram и в кабинете при не выходе сотрудника на смену.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Должность (опционально)
                    </label>
                    <div className="relative dropdown-container">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPositionDropdown(!showPositionDropdown);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 transition-colors"
                      >
                        <span className={selectedPosition ? 'text-gray-900' : 'text-gray-500'}>
                          {selectedPosition?.name || 'Все должности'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>

                      {showPositionDropdown && (
                        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200 max-h-48 overflow-y-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectPosition(null);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors text-gray-500"
                          >
                            Все должности
                          </button>
                          {positions.map(position => (
                            <button
                              key={position.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectPosition(position.id);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                            >
                              <span>{position.name}</span>
                              {position.id === settings.noShowResponsiblePositionId && (
                                <Check className="w-4 h-4 text-blue-600" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Сотрудники
                    </label>

                    {selectedEmployees.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {selectedEmployees.map(emp => (
                          <div
                            key={emp.id}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm"
                          >
                            <span>{emp.first_name} {emp.last_name || ''}</span>
                            <button
                              onClick={() => toggleEmployee(emp.id)}
                              className="p-0.5 hover:bg-blue-100 rounded-full"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="relative dropdown-container">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEmployeeDropdown(!showEmployeeDropdown);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-gray-500">
                          Выбрать сотрудников...
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>

                      {showEmployeeDropdown && (
                        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200 max-h-64 overflow-hidden">
                          <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                value={employeeSearch}
                                onChange={(e) => setEmployeeSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Поиск..."
                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {filteredEmployees.length === 0 ? (
                              <div className="px-3 py-4 text-center text-gray-500 text-sm">
                                Сотрудники не найдены
                              </div>
                            ) : (
                              filteredEmployees.map(emp => {
                                const isSelected = settings.noShowResponsibleEmployeeIds.includes(emp.id);
                                return (
                                  <button
                                    key={emp.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleEmployee(emp.id);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                                  >
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                      isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                                    }`}>
                                      {isSelected && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    {emp.photo_url ? (
                                      <img
                                        src={emp.photo_url}
                                        alt=""
                                        className="w-8 h-8 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                        <Users className="w-4 h-4 text-gray-500" />
                                      </div>
                                    )}
                                    <span className="text-gray-900">
                                      {emp.first_name} {emp.last_name || ''}
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {settings.noShowResponsibleEmployeeIds.length > 0 && (
                  <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-800">
                    <p className="font-medium mb-1">Что получат ответственные:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-700">
                      <li>Уведомление в Telegram с фото и данными сотрудника</li>
                      <li>Уведомление в кабинете (раздел "События")</li>
                      <li>Кнопки "Принять" / "Отклонить" для причины</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-green-600" />
              <h4 className="font-medium text-gray-900">Поиск замены</h4>
            </div>

            <label className="flex items-center justify-between">
              <span className="text-gray-700">Искать замену при не выходе сотрудника</span>
              <button
                onClick={() => setSettings(prev => ({ ...prev, replacementSearchEnabled: !prev.replacementSearchEnabled }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.replacementSearchEnabled ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    settings.replacementSearchEnabled ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </label>

            {settings.replacementSearchEnabled && (
              <div className="space-y-4 pl-4 border-l-2 border-green-200">
                <p className="text-sm text-gray-600">
                  При не выходе сотрудника система автоматически отправит уведомления кандидатам на замену.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Кого оповещать
                    </label>
                    <div className="relative dropdown-container">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowNotifyScopeDropdown(!showNotifyScopeDropdown);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-gray-900">
                          {notifyScopeLabels[settings.replacementNotifyScope]}
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>

                      {showNotifyScopeDropdown && (
                        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200">
                          {Object.entries(notifyScopeLabels).map(([value, label]) => (
                            <button
                              key={value}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSettings(prev => ({ ...prev, replacementNotifyScope: value as 'same_position' | 'all_employees' }));
                                setShowNotifyScopeDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center justify-between first:rounded-t-xl last:rounded-b-xl"
                            >
                              <span>{label}</span>
                              {settings.replacementNotifyScope === value && (
                                <Check className="w-4 h-4 text-green-600" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Где искать замену
                    </label>
                    <div className="relative dropdown-container">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowBranchScopeDropdown(!showBranchScopeDropdown);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-gray-900">
                          {branchScopeLabels[settings.replacementBranchScope]}
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>

                      {showBranchScopeDropdown && (
                        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200">
                          {Object.entries(branchScopeLabels).map(([value, label]) => (
                            <button
                              key={value}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSettings(prev => ({ ...prev, replacementBranchScope: value as 'same_branch' | 'all_branches' | 'branch_groups' }));
                                setShowBranchScopeDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center justify-between first:rounded-t-xl last:rounded-b-xl"
                            >
                              <span>{label}</span>
                              {settings.replacementBranchScope === value && (
                                <Check className="w-4 h-4 text-green-600" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {settings.replacementBranchScope === 'branch_groups' && (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Группы филиалов
                      </label>

                      {settings.replacementBranchGroups.map((group) => (
                        <div key={group.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-500" />
                            <input
                              type="text"
                              value={group.name}
                              onChange={(e) => updateGroupName(group.id, e.target.value)}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                              placeholder="Название группы"
                            />
                            <button
                              onClick={() => removeBranchGroup(group.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {group.branch_ids.map((branchId) => (
                              <div
                                key={branchId}
                                className="flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-200 rounded-lg text-sm"
                              >
                                <span>{getBranchName(branchId)}</span>
                                <button
                                  onClick={() => removeBranchFromGroup(group.id, branchId)}
                                  className="p-0.5 hover:bg-gray-100 rounded"
                                >
                                  <X className="w-3 h-3 text-gray-500" />
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="relative dropdown-container">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowBranchDropdownFor(showBranchDropdownFor === group.id ? null : group.id);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Филиал</span>
                            </button>

                            {showBranchDropdownFor === group.id && (
                              <div className="absolute z-50 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 max-h-48 overflow-y-auto">
                                {getAvailableBranchesForGroup(group.id).length === 0 ? (
                                  <div className="px-3 py-2 text-sm text-gray-500">
                                    Нет доступных филиалов
                                  </div>
                                ) : (
                                  getAvailableBranchesForGroup(group.id).map((branch) => (
                                    <button
                                      key={branch.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addBranchToGroup(group.id, branch.id);
                                      }}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                                    >
                                      {branch.name}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={addBranchGroup}
                        className="flex items-center gap-2 px-3 py-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Группа</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-green-50 rounded-xl p-3 text-sm text-green-800">
                  <p className="font-medium mb-1">Как это работает:</p>
                  <ul className="list-disc list-inside space-y-1 text-green-700">
                    <li>При не выходе кандидаты получат уведомление "Срочная смена"</li>
                    <li>Первый принявший выберет время прибытия и займёт смену</li>
                    <li>Остальные уведомления будут автоматически удалены</li>
                    <li>Ответственные получат подтверждение о замене</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
