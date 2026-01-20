import { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, Info, XCircle, Filter, Download, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LogEntry {
  id: string;
  partner_id: string;
  section: string;
  log_level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details: any;
  user_id: string | null;
  action?: string;
  created_at: string;
}

interface LogViewerProps {
  partnerId: string;
}

const SECTIONS = [
  { value: 'all', label: 'Все разделы' },
  { value: 'orders', label: 'Заказы' },
  { value: 'branches', label: 'Филиалы' },
  { value: 'couriers', label: 'Курьеры' },
  { value: 'payment_methods', label: 'Типы оплаты' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'settings', label: 'Настройки' },
  { value: 'auth', label: 'Авторизация' },
  { value: 'system', label: 'Система' },
  { value: 'general', label: 'Общие' },
];

const LOG_LEVELS = [
  { value: 'all', label: 'Все уровни', color: 'gray' },
  { value: 'info', label: 'Информация', color: 'blue', icon: Info },
  { value: 'warning', label: 'Предупреждение', color: 'yellow', icon: AlertTriangle },
  { value: 'error', label: 'Ошибка', color: 'red', icon: AlertCircle },
  { value: 'critical', label: 'Критическая', color: 'purple', icon: XCircle },
];

export default function LogViewer({ partnerId }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, [partnerId, sectionFilter, levelFilter]);

  const loadLogs = async () => {
    try {
      let query = supabase
        .from('logs')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (sectionFilter !== 'all') {
        query = query.eq('section', sectionFilter);
      }

      if (levelFilter !== 'all') {
        query = query.eq('log_level', levelFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!confirm('Вы уверены, что хотите очистить все логи?')) return;

    try {
      const { error } = await supabase
        .from('logs')
        .delete()
        .eq('partner_id', partnerId);

      if (error) throw error;

      loadLogs();
    } catch (error) {
      console.error('Error clearing logs:', error);
      alert('Ошибка при очистке логов');
    }
  };

  const exportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `logs_${new Date().toISOString()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getLevelColor = (level: string) => {
    const levelConfig = LOG_LEVELS.find(l => l.value === level);
    return levelConfig?.color || 'gray';
  };

  const getLevelIcon = (level: string) => {
    const levelConfig = LOG_LEVELS.find(l => l.value === level);
    return levelConfig?.icon || Info;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-600 font-medium">Загрузка логов...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Filter className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SECTIONS.map(section => (
                <option key={section.value} value={section.value}>{section.label}</option>
              ))}
            </select>
          </div>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-xl bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {LOG_LEVELS.map(level => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportLogs}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Экспорт
          </button>
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-5 h-5" />
            Очистить
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-12 text-center">
          <p className="text-gray-600 font-medium">Логи отсутствуют</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const LevelIcon = getLevelIcon(log.log_level);
            const levelColor = getLevelColor(log.log_level);
            const isExpanded = expandedLog === log.id;

            return (
              <div
                key={log.id}
                className="bg-white/80 backdrop-blur-xl rounded-xl shadow border border-gray-200/50 overflow-hidden hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  className="w-full p-4 flex items-start gap-4 text-left hover:bg-gray-50/50 transition-colors"
                >
                  <div className={`p-2 rounded-lg bg-${levelColor}-100 flex-shrink-0`}>
                    <LevelIcon className={`w-5 h-5 text-${levelColor}-600`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-${levelColor}-700 bg-${levelColor}-100`}>
                        {log.log_level.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-gray-700 bg-gray-100">
                        {SECTIONS.find(s => s.value === log.section)?.label || log.section}
                      </span>
                      <span className="text-xs text-gray-500 ml-auto">
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900">{log.message}</p>
                    {log.action && (
                      <p className="text-sm text-gray-600 mt-1">Действие: {log.action}</p>
                    )}
                  </div>
                </button>

                {isExpanded && (log.details || log.user_id) && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50/50">
                    {log.user_id && (
                      <div className="mb-2">
                        <span className="text-xs font-semibold text-gray-500">USER ID:</span>
                        <p className="text-sm text-gray-700 font-mono">{log.user_id}</p>
                      </div>
                    )}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-gray-500">ДЕТАЛИ:</span>
                        <pre className="mt-1 text-xs text-gray-700 font-mono bg-white p-3 rounded-lg border border-gray-200 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
