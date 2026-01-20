import { useState } from 'react';
import { X, AlertCircle, CheckCircle, XCircle, Loader2, MessageSquare, Users, Bot, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface NotificationDiagnosticsProps {
  partnerId: string;
  onClose: () => void;
}

interface DiagnosticResult {
  category: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: string;
}

interface EmployeeInfo {
  id: string;
  first_name: string;
  last_name: string | null;
  telegram_user_id: string | null;
}

export default function NotificationDiagnostics({ partnerId, onClose }: NotificationDiagnosticsProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [employeesWithTelegram, setEmployeesWithTelegram] = useState<EmployeeInfo[]>([]);
  const [testingEmployee, setTestingEmployee] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const runDiagnostics = async () => {
    setLoading(true);
    const diagnostics: DiagnosticResult[] = [];

    try {
      // 1. Проверка настроек партнёра
      const { data: settings } = await supabase
        .from('partner_settings')
        .select('employee_bot_token, employee_bot_enabled, shift_reminders_enabled, shift_close_reminder_enabled, no_show_responsible_enabled, replacement_search_enabled')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (!settings) {
        diagnostics.push({
          category: 'Настройки партнёра',
          status: 'error',
          message: 'Настройки не найдены',
        });
      } else {
        if (!settings.employee_bot_token) {
          diagnostics.push({
            category: 'Токен бота',
            status: 'error',
            message: 'Токен бота сотрудников не настроен',
            details: 'Перейдите в настройки бота сотрудников и укажите токен',
          });
        } else if (!settings.employee_bot_enabled) {
          diagnostics.push({
            category: 'Токен бота',
            status: 'warning',
            message: 'Бот сотрудников отключен',
            details: 'Включите бот в настройках',
          });
        } else {
          diagnostics.push({
            category: 'Токен бота',
            status: 'ok',
            message: 'Токен бота настроен и активен',
          });
        }

        if (settings.shift_reminders_enabled) {
          diagnostics.push({
            category: 'Напоминания о смене',
            status: 'ok',
            message: 'Напоминания о смене включены',
          });
        } else {
          diagnostics.push({
            category: 'Напоминания о смене',
            status: 'warning',
            message: 'Напоминания о смене отключены',
          });
        }

        if (settings.shift_close_reminder_enabled) {
          diagnostics.push({
            category: 'Напоминания о закрытии',
            status: 'ok',
            message: 'Напоминания о закрытии включены',
          });
        } else {
          diagnostics.push({
            category: 'Напоминания о закрытии',
            status: 'warning',
            message: 'Напоминания о закрытии отключены',
          });
        }

        if (settings.no_show_responsible_enabled) {
          diagnostics.push({
            category: 'Уведомления ответственных',
            status: 'ok',
            message: 'Уведомления ответственных включены',
          });
        } else {
          diagnostics.push({
            category: 'Уведомления ответственных',
            status: 'warning',
            message: 'Уведомления ответственных отключены',
          });
        }

        if (settings.replacement_search_enabled) {
          diagnostics.push({
            category: 'Поиск замены',
            status: 'ok',
            message: 'Поиск замены включен',
          });
        } else {
          diagnostics.push({
            category: 'Поиск замены',
            status: 'warning',
            message: 'Поиск замены отключен',
          });
        }
      }

      // 2. Проверка сотрудников с telegram_user_id
      const { data: employees, count: totalEmployees } = await supabase
        .from('employees')
        .select('id, first_name, last_name, telegram_user_id', { count: 'exact' })
        .eq('partner_id', partnerId)
        .eq('is_active', true);

      const empWithTelegram = employees?.filter(e => e.telegram_user_id) || [];
      const employeesWithoutTelegram = (totalEmployees || 0) - empWithTelegram.length;

      setEmployeesWithTelegram(empWithTelegram as EmployeeInfo[]);

      if (employeesWithoutTelegram > 0) {
        diagnostics.push({
          category: 'Telegram ID сотрудников',
          status: 'warning',
          message: `${employeesWithoutTelegram} сотрудников без Telegram ID`,
          details: 'Сотрудники должны пройти регистрацию в боте',
        });
      }

      if (empWithTelegram.length > 0) {
        diagnostics.push({
          category: 'Telegram ID сотрудников',
          status: 'ok',
          message: `${empWithTelegram.length} сотрудников с Telegram ID`,
          details: 'Вы можете отправить тестовые уведомления ниже',
        });
      } else {
        diagnostics.push({
          category: 'Telegram ID сотрудников',
          status: 'error',
          message: 'Ни у одного сотрудника нет Telegram ID',
          details: 'Сотрудники должны пройти регистрацию в боте',
        });
      }

      // 3. Проверка попыток отправки сообщений
      const { data: recentShifts } = await supabase
        .from('schedule_shifts')
        .select('id, reminder_before_sent_at, reminder_late_sent_at, close_reminder_sent_at, no_show_notified_at')
        .eq('partner_id', partnerId)
        .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .limit(100);

      const shiftsWithReminders = recentShifts?.filter(s =>
        s.reminder_before_sent_at || s.reminder_late_sent_at || s.close_reminder_sent_at || s.no_show_notified_at
      ) || [];

      if (shiftsWithReminders.length > 0) {
        diagnostics.push({
          category: 'Отправка уведомлений',
          status: 'ok',
          message: `${shiftsWithReminders.length} смен с отправленными уведомлениями (за последние 7 дней)`,
        });
      } else if (recentShifts && recentShifts.length > 0) {
        diagnostics.push({
          category: 'Отправка уведомлений',
          status: 'error',
          message: 'Уведомления не отправляются',
          details: 'Проверьте логи edge function shift-reminders в Supabase Dashboard',
        });
      }

    } catch (error) {
      console.error('Diagnostics error:', error);
      diagnostics.push({
        category: 'Ошибка',
        status: 'error',
        message: 'Произошла ошибка при проверке',
        details: String(error),
      });
    }

    setResults(diagnostics);
    setLoading(false);
  };

  const sendTestNotification = async (employeeId: string, telegramId: string) => {
    setTestingEmployee(employeeId);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/test-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partner_id: partnerId,
          employee_id: employeeId,
          telegram_user_id: telegramId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResults(prev => ({
          ...prev,
          [employeeId]: {
            success: true,
            message: 'Сообщение отправлено успешно!',
          },
        }));
      } else {
        setTestResults(prev => ({
          ...prev,
          [employeeId]: {
            success: false,
            message: data.error || 'Не удалось отправить сообщение',
          },
        }));
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [employeeId]: {
          success: false,
          message: 'Ошибка при отправке: ' + String(error),
        },
      }));
    } finally {
      setTestingEmployee(null);
    }
  };

  const getStatusIcon = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusBg = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0 bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Диагностика уведомлений</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/80 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Важно: Как работают уведомления в Telegram
              </h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Бот НЕ может отправить сообщение пользователю, который не начал с ним диалог</li>
                <li>Каждый сотрудник должен найти бота в Telegram и нажать <strong>/start</strong></li>
                <li>Только после этого бот сможет отправлять ему личные уведомления</li>
                <li>Если пользователь заблокировал бота, уведомления также не придут</li>
              </ul>
            </div>

            {results.length === 0 && !loading && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Нажмите кнопку ниже, чтобы проверить настройки уведомлений</p>
                <button
                  onClick={runDiagnostics}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                >
                  Запустить диагностику
                </button>
              </div>
            )}

            {loading && (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Проверяем настройки...</p>
              </div>
            )}

            {results.length > 0 && (
              <>
                <div className="space-y-3">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-xl border ${getStatusBg(result.status)}`}
                    >
                      <div className="flex items-start gap-3">
                        {getStatusIcon(result.status)}
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 mb-1">
                            {result.category}
                          </div>
                          <div className="text-sm text-gray-700">
                            {result.message}
                          </div>
                          {result.details && (
                            <div className="text-xs text-gray-600 mt-2 p-2 bg-white/50 rounded">
                              {result.details}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {employeesWithTelegram.length > 0 && (
                  <div className="mt-6">
                    <h5 className="font-medium text-gray-900 mb-3">Тестирование уведомлений</h5>
                    <p className="text-sm text-gray-600 mb-4">
                      Отправьте тестовое уведомление любому сотруднику, чтобы проверить работу бота:
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {employeesWithTelegram.map(emp => {
                        const testResult = testResults[emp.id];
                        const isTesting = testingEmployee === emp.id;

                        return (
                          <div
                            key={emp.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {emp.first_name} {emp.last_name || ''}
                              </div>
                              {testResult && (
                                <div
                                  className={`text-xs mt-1 ${
                                    testResult.success ? 'text-green-700' : 'text-red-700'
                                  }`}
                                >
                                  {testResult.message}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => sendTestNotification(emp.id, emp.telegram_user_id!)}
                              disabled={isTesting}
                              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                            >
                              {isTesting ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Отправка...
                                </>
                              ) : (
                                <>
                                  <Send className="w-3 h-3" />
                                  Тест
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={runDiagnostics}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                  >
                    Повторить проверку
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                  >
                    Закрыть
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
