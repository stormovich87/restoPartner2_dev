import { X, History, Briefcase, UserX, LogOut, Circle } from 'lucide-react';

interface Employee {
  id: string;
  first_name: string;
  last_name: string | null;
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

interface EmployeeHistoryModalProps {
  employee: Employee;
  history: EmploymentHistoryEntry[];
  onClose: () => void;
}

export default function EmployeeHistoryModal({ employee, history, onClose }: EmployeeHistoryModalProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusIcon = (statusType: string) => {
    switch (statusType) {
      case 'worked':
        return <Briefcase className="w-4 h-4" />;
      case 'fired':
        return <UserX className="w-4 h-4" />;
      case 'quit':
        return <LogOut className="w-4 h-4" />;
      default:
        return <Circle className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (statusType: string) => {
    switch (statusType) {
      case 'worked':
        return 'Работал';
      case 'fired':
        return 'Уволен';
      case 'quit':
        return 'Сам уволился';
      default:
        return statusType;
    }
  };

  const getStatusColor = (statusType: string) => {
    switch (statusType) {
      case 'worked':
        return 'bg-green-500';
      case 'fired':
        return 'bg-red-500';
      case 'quit':
        return 'bg-amber-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBgColor = (statusType: string) => {
    switch (statusType) {
      case 'worked':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'fired':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'quit':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">История работы</h2>
              <p className="text-sm text-gray-600">
                {employee.first_name} {employee.last_name || ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/80 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
          {history.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">История работы пуста</p>
              <p className="text-sm text-gray-500 mt-1">
                Записи появятся после первого увольнения или восстановления
              </p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

              <div className="space-y-6">
                {history.map((entry, index) => (
                  <div key={entry.id} className="relative pl-10">
                    <div className={`absolute left-2 top-1 w-4 h-4 rounded-full ${getStatusColor(entry.status_type)} ring-4 ring-white`} />

                    <div className={`p-4 rounded-xl border ${getStatusBgColor(entry.status_type)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(entry.status_type)}
                          <span className="font-semibold">{getStatusLabel(entry.status_type)}</span>
                        </div>
                        {index === 0 && !entry.end_date && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                            Текущий период
                          </span>
                        )}
                      </div>

                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Период:</span>
                          <span className="font-medium">
                            {formatDate(entry.start_date)}
                            {entry.end_date ? (
                              <> &rarr; {formatDate(entry.end_date)}</>
                            ) : (
                              <span className="text-green-600"> &rarr; по настоящее время</span>
                            )}
                          </span>
                        </div>

                        {entry.fired_reason && (
                          <div className="mt-2 pt-2 border-t border-current/10">
                            <span className="text-gray-600">Причина: </span>
                            <span className="font-medium">{entry.fired_reason}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all font-semibold"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
