import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Settings, MoreVertical, Send, CheckCircle, Clock, AlertTriangle, XCircle, History, UserX, RefreshCw, Phone, Mail, CreditCard, AtSign, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AddEmployeeModal from '../../components/AddEmployeeModal';
import EditEmployeeModal from '../../components/EditEmployeeModal';
import EmployeeBotSettingsModal from '../../components/EmployeeBotSettingsModal';
import EmployeeSettingsModal from '../../components/EmployeeSettingsModal';
import FireEmployeeModal from '../../components/FireEmployeeModal';
import RestoreEmployeeModal from '../../components/RestoreEmployeeModal';
import EmployeeHistoryModal from '../../components/EmployeeHistoryModal';
import EmployeeAvatar from '../../components/EmployeeAvatar';

interface Employee {
  id: string;
  partner_id: string;
  branch_id: string | null;
  position_id: string | null;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  telegram_username: string | null;
  telegram_user_id: string | null;
  bank_card_number: string | null;
  current_status: 'working' | 'on_vacation' | 'pending_dismissal' | 'fired';
  vacation_end_date: string | null;
  dismissal_date: string | null;
  dismissal_reason: string | null;
  dismissal_type: 'fired' | 'quit' | null;
  hire_date: string;
  is_active: boolean;
  created_at: string;
  photo_url: string | null;
  cabinet_slug: string | null;
  cabinet_login: string | null;
  cabinet_password: string | null;
  branch?: { id: string; name: string } | null;
  position?: { id: string; name: string } | null;
}

interface EmploymentHistoryEntry {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string | null;
  status_type: 'worked' | 'fired' | 'quit';
  fired_reason: string | null;
  created_at: string;
}

interface EmployeesProps {
  partnerId: string;
}

