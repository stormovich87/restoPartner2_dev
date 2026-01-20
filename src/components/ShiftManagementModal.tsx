import { useState, useEffect } from 'react';
import { X, PlayCircle, StopCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { StaffUser } from '../types';

interface Branch {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  branch_id: string;
  opened_at: string;
  status: 'open' | 'closed';
}

interface ShiftManagementModalProps {
  partnerId: string;
  onClose: () => void;
}

export default function ShiftManagementModal({ partnerId, onClose }: ShiftManagementModalProps) {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingShiftId, setProcessingShiftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();

    const shiftsChannel = supabase
      .channel(`shifts-modal:${partnerId}`)
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
  }, [partnerId, user]);

  const loadData = async () => {
    try {
      const branchesRes = await supabase
        .from('branches')
        .select('id, name')
        .eq('partner_id', partnerId)
        .eq('status', 'active')
        .order('name');

      let filteredBranches = branchesRes.data || [];

      if (user && 'is_staff' in user && user.is_staff) {
        const staffUser = user as StaffUser;
        if (staffUser.position?.position_branches && staffUser.position.position_branches.length > 0) {
          const allowedBranchIds = staffUser.position.position_branches.map(pb => pb.branch_id);
          filteredBranches = filteredBranches.filter(branch => allowedBranchIds.includes(branch.id));
        }
      }

      const shiftsRes = await supabase
        .from('shifts')
        .select('id, branch_id, opened_at, status')
        .eq('partner_id', partnerId)
        .eq('status', 'open');

      setBranches(filteredBranches);
      if (shiftsRes.data) setShifts(shiftsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const openShift = async (branchId: string) => {
    if (loading) return;
    setLoading(true);
    setProcessingShiftId(branchId);
    setError(null);

    try {
      const existingShift = shifts.find(s => s.branch_id === branchId);
      if (existingShift) {
        setError('Смена уже открыта для этого филиала');
        setLoading(false);
        setProcessingShiftId(null);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || null;

      const { data: newShift, error: insertError } = await supabase
        .from('shifts')
        .insert({
          partner_id: partnerId,
          branch_id: branchId,
          opened_by: userId,
          status: 'open',
          total_orders_count: 0,
          completed_orders_count: 0
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!newShift) throw new Error('Не удалось создать смену');

      await transferScheduledOrders(branchId, newShift.id);
      await loadData();
    } catch (error: any) {
      console.error('Error opening shift:', error);
      setError(error?.message || 'Ошибка при открытии смены');
    } finally {
      setLoading(false);
      setProcessingShiftId(null);
    }
  };

  const transferScheduledOrders = async (branchId: string, newShiftId: string) => {
    try {
      const now = new Date();
      const { data: scheduledOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('branch_id', branchId)
        .eq('status', 'in_progress')
        .not('scheduled_at', 'is', null)
        .gte('scheduled_at', now.toISOString());

      if (scheduledOrders && scheduledOrders.length > 0) {
        const orderIds = scheduledOrders.map(o => o.id);
        await supabase
          .from('orders')
          .update({
            accumulated_time_minutes: 0,
            shift_id: newShiftId
          })
          .in('id', orderIds);
      }
    } catch (error) {
      console.error('Error transferring scheduled orders:', error);
    }
  };

  const closeShift = async (shiftId: string, branchId: string, branchName: string, isAutoClose = false) => {
    if (loading) return;
    setLoading(true);
    setProcessingShiftId(shiftId);
    setError(null);

    try {
      const now = new Date();
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id, status, scheduled_at')
        .eq('branch_id', branchId)
        .in('status', ['in_progress', 'en_route']);

      if (activeOrders && activeOrders.length > 0) {
        if (isAutoClose) {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id || null;

          const { error: closeError } = await supabase
            .from('shifts')
            .update({
              status: 'closed',
              closed_at: new Date().toISOString(),
              closed_by: userId
            })
            .eq('id', shiftId);

          if (closeError) throw closeError;

          const { data: newShift, error: openError } = await supabase
            .from('shifts')
            .insert({
              partner_id: partnerId,
              branch_id: branchId,
              opened_by: userId,
              status: 'open',
              total_orders_count: 0,
              completed_orders_count: 0
            })
            .select()
            .single();

          if (openError) throw openError;
          if (!newShift) throw new Error('Не удалось создать новую смену');

          const orderIds = activeOrders.map(o => o.id);
          await supabase
            .from('orders')
            .update({
              shift_id: newShift.id,
              accumulated_time_minutes: 0
            })
            .in('id', orderIds);

          await loadData();
          return;
        }

        const blockingOrders = activeOrders.filter(order => {
          if (order.status === 'en_route') return true;
          if (!order.scheduled_at) return true;
          const scheduledTime = new Date(order.scheduled_at);
          return scheduledTime <= now;
        });

        if (blockingOrders.length > 0) {
          setError(`Невозможно закрыть смену "${branchName}". В филиале есть ${blockingOrders.length} незавершенных заказов. Завершите все заказы перед закрытием смены.`);
          setLoading(false);
          setProcessingShiftId(null);
          return;
        }
      }

      if (!confirm(`Вы уверены, что хотите закрыть смену для филиала "${branchName}"?`)) {
        setLoading(false);
        setProcessingShiftId(null);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || null;

      const { error: updateError } = await supabase
        .from('shifts')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: userId
        })
        .eq('id', shiftId);

      if (updateError) throw updateError;

      await loadData();
    } catch (error: any) {
      console.error('Error closing shift:', error);
      setError(error?.message || 'Ошибка при закрытии смены');
    } finally {
      setLoading(false);
      setProcessingShiftId(null);
    }
  };

  const getShiftForBranch = (branchId: string) => {
    return shifts.find(s => s.branch_id === branchId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Управление сменами</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {branches.map(branch => {
              const shift = getShiftForBranch(branch.id);
              const isProcessing = processingShiftId === branch.id || processingShiftId === shift?.id;

              let openedInfo = '';

              if (shift) {
                const openedDate = new Date(shift.opened_at);
                const formattedDate = openedDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const formattedTime = openedDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                openedInfo = `Открыта: ${formattedDate} в ${formattedTime}`;
              }

              return (
                <div
                  key={branch.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    shift
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                      : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-lg mb-1">{branch.name}</h3>
                      {shift ? (
                        <p className="text-xs text-gray-600">{openedInfo}</p>
                      ) : (
                        <p className="text-sm text-gray-500">Смена закрыта</p>
                      )}
                    </div>

                    {shift ? (
                      <button
                        onClick={() => closeShift(shift.id, branch.id, branch.name)}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold flex-shrink-0"
                      >
                        <StopCircle className="w-5 h-5" />
                        {isProcessing ? 'Закрытие...' : 'Закрыть смену'}
                      </button>
                    ) : (
                      <button
                        onClick={() => openShift(branch.id)}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold flex-shrink-0"
                      >
                        <PlayCircle className="w-5 h-5" />
                        {isProcessing ? 'Открытие...' : 'Открыть смену'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {branches.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                Нет доступных филиалов
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
