import { useState, useEffect } from 'react';
import { Clock, PlayCircle, StopCircle, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Branch {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  branch_id: string;
  opened_at: string;
  closed_at: string | null;
  status: 'open' | 'closed';
  total_orders_count: number;
  completed_orders_count: number;
  branches?: {
    name: string;
  };
}

interface ShiftManagementProps {
  partnerId: string;
}

export default function ShiftManagement({ partnerId }: ShiftManagementProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeShifts, setActiveShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [timezone, setTimezone] = useState<string>('UTC');
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    loadData();

    const shiftsChannel = supabase
      .channel(`shifts-management:${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts',
          filter: `partner_id=eq.${partnerId}`
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      shiftsChannel.unsubscribe();
    };
  }, [partnerId]);

  const loadData = async () => {
    try {
      const [branchesRes, shiftsRes, settingsRes] = await Promise.all([
        supabase
          .from('branches')
          .select('id, name')
          .eq('partner_id', partnerId)
          .eq('status', 'active'),
        supabase
          .from('shifts')
          .select('*, branches(name)')
          .eq('partner_id', partnerId)
          .eq('status', 'open')
          .order('opened_at', { ascending: false }),
        supabase
          .from('partner_settings')
          .select('timezone')
          .eq('partner_id', partnerId)
          .maybeSingle()
      ]);

      if (branchesRes.data) setBranches(branchesRes.data);
      if (shiftsRes.data) setActiveShifts(shiftsRes.data);
      if (settingsRes.data?.timezone) setTimezone(settingsRes.data.timezone);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('ru-RU', {
        timeZone: timezone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const openShift = async (branchId: string) => {
    if (loading) return;
    setLoading(true);

    try {
      const existingShift = activeShifts.find(s => s.branch_id === branchId);
      if (existingShift) {
        alert('Смена уже открыта для этого филиала');
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || null;

      const { data, error } = await supabase
        .from('shifts')
        .insert({
          partner_id: partnerId,
          branch_id: branchId,
          opened_by: userId,
          status: 'open',
          total_orders_count: 0,
          completed_orders_count: 0
        })
        .select();

      if (error) {
        console.error('Insert error:', error);
        alert(`Ошибка при открытии смены: ${error.message}`);
        setLoading(false);
        return;
      }

      await loadData();
    } catch (error: any) {
      console.error('Error opening shift:', error);
      alert(`Ошибка при открытии смены: ${error?.message || 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  const closeShift = async (shiftId: string) => {
    if (loading) return;
    if (!confirm('Вы уверены, что хотите закрыть смену?')) return;

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || null;

      const { error } = await supabase
        .from('shifts')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: userId
        })
        .eq('id', shiftId);

      if (error) {
        console.error('Error closing shift:', error);
        alert(`Ошибка при закрытии смены: ${error.message}`);
        setLoading(false);
        return;
      }

      await loadData();
    } catch (error: any) {
      console.error('Error closing shift:', error);
      alert(`Ошибка при закрытии смены: ${error?.message || 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  const getShiftDuration = (openedAt: string) => {
    const start = new Date(openedAt).getTime();
    const now = Date.now();
    const diffMs = now - start;
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}ч ${minutes}м`;
  };

  return (
    <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-6">
      <div
        className="flex items-center justify-between mb-6 cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Управление сменами</h2>
          {isCollapsed && (
            <span className="ml-3 px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">
              {activeShifts.length} из {branches.length}
            </span>
          )}
        </div>
        {isCollapsed ? (
          <ChevronDown className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronUp className="w-5 h-5 text-gray-600" />
        )}
      </div>

      {!isCollapsed && (<div className="space-y-4">
        {branches.map(branch => {
          const activeShift = activeShifts.find(s => s.branch_id === branch.id);

          return (
            <div
              key={branch.id}
              className={`p-4 rounded-xl border-2 transition-all ${
                activeShift
                  ? 'bg-green-50/50 border-green-300'
                  : 'bg-gray-50/50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{branch.name}</h3>
                    {activeShift && (
                      <p className="text-sm text-gray-600">
                        Открыта: {formatDateTime(activeShift.opened_at)}
                      </p>
                    )}
                  </div>
                </div>

                {activeShift ? (
                  <button
                    onClick={() => closeShift(activeShift.id)}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    <StopCircle className="w-4 h-4" />
                    Закрыть смену
                  </button>
                ) : (
                  <button
                    onClick={() => openShift(branch.id)}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <PlayCircle className="w-4 h-4" />
                    Открыть смену
                  </button>
                )}
              </div>

              {activeShift && (
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <span className="text-gray-700">
                      Продолжительность: <strong>{getShiftDuration(activeShift.opened_at)}</strong>
                    </span>
                  </div>
                  <div className="text-gray-700">
                    Всего заказов: <strong>{activeShift.total_orders_count}</strong>
                  </div>
                  <div className="text-gray-700">
                    Выполнено: <strong className="text-green-600">{activeShift.completed_orders_count}</strong>
                  </div>
                  <div className="text-gray-700">
                    В работе: <strong className="text-blue-600">{activeShift.total_orders_count - activeShift.completed_orders_count}</strong>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {branches.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            Нет активных филиалов
          </p>
        )}
      </div>)}
    </div>
  );
}
