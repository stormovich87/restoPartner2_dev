import { useState } from 'react';
import { X, UserX, Calendar, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Employee {
  id: string;
  first_name: string;
  last_name: string | null;
}

interface FireEmployeeModalProps {
  employee: Employee;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FireEmployeeModal({ employee, onClose, onSuccess }: FireEmployeeModalProps) {
  const [fireDate, setFireDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [fireType, setFireType] = useState<'fired' | 'quit'>('fired');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fireDate) {
      setError('Укажите дату увольнения');
      return;
    }

    if (!reason.trim()) {
      setError('Укажите причину увольнения');
      return;
    }

    setSaving(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const isFutureDate = fireDate > today;

      if (isFutureDate) {
        const { error: updateError } = await supabase
          .from('employees')
          .update({
            current_status: 'pending_dismissal',
            dismissal_date: fireDate,
            dismissal_reason: reason.trim(),
            dismissal_type: fireType,
            updated_at: new Date().toISOString()
          })
          .eq('id', employee.id);

        if (updateError) throw updateError;
      } else {
        const { error: updateError } = await supabase
          .from('employees')
          .update({
            current_status: 'fired',
            is_active: false,
            dismissal_date: null,
            dismissal_reason: null,
            dismissal_type: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', employee.id);

        if (updateError) throw updateError;

        const { data: currentHistory, error: historyFetchError } = await supabase
          .from('employment_history')
          .select('*')
          .eq('employee_id', employee.id)
          .is('end_date', null)
          .order('start_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (historyFetchError) throw historyFetchError;

        if (currentHistory) {
          const { error: historyUpdateError } = await supabase
            .from('employment_history')
            .update({
              end_date: fireDate,
              status_type: fireType,
              fired_reason: reason.trim()
            })
            .eq('id', currentHistory.id);

          if (historyUpdateError) throw historyUpdateError;
        } else {
          const { error: historyInsertError } = await supabase
            .from('employment_history')
            .insert({
              employee_id: employee.id,
              start_date: fireDate,
              end_date: fireDate,
              status_type: fireType,
              fired_reason: reason.trim()
            });

          if (historyInsertError) throw historyInsertError;
        }
      }

      onSuccess();
    } catch (err) {
      console.error('Error firing employee:', err);
      setError('Ошибка при увольнении сотрудника');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center">
              <UserX className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Увольнение сотрудника</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/80 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <div className="font-semibold text-gray-900">
                {employee.first_name} {employee.last_name || ''}
              </div>
              <div className="text-sm text-amber-700">
                Вы собираетесь уволить этого сотрудника
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
              Дата увольнения *
            </label>
            <input
              type="date"
              value={fireDate}
              onChange={(e) => setFireDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-1.5" />
              Причина увольнения *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all resize-none"
              rows={3}
              placeholder="Укажите причину увольнения..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Тип увольнения
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="fireType"
                  value="fired"
                  checked={fireType === 'fired'}
                  onChange={() => setFireType('fired')}
                  className="w-4 h-4 text-red-600"
                />
                <div>
                  <div className="font-medium text-gray-900">Уволен</div>
                  <div className="text-sm text-gray-500">Сотрудник уволен по решению компании</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="fireType"
                  value="quit"
                  checked={fireType === 'quit'}
                  onChange={() => setFireType('quit')}
                  className="w-4 h-4 text-red-600"
                />
                <div>
                  <div className="font-medium text-gray-900">Сам уволился</div>
                  <div className="text-sm text-gray-500">Сотрудник уволился по собственному желанию</div>
                </div>
              </label>
            </div>
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
            disabled={saving || !fireDate || !reason.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl hover:from-red-700 hover:to-orange-700 transition-all font-semibold disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <UserX className="w-4 h-4" />
                Уволить
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
