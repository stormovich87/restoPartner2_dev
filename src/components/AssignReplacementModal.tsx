import React, { useState, useEffect } from 'react';
import { X, Clock, AlertCircle, User, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Employee {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  position_id: string;
  branch_id: string;
  dismissal_date: string | null;
}

interface Position {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
}

interface ScheduleCheck {
  employeeId: string;
  hasConflict: boolean;
  branchName?: string;
  startTime?: string;
  endTime?: string;
  totalHours?: number;
}

interface ReplacementInfo {
  employeeId: string;
  employeeName: string;
  newShiftId?: string | null;
}

interface ReplacementCandidate {
  id: string;
  employee_id: string;
  employee: {
    id: string;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
  } | null;
  created_at: string;
}

interface AssignReplacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId: string;
  noShowEmployeeId: string;
  shiftDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
  branchId: string;
  partnerId: string;
  previousReplacementEmployeeId?: string;
  replacementType?: 'with_reason' | 'without_reason';
  onSuccess?: (replacementInfo: ReplacementInfo) => void;
}

export const AssignReplacementModal: React.FC<AssignReplacementModalProps> = ({
  isOpen,
  onClose,
  shiftId,
  noShowEmployeeId,
  shiftDate,
  shiftStartTime,
  shiftEndTime,
  branchId,
  partnerId,
  previousReplacementEmployeeId,
  replacementType = 'with_reason',
  onSuccess,
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [branches, setBranches] = useState<Record<string, string>>({});
  const [scheduleChecks, setScheduleChecks] = useState<Record<string, ScheduleCheck>>({});
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(shiftStartTime);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacementCandidates, setReplacementCandidates] = useState<ReplacementCandidate[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, partnerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Собираем ID сотрудников, которых нужно исключить из списка
      const excludeIds = [];
      if (previousReplacementEmployeeId) {
        excludeIds.push(previousReplacementEmployeeId);
      }

      let employeesQuery = supabase
        .from('employees')
        .select('id, first_name, last_name, photo_url, position_id, branch_id, dismissal_date')
        .eq('partner_id', partnerId)
        .is('dismissal_date', null)
        .order('first_name');

      if (excludeIds.length > 0) {
        employeesQuery = employeesQuery.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const promises: Promise<any>[] = [
        employeesQuery,
        supabase
          .from('positions')
          .select('id, name')
          .eq('partner_id', partnerId),
        supabase
          .from('branches')
          .select('id, name')
          .eq('partner_id', partnerId),
        supabase
          .from('shift_replacement_messages')
          .select(`
            id, employee_id, created_at,
            employee:employees(id, first_name, last_name, photo_url)
          `)
          .eq('shift_id', shiftId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('employees')
          .select('id, first_name, last_name, photo_url, position_id, branch_id, dismissal_date')
          .eq('partner_id', partnerId)
          .eq('id', noShowEmployeeId)
          .maybeSingle(),
      ];

      const [employeesRes, positionsRes, branchesRes, candidatesRes, originalEmployeeRes] = await Promise.all(promises);

      if (employeesRes.error) throw employeesRes.error;
      if (positionsRes.error) throw positionsRes.error;
      if (branchesRes.error) throw branchesRes.error;
      if (originalEmployeeRes.error) {
        console.error('Error loading original employee:', originalEmployeeRes.error);
      }

      const positionsMap = positionsRes.data.reduce((acc, pos) => {
        acc[pos.id] = pos.name;
        return acc;
      }, {} as Record<string, string>);

      const branchesMap = branchesRes.data.reduce((acc, branch) => {
        acc[branch.id] = branch.name;
        return acc;
      }, {} as Record<string, string>);

      let finalEmployeesList = employeesRes.data || [];

      if (originalEmployeeRes.data && !originalEmployeeRes.error && !finalEmployeesList.find(e => e.id === noShowEmployeeId)) {
        finalEmployeesList = [originalEmployeeRes.data, ...finalEmployeesList];
      }

      setEmployees(finalEmployeesList);
      setPositions(positionsMap);
      setBranches(branchesMap);
      setReplacementCandidates((candidatesRes.data || []) as ReplacementCandidate[]);

      await checkScheduleConflicts(finalEmployeesList, branchesMap);
    } catch (err) {
      console.error('Error loading employees:', err);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalMinutes = (start: string, end: string): number => {
    const startParts = start.split(':').map(Number);
    const endParts = end.split(':').map(Number);
    const startMinutes = startParts[0] * 60 + startParts[1];
    const endMinutes = endParts[0] * 60 + endParts[1];
    let diff = endMinutes - startMinutes;
    if (diff < 0) {
      diff += 24 * 60;
    }
    return diff;
  };

  const checkScheduleConflicts = async (employeeList: Employee[], branchesMap: Record<string, string>) => {
    try {
      const employeeIds = employeeList.map(e => e.id);

      const { data: shiftsData, error: shiftsError } = await supabase
        .from('schedule_shifts')
        .select('staff_member_id, branch_id, start_time, end_time, total_minutes')
        .in('staff_member_id', employeeIds)
        .eq('date', shiftDate)
        .eq('branch_id', branchId);

      if (shiftsError) throw shiftsError;

      const checksMap: Record<string, ScheduleCheck> = {};

      employeeList.forEach(emp => {
        const hasShift = shiftsData?.find(s => s.staff_member_id === emp.id);
        if (hasShift) {
          const totalHours = hasShift.total_minutes ? Math.round((hasShift.total_minutes / 60) * 10) / 10 : 0;
          checksMap[emp.id] = {
            employeeId: emp.id,
            hasConflict: true,
            branchName: branchesMap[hasShift.branch_id] || 'Неизвестный филиал',
            startTime: hasShift.start_time,
            endTime: hasShift.end_time,
            totalHours: totalHours,
          };
        } else {
          checksMap[emp.id] = {
            employeeId: emp.id,
            hasConflict: false,
          };
        }
      });

      setScheduleChecks(checksMap);

      if (selectedEmployeeId && checksMap[selectedEmployeeId]?.hasConflict) {
        setSelectedEmployeeId(null);
      }
    } catch (err) {
      console.error('Error checking schedules:', err);
    }
  };

  const handleAssignReplacement = async () => {
    if (!selectedEmployeeId) {
      setError('Выберите сотрудника');
      return;
    }

    if (!startTime) {
      setError('Выберите время начала смены');
      return;
    }

    // Проверка на конфликт расписания
    const scheduleCheck = scheduleChecks[selectedEmployeeId];
    if (scheduleCheck?.hasConflict) {
      setError('Выбранный сотрудник уже назначен в график на эту дату');
      setSelectedEmployeeId(null);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
      if (!selectedEmployee) {
        throw new Error('Сотрудник не найден');
      }

      const normalizedStartTime = startTime.length === 5 ? startTime + ':00' : startTime;
      const normalizedEndTime = shiftEndTime.length === 5 ? shiftEndTime + ':00' : shiftEndTime;
      const totalMinutes = calculateTotalMinutes(normalizedStartTime, normalizedEndTime);

      let newShiftId: string | null = null;

      if (replacementType === 'without_reason') {
        // Для no_show без причины: удаляем смену подменяющего и создаем новую для другого сотрудника

        const { data: shiftData, error: shiftError } = await supabase
          .from('schedule_shifts')
          .select('status')
          .eq('id', shiftId)
          .maybeSingle();

        if (shiftError) throw shiftError;

        if (shiftData?.status === 'opened') {
          const now = new Date().toISOString();

          const { error: segmentError } = await supabase
            .from('work_segments')
            .update({ segment_end_at: now })
            .eq('shift_id', shiftId)
            .is('segment_end_at', null);

          if (segmentError) {
            console.error('Error closing work segments:', segmentError);
          }
        }

        const { error: deleteError } = await supabase
          .from('schedule_shifts')
          .delete()
          .eq('id', shiftId);

        if (deleteError) throw deleteError;

        const { data: newShiftData, error: insertError } = await supabase
          .from('schedule_shifts')
          .insert({
            partner_id: partnerId,
            staff_member_id: selectedEmployeeId,
            branch_id: branchId,
            date: shiftDate,
            start_time: normalizedStartTime,
            end_time: normalizedEndTime,
            total_minutes: totalMinutes,
            status: 'scheduled',
            is_replacement: false,
            position_id: selectedEmployee.position_id || null,
            is_published: false,
            decline_is_late: false,
            late_minutes: 0,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        newShiftId = newShiftData?.id || null;
      } else {
        // Для no_show с причиной: удаляем предыдущую смену подмены, если она была
        if (previousReplacementEmployeeId) {
          const { data: prevShifts, error: selectError } = await supabase
            .from('schedule_shifts')
            .select('id, status')
            .eq('staff_member_id', previousReplacementEmployeeId)
            .eq('date', shiftDate)
            .eq('is_replacement', true)
            .eq('original_shift_id', shiftId);

          if (selectError) {
            console.error('Error fetching previous replacement shift:', selectError);
          } else if (prevShifts && prevShifts.length > 0) {
            for (const prevShift of prevShifts) {
              if (prevShift.status === 'opened') {
                const now = new Date().toISOString();

                const { error: segmentError } = await supabase
                  .from('work_segments')
                  .update({ segment_end_at: now })
                  .eq('shift_id', prevShift.id)
                  .is('segment_end_at', null);

                if (segmentError) {
                  console.error('Error closing work segments for previous replacement:', segmentError);
                }
              }

              const { error: deleteError } = await supabase
                .from('schedule_shifts')
                .delete()
                .eq('id', prevShift.id);

              if (deleteError) {
                console.error('Error deleting previous replacement shift:', deleteError);
              }
            }
          }
        }

        // Создаем смену подмены и обновляем оригинальную
        const { error: insertError } = await supabase
          .from('schedule_shifts')
          .insert({
            partner_id: partnerId,
            staff_member_id: selectedEmployeeId,
            branch_id: branchId,
            date: shiftDate,
            start_time: normalizedStartTime,
            end_time: normalizedEndTime,
            total_minutes: totalMinutes,
            status: 'scheduled',
            is_replacement: true,
            position_id: selectedEmployee.position_id || null,
            original_shift_id: shiftId,
            is_published: false,
            decline_is_late: false,
            late_minutes: 0,
          });

        if (insertError) throw insertError;

        const { error: updateError } = await supabase
          .from('schedule_shifts')
          .update({
            replacement_status: 'accepted',
            replacement_employee_id: selectedEmployeeId,
            replacement_accepted_at: new Date().toISOString(),
            status: 'replaced',
            attendance_status: 'replaced',
          })
          .eq('id', shiftId);

        if (updateError) throw updateError;
      }

      await supabase
        .from('shift_replacement_messages')
        .update({ is_active: false })
        .eq('shift_id', shiftId);

      if (onSuccess) {
        const employeeName = `${selectedEmployee.first_name}${selectedEmployee.last_name ? ' ' + selectedEmployee.last_name : ''}`;
        onSuccess({
          employeeId: selectedEmployeeId,
          employeeName,
          newShiftId,
        });
      }

      onClose();
    } catch (err: any) {
      console.error('Error assigning replacement:', err);
      setError(err.message || 'Ошибка при назначении замены');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedEmployeeId(null);
    setStartTime(shiftStartTime);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Назначить подмену</h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Время начала смены для подменяющего
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600 z-10 pointer-events-none" />
                  <input
                    type="time"
                    value={startTime.substring(0, 5)}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold bg-white appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                </div>
                <p className="mt-2 text-sm text-blue-700 font-medium">
                  Смена будет добавлена с {startTime.substring(0, 5)} до {shiftEndTime.substring(0, 5)}
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {replacementCandidates.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <h3 className="text-sm font-medium text-gray-700">
                      Предложено для подмены ({replacementCandidates.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {replacementCandidates.map((candidate) => {
                      if (!candidate.employee) return null;
                      const emp = candidate.employee;
                      const scheduleCheck = scheduleChecks[emp.id];
                      const hasConflict = scheduleCheck?.hasConflict;
                      const isSelected = selectedEmployeeId === emp.id;

                      return (
                        <button
                          key={candidate.id}
                          onClick={() => !hasConflict && setSelectedEmployeeId(emp.id)}
                          disabled={hasConflict}
                          type="button"
                          className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                            hasConflict
                              ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-70'
                              : isSelected
                              ? 'bg-orange-50 border-orange-500 shadow-sm'
                              : 'bg-orange-50/50 border-orange-200 hover:border-orange-400 hover:bg-orange-50 hover:shadow-sm cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {emp.photo_url ? (
                              <img
                                src={emp.photo_url}
                                alt={`${emp.first_name}${emp.last_name ? ' ' + emp.last_name : ''}`}
                                className={`w-12 h-12 rounded-full object-cover ${hasConflict ? 'opacity-50 grayscale' : ''}`}
                              />
                            ) : (
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${
                                hasConflict
                                  ? 'bg-gray-400'
                                  : 'bg-gradient-to-br from-orange-400 to-orange-600'
                              }`}>
                                <User className="w-6 h-6" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold ${hasConflict ? 'text-gray-500' : 'text-gray-900'}`}>
                                  {emp.first_name}{emp.last_name ? ' ' + emp.last_name : ''}
                                </span>
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                                  Кандидат
                                </span>
                                {isSelected && !hasConflict && (
                                  <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Уведомлен {new Date(candidate.created_at).toLocaleString('ru-RU', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">
                    {replacementCandidates.length > 0 ? 'Другие сотрудники' : 'Выберите сотрудника'}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {employees.filter(e => !scheduleChecks[e.id]?.hasConflict).length} из {employees.length} доступно
                  </span>
                </div>
                {employees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Нет доступных сотрудников
                  </div>
                ) : (
                  employees
                    .filter(emp => !replacementCandidates.some(c => c.employee_id === emp.id))
                    .map((emp) => {
                    const scheduleCheck = scheduleChecks[emp.id];
                    const hasConflict = scheduleCheck?.hasConflict;
                    const isSelected = selectedEmployeeId === emp.id;

                    return (
                      <button
                        key={emp.id}
                        onClick={() => !hasConflict && setSelectedEmployeeId(emp.id)}
                        disabled={hasConflict}
                        type="button"
                        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                          hasConflict
                            ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-70'
                            : isSelected
                            ? 'bg-blue-50 border-blue-500 shadow-sm'
                            : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-sm cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {emp.photo_url ? (
                            <img
                              src={emp.photo_url}
                              alt={`${emp.first_name}${emp.last_name ? ' ' + emp.last_name : ''}`}
                              className={`w-12 h-12 rounded-full object-cover ${hasConflict ? 'opacity-50 grayscale' : ''}`}
                            />
                          ) : (
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${
                              hasConflict
                                ? 'bg-gray-400'
                                : 'bg-gradient-to-br from-blue-400 to-blue-600'
                            }`}>
                              <User className="w-6 h-6" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold ${hasConflict ? 'text-gray-500' : 'text-gray-900'}`}>
                                {emp.first_name}{emp.last_name ? ' ' + emp.last_name : ''}
                              </span>
                              {isSelected && !hasConflict && (
                                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                              )}
                            </div>
                            <div className={`text-sm ${hasConflict ? 'text-gray-500' : 'text-gray-600'}`}>
                              {positions[emp.position_id] || 'Без должности'}
                            </div>
                            {hasConflict && scheduleCheck.branchName && (
                              <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg">
                                <div className="flex items-center gap-1 text-amber-700 font-medium text-sm mb-1">
                                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                  <span>Уже в графике</span>
                                </div>
                                <div className="text-xs text-amber-600 space-y-0.5">
                                  <div>Филиал: {scheduleCheck.branchName}</div>
                                  {scheduleCheck.startTime && scheduleCheck.endTime && (
                                    <div>Время: {scheduleCheck.startTime} - {scheduleCheck.endTime}</div>
                                  )}
                                  {scheduleCheck.totalHours !== undefined && (
                                    <div>Часов: {scheduleCheck.totalHours} ч</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-200 p-6">
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              disabled={submitting}
            >
              Отмена
            </button>
            <button
              onClick={handleAssignReplacement}
              disabled={!selectedEmployeeId || submitting || !startTime}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Назначение...' : 'Назначить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
