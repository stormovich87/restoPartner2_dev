import { useState } from 'react';
import { X, RefreshCw, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Employee {
  id: string;
  first_name: string;
  last_name: string | null;
}

interface RestoreEmployeeModalProps {
  employee: Employee;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RestoreEmployeeModal({ employee, onClose, onSuccess }: RestoreEmployeeModalProps) {
  const [restoreDate, setRestoreDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!restoreDate) {
      setError('Укажите дату восстановления');
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('employees')
        .update({
          current_status: 'working',
          is_active: true,
          hire_date: restoreDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', employee.id);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from('employment_history')
        .insert({
          employee_id: employee.id,
          start_date: restoreDate,
          status_type: 'worked'
        });

      if (historyError) throw historyError;

      onSuccess();
    } catch (err) {
      console.error('Error restoring employee:', err);
      setError('Ошибка при восстановлении сотрудника');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Восстановить сотрудника</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/80 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <div className="font-semibold text-gray-900">
                {employee.first_name} {employee.last_name || ''}
              </div>
              <div className="text-sm text-green-700">
                Сотрудник будет восстановлен в работе
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1.5" />
              Дата восстановления *
            </label>
            <input
              type="date"
              value={restoreDate}
              onChange={(e) => setRestoreDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
              required
            />
            <p className="mt-2 text-sm text-gray-500">
              Эта дата будет записана как новая дата начала работы
            </p>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-gray-700 hover:bg-gray-200 rounded-xl transition-all font-semibold"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !restoreDate}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-semibold disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Восстановить
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