export default function Employees({ partnerId }: EmployeesProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<'working' | 'fired'>('working');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBotSettingsModal, setShowBotSettingsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showFireModal, setShowFireModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeHistory, setEmployeeHistory] = useState<EmploymentHistoryEntry[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    loadEmployees();
  }, [partnerId]);

  useEffect(() => {
    const channel = supabase
      .channel('employees_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employees',
          filter: `partner_id=eq.${partnerId}`
        },
        async (payload) => {
          loadEmployees();

          if (selectedEmployee && payload.new && (payload.new as any).id === selectedEmployee.id) {
            const { data } = await supabase
              .from('employees')
              .select(`
                *,
                branch:branches(id, name),
                position:positions(id, name)
              `)
              .eq('id', selectedEmployee.id)
              .single();

            if (data) {
              setSelectedEmployee(data);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [partnerId, selectedEmployee]);

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null);
      setMenuPosition(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          branch:branches(id, name),
          position:positions(id, name)
        `)
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeeHistory = async (employeeId: string) => {
    try {
      const { data, error } = await supabase
        .from('employment_history')
        .select('*')
        .eq('employee_id', employeeId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setEmployeeHistory(data || []);
    } catch (error) {
      console.error('Error loading employee history:', error);
    }
  };

  const handleOpenHistory = async (employee: Employee) => {
    setSelectedEmployee(employee);
    await loadEmployeeHistory(employee.id);
    setShowHistoryModal(true);
    setOpenMenuId(null);
  };

  const handleOpenFireModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowFireModal(true);
    setOpenMenuId(null);
  };

  const handleOpenRestoreModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowRestoreModal(true);
    setOpenMenuId(null);
  };

  const handleOpenEditModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEditModal(true);
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  const handleMenuClick = (e: React.MouseEvent<HTMLButtonElement>, employeeId: string) => {
    e.stopPropagation();
    if (openMenuId === employeeId) {
      setOpenMenuId(null);
      setMenuPosition(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.right - 192,
      });
      setOpenMenuId(employeeId);
    }
  };

  const handleCancelDismissal = async (employee: Employee) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          current_status: 'working',
          dismissal_date: null,
          dismissal_reason: null,
          dismissal_type: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', employee.id);

      if (error) throw error;
      loadEmployees();
    } catch (err) {
      console.error('Error canceling dismissal:', err);
    }
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const calculateWorkPeriod = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months--;
      const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
      days += prevMonth.getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years}г`);
    if (months > 0) parts.push(`${months}м`);
    if (days > 0) parts.push(`${days}д`);

    return parts.length > 0 ? parts.join(' ') : '0д';
  };

  const getStatusBadge = (employee: Employee) => {
    switch (employee.current_status) {
      case 'working':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            Работает
          </span>
        );
      case 'on_vacation':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
            <Clock className="w-3.5 h-3.5" />
            В отпуске до {employee.vacation_end_date ? formatDate(employee.vacation_end_date) : '—'}
          </span>
        );
      case 'pending_dismissal':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            Увольнение {employee.dismissal_date ? formatDate(employee.dismissal_date) : ''}
          </span>
        );
      case 'fired':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-full font-medium">
            <XCircle className="w-3.5 h-3.5" />
            Уволен
          </span>
        );
      default:
        return null;
    }
  };

  const getTelegramLink = (employee: Employee) => {
    if (employee.telegram_username) {
      return `https://t.me/${employee.telegram_username.replace('@', '')}`;
    }
    if (employee.phone) {
      const digits = employee.phone.replace(/\D/g, '');
      return `tg://resolve?phone=${digits}`;
    }
    return null;
  };

  const workingEmployees = employees.filter(e => e.is_active);
  const firedEmployees = employees.filter(e => !e.is_active);
  const displayedEmployees = activeTab === 'working' ? workingEmployees : firedEmployees;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showAddModal && (
        <AddEmployeeModal
          partnerId={partnerId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadEmployees();
          }}
        />
      )}

      {showBotSettingsModal && (
        <EmployeeBotSettingsModal
          partnerId={partnerId}
          onClose={() => setShowBotSettingsModal(false)}
        />
      )}

      {showSettingsModal && (
        <EmployeeSettingsModal
          partnerId={partnerId}
          onClose={() => setShowSettingsModal(false)}
          onSuccess={() => {
            setShowSettingsModal(false);
          }}
        />
      )}

      {showFireModal && selectedEmployee && (
        <FireEmployeeModal
          employee={selectedEmployee}
          onClose={() => {
            setShowFireModal(false);
            setSelectedEmployee(null);
          }}
          onSuccess={() => {
            setShowFireModal(false);
            setSelectedEmployee(null);
            loadEmployees();
          }}
        />
      )}

      {showRestoreModal && selectedEmployee && (
        <RestoreEmployeeModal
          employee={selectedEmployee}
          onClose={() => {
            setShowRestoreModal(false);
            setSelectedEmployee(null);
          }}
          onSuccess={() => {
            setShowRestoreModal(false);
            setSelectedEmployee(null);
            loadEmployees();
          }}
        />
      )}

      {showHistoryModal && selectedEmployee && (
        <EmployeeHistoryModal
          employee={selectedEmployee}
          history={employeeHistory}
          onClose={() => {
            setShowHistoryModal(false);
            setSelectedEmployee(null);
            setEmployeeHistory([]);
          }}
        />
      )}

      {showEditModal && selectedEmployee && (
        <EditEmployeeModal
          partnerId={partnerId}
          employee={selectedEmployee}
          onClose={() => {
            setShowEditModal(false);
            setSelectedEmployee(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedEmployee(null);
            loadEmployees();
          }}
        />
      )}

      {openMenuId && menuPosition && createPortal(
        <div
          className="fixed w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-[9999]"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <button
            onClick={() => {
              const emp = employees.find(e => e.id === openMenuId);
              if (emp) handleOpenEditModal(emp);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Редактировать
          </button>
          <button
            onClick={() => {
              const emp = employees.find(e => e.id === openMenuId);
              if (emp) handleOpenHistory(emp);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <History className="w-4 h-4" />
            История
          </button>
          {activeTab === 'working' ? (
            (() => {
              const emp = employees.find(e => e.id === openMenuId);
              if (emp?.current_status === 'pending_dismissal') {
                return (
                  <button
                    onClick={() => {
                      if (emp) handleCancelDismissal(emp);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-green-600 hover:bg-green-50 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Отменить увольнение
                  </button>
                );
              }
              return (
                <button
                  onClick={() => {
                    if (emp) handleOpenFireModal(emp);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors"
                >
                  <UserX className="w-4 h-4" />
                  Уволить
                </button>
              );
            })()
          ) : (
            <button
              onClick={() => {
                const emp = employees.find(e => e.id === openMenuId);
                if (emp) handleOpenRestoreModal(emp);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-left text-green-600 hover:bg-green-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Восстановить в работе
            </button>
          )}
        </div>,
        document.body
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Сотрудники</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBotSettingsModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold"
          >
            <Settings className="w-5 h-5" />
            <span>Настроить бота</span>
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold"
          >
            <Settings className="w-5 h-5" />
            <span>Настройки</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold"
          >
            <Plus className="w-5 h-5" />
            <span>Добавить сотрудника</span>
          </button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('working')}
          className={`px-6 py-3 font-semibold transition-all ${
            activeTab === 'working'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Работают ({workingEmployees.length})
        </button>
        <button
          onClick={() => setActiveTab('fired')}
          className={`px-6 py-3 font-semibold transition-all ${
            activeTab === 'fired'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Уволенные ({firedEmployees.length})
        </button>
      </div>

      {displayedEmployees.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-600 font-medium">
            {activeTab === 'working' ? 'Нет работающих сотрудников' : 'Нет уволенных сотрудников'}
          </p>
          {activeTab === 'working' && (
            <p className="text-sm text-gray-500 mt-2">Добавьте первого сотрудника для начала работы</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-visible">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full min-w-full mb-0">
              <thead className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-14">
                    Фото
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Имя Фамилия
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Должность
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Филиал
                  </th>
                  {activeTab === 'working' ? (
                    <>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Дата регистрации
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Статус
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Дата приёма
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Дата увольнения
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Период работы
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider max-w-[200px]">
                        Причина увольнения
                      </th>
                    </>
                  )}
                  <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Telegram
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Телефон
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Карта
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedEmployees.map((employee) => {
                  const telegramLink = getTelegramLink(employee);
                  const lastHistoryEntry = employeeHistory.find(h => h.employee_id === employee.id && h.end_date);

                  return (
                    <tr key={employee.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-4 py-4">
                        <EmployeeAvatar
                          photoUrl={employee.photo_url}
                          firstName={employee.first_name}
                          lastName={employee.last_name}
                          size="md"
                          onClick={() => handleOpenEditModal(employee)}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-gray-900">
                          {employee.first_name} {employee.last_name || ''}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-gray-700">{employee.position?.name || '—'}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-gray-700">{employee.branch?.name || '—'}</span>
                      </td>
                      {activeTab === 'working' ? (
                        <>
                          <td className="px-4 py-4">
                            <span className="text-gray-600 text-sm">
                              {formatDate(employee.created_at)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            {getStatusBadge(employee)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-4">
                            <span className="text-gray-600 text-sm">
                              {formatDate(employee.hire_date)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-gray-600 text-sm">
                              {employee.updated_at ? formatDate(employee.updated_at) : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-gray-600 text-sm font-mono">
                              {employee.updated_at
                                ? calculateWorkPeriod(employee.hire_date, employee.updated_at)
                                : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-4 max-w-[200px]">
                            <span className="text-gray-600 text-sm truncate block" title={lastHistoryEntry?.fired_reason || ''}>
                              {lastHistoryEntry?.fired_reason || '—'}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-4 text-center">
                        {telegramLink ? (
                          <a
                            href={telegramLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                            title="Открыть в Telegram"
                          >
                            <Send className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {employee.phone ? (
                          <a href={`tel:${employee.phone}`} className="flex items-center gap-1.5 text-gray-700 hover:text-blue-600 transition-colors">
                            <Phone className="w-3.5 h-3.5" />
                            <span className="text-sm">{employee.phone}</span>
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {employee.email ? (
                          <a href={`mailto:${employee.email}`} className="flex items-center gap-1.5 text-gray-700 hover:text-blue-600 transition-colors">
                            <Mail className="w-3.5 h-3.5" />
                            <span className="text-sm truncate max-w-[150px]">{employee.email}</span>
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {employee.telegram_username ? (
                          <span className="flex items-center gap-1.5 text-gray-700">
                            <AtSign className="w-3.5 h-3.5" />
                            <span className="text-sm">{employee.telegram_username}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {employee.bank_card_number ? (
                          <span className="flex items-center gap-1.5 text-gray-700">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span className="text-sm font-mono">
                              **** {employee.bank_card_number.slice(-4)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={(e) => handleMenuClick(e, employee.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-600" />
                        </button>
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
