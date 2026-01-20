import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, TrendingUp, RefreshCw, CheckCircle, AlertCircle, ArrowRight, Trash2, Plus, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PayrollPeriod {
  id: string;
  period_start: string;
  period_end: string;
  period_type: string;
  status: string;
  closed_at: string | null;
  snapshot_data: any;
  is_first: boolean;
  period_order: number;
}

interface PartnerSettings {
  kpi_payroll_period_type: string;
  kpi_payroll_first_day_of_week: number;
  kpi_payroll_week_target_day: number;
  kpi_payroll_month_close_day: number;
  kpi_payroll_custom_days: number;
  kpi_payroll_last_recalculated_at: string | null;
  timezone: string;
}

interface PayrollPeriodsSettingsProps {
  partnerId: string;
  onPeriodsChange?: () => void;
  onOpenReport?: (period: { periodId: string; periodStart: string; periodEnd: string; closedAt: string | null; status: string }) => void;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Понедельник' },
  { value: 2, label: 'Вторник' },
  { value: 3, label: 'Среда' },
  { value: 4, label: 'Четверг' },
  { value: 5, label: 'Пятница' },
  { value: 6, label: 'Суббота' },
  { value: 7, label: 'Воскресенье' }
];

export default function PayrollPeriodsSettings({ partnerId, onPeriodsChange, onOpenReport }: PayrollPeriodsSettingsProps) {
  const [settings, setSettings] = useState<PartnerSettings | null>(null);
  const [activePeriod, setActivePeriod] = useState<PayrollPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateFirstModal, setShowCreateFirstModal] = useState(false);
  const [showCreateNextModal, setShowCreateNextModal] = useState(false);
  const [creatingPeriod, setCreatingPeriod] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [periodToDelete, setPeriodToDelete] = useState<PayrollPeriod | null>(null);
  const [deletingPeriod, setDeletingPeriod] = useState(false);

  const [periodType, setPeriodType] = useState<string>('month');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<number>(1);
  const [weekTargetDay, setWeekTargetDay] = useState<number>(7);
  const [monthCloseDay, setMonthCloseDay] = useState<number>(1);
  const [customDays, setCustomDays] = useState<number>(14);
  const [firstPeriodStart, setFirstPeriodStart] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const { data: settingsData, error: settingsError } = await supabase
        .from('partner_settings')
        .select('kpi_payroll_period_type, kpi_payroll_first_day_of_week, kpi_payroll_week_target_day, kpi_payroll_month_close_day, kpi_payroll_custom_days, kpi_payroll_last_recalculated_at, timezone')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (settingsError) throw settingsError;

      if (settingsData) {
        setSettings(settingsData);
        setPeriodType(settingsData.kpi_payroll_period_type || 'month');
        setFirstDayOfWeek(settingsData.kpi_payroll_first_day_of_week || 1);
        setWeekTargetDay(settingsData.kpi_payroll_week_target_day || 7);
        setMonthCloseDay(settingsData.kpi_payroll_month_close_day || 1);
        setCustomDays(settingsData.kpi_payroll_custom_days || 14);
      }

      const { data, error } = await supabase
        .from('kpi_payroll_periods')
        .select('*')
        .eq('partner_id', partnerId)
        .order('period_order', { ascending: true });

      if (error) throw error;

      setAllPeriods(data || []);

      const active = data?.find(p => p.status === 'active');
      setActivePeriod(active || null);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calculateNextPeriodEnd = (startDate: Date): Date => {
    const endDate = new Date(startDate);

    if (periodType === 'week') {
      // For weekly periods, calculate end based on target day
      const currentDay = startDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const targetDay = weekTargetDay === 7 ? 0 : weekTargetDay; // Convert our format to JS format

      let daysUntilTarget = (targetDay - currentDay + 7) % 7;
      if (daysUntilTarget === 0) {
        daysUntilTarget = 7;
      }

      endDate.setDate(endDate.getDate() + daysUntilTarget - 1);
    } else if (periodType === 'month') {
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(endDate.getDate() - 1);
    } else if (periodType === 'custom') {
      endDate.setDate(endDate.getDate() + customDays - 1);
    }

    endDate.setHours(23, 59, 59, 999);

    return endDate;
  };

  const handleCreateFirstPeriod = async () => {
    if (!firstPeriodStart) {
      alert('Выберите дату начала первого периода');
      return;
    }

    try {
      setCreatingPeriod(true);

      console.log('Creating first period with data:', {
        partner_id: partnerId,
        period_type: periodType,
        first_period_start: firstPeriodStart
      });

      const startDate = new Date(firstPeriodStart);
      const endDate = calculateNextPeriodEnd(startDate);

      const { data, error } = await supabase
        .from('kpi_payroll_periods')
        .insert({
          partner_id: partnerId,
          period_start: startDate.toISOString(),
          period_end: endDate.toISOString(),
          period_type: periodType,
          status: 'active',
          is_first: true,
          period_order: 1,
          snapshot_data: {}
        })
        .select();

      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('Period created successfully:', data);

      const { error: settingsError } = await supabase
        .from('partner_settings')
        .update({
          kpi_payroll_period_type: periodType,
          kpi_payroll_first_day_of_week: firstDayOfWeek,
          kpi_payroll_week_target_day: weekTargetDay,
          kpi_payroll_month_close_day: monthCloseDay,
          kpi_payroll_custom_days: customDays
        })
        .eq('partner_id', partnerId);

      if (settingsError) {
        console.error('Settings update error:', settingsError);
      }

      await loadData();
      onPeriodsChange?.();
      setShowCreateFirstModal(false);
      setFirstPeriodStart('');

      alert('Первый период успешно создан!');
    } catch (error: any) {
      console.error('Error creating first period:', error);

      let errorMessage = 'Неизвестная ошибка';
      if (error.message) {
        errorMessage = error.message;
      }
      if (error.code === 'PGRST301') {
        errorMessage = 'Ошибка доступа к базе данных. Проверьте права доступа.';
      }

      alert(`Ошибка при создании первого периода: ${errorMessage}`);
    } finally {
      setCreatingPeriod(false);
    }
  };

  const getActualClosingDate = () => {
    if (!activePeriod) return new Date();

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const periodEnd = new Date(activePeriod.period_end);
    periodEnd.setHours(23, 59, 59, 999);

    return periodEnd > today ? today : periodEnd;
  };

  const handleCreateNextPeriod = async () => {
    if (!activePeriod) return;

    try {
      setCreatingPeriod(true);

      const now = new Date();
      const closingDate = new Date(now);
      closingDate.setSeconds(closingDate.getSeconds() - 1);

      const nextStart = new Date(now);
      nextStart.setSeconds(0, 0);

      const nextEnd = calculateNextPeriodEnd(nextStart);
      const nextOrder = activePeriod.period_order + 1;

      await supabase
        .from('kpi_payroll_periods')
        .update({
          status: 'closed',
          closed_at: now.toISOString(),
          period_end: closingDate.toISOString()
        })
        .eq('id', activePeriod.id);

      const { error: insertError } = await supabase
        .from('kpi_payroll_periods')
        .insert({
          partner_id: partnerId,
          period_start: nextStart.toISOString(),
          period_end: nextEnd.toISOString(),
          period_type: periodType,
          status: 'active',
          is_first: false,
          period_order: nextOrder,
          snapshot_data: {}
        });

      if (insertError) throw insertError;

      await loadData();
      onPeriodsChange?.();
      setShowCreateNextModal(false);
    } catch (error) {
      console.error('Error creating next period:', error);
      alert('Ошибка при создании следующего периода');
    } finally {
      setCreatingPeriod(false);
    }
  };

  const canDeletePeriod = (period: PayrollPeriod) => {
    if (allPeriods.length === 0) return false;

    const sortedPeriods = [...allPeriods].sort((a, b) => b.period_order - a.period_order);
    const lastPeriod = sortedPeriods[0];

    return period.id === lastPeriod.id;
  };

  const handleDeletePeriod = async () => {
    if (!periodToDelete) return;

    if (!canDeletePeriod(periodToDelete)) {
      alert('Можно удалять только последний период');
      setShowDeleteModal(false);
      setPeriodToDelete(null);
      return;
    }

    try {
      setDeletingPeriod(true);

      const sortedPeriods = [...allPeriods].sort((a, b) => b.period_order - a.period_order);
      const isLastPeriod = sortedPeriods[0].id === periodToDelete.id;

      if (isLastPeriod && allPeriods.length > 1) {
        const previousPeriod = sortedPeriods[1];

        const periodStart = new Date(previousPeriod.period_start);
        const newPeriodEnd = calculateNextPeriodEnd(periodStart);

        const { error: updateError } = await supabase
          .from('kpi_payroll_periods')
          .update({
            status: 'active',
            period_end: newPeriodEnd.toISOString(),
            closed_at: null
          })
          .eq('id', previousPeriod.id)
          .eq('partner_id', partnerId);

        if (updateError) throw updateError;
      }

      const { error } = await supabase
        .from('kpi_payroll_periods')
        .delete()
        .eq('id', periodToDelete.id)
        .eq('partner_id', partnerId);

      if (error) throw error;

      await loadData();
      onPeriodsChange?.();
      setShowDeleteModal(false);
      setPeriodToDelete(null);
    } catch (error) {
      console.error('Error deleting period:', error);
      alert('Ошибка при удалении периода');
    } finally {
      setDeletingPeriod(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('partner_settings')
        .update({
          kpi_payroll_period_type: periodType,
          kpi_payroll_first_day_of_week: firstDayOfWeek,
          kpi_payroll_week_target_day: weekTargetDay,
          kpi_payroll_month_close_day: monthCloseDay,
          kpi_payroll_custom_days: customDays
        })
        .eq('partner_id', partnerId);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Ошибка при сохранении настроек');
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      const { error } = await supabase
        .from('partner_settings')
        .update({
          kpi_payroll_last_recalculated_at: new Date().toISOString()
        })
        .eq('partner_id', partnerId);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error('Error recalculating:', error);
      alert('Ошибка при пересчёте KPI');
    }
  };

  const openDeleteModal = (period: PayrollPeriod) => {
    setPeriodToDelete(period);
    setShowDeleteModal(true);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPeriodTypeLabel = (type: string) => {
    switch (type) {
      case 'week': return 'Неделя';
      case 'month': return 'Месяц';
      case 'custom': return 'Свой период';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (!activePeriod && allPeriods.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl shadow-lg border border-orange-200/50 p-12">
          <div className="text-center max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-10 h-10 text-orange-600" />
            </div>

            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Периоды выплат не настроены
            </h3>

            <p className="text-gray-700 mb-8 text-lg">
              Для работы системы KPI необходимо создать первый расчетный период.
              Выберите начальную дату и тип периода, от которого будут отталкиваться все последующие периоды.
            </p>

            <div className="bg-white rounded-xl p-6 shadow-md border border-orange-200 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Дата начала первого периода
                  </label>
                  <input
                    type="date"
                    value={firstPeriodStart}
                    onChange={(e) => setFirstPeriodStart(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Тип периода
                  </label>
                  <select
                    value={periodType}
                    onChange={(e) => setPeriodType(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="week">Неделя (7 дней)</option>
                    <option value="month">Месяц</option>
                    <option value="custom">Свой период</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  {periodType === 'week' && 'Неделя — период до выбранного дня недели'}
                  {periodType === 'month' && 'Месяц — период с 1-го числа до конца месяца'}
                  {periodType === 'custom' && 'Свой период — произвольное количество дней'}
                </p>
                <p className="text-xs text-blue-700">
                  {periodType === 'week' && 'Первый период — от выбранной даты до следующего выбранного дня недели. Последующие периоды — ровно 7 дней, заканчиваясь на этот день.'}
                  {periodType === 'month' && 'Каждый период автоматически привязывается к календарному месяцу. Новый период начинается 1-го числа следующего месяца.'}
                  {periodType === 'custom' && 'Вы сами определяете длину периода. Новый период автоматически начинается через указанное количество дней.'}
                </p>
              </div>

              {periodType === 'week' && (
                <div className="mt-4 text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    День недели для завершения периода
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <button
                        key={day.value}
                        onClick={() => setWeekTargetDay(day.value)}
                        className={`p-3 rounded-xl border-2 transition-all text-center ${
                          weekTargetDay === day.value
                            ? 'bg-orange-50 border-orange-500 text-orange-700 font-semibold'
                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="text-xs">{day.label.substring(0, 2)}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Периоды будут заканчиваться каждый {DAYS_OF_WEEK.find(d => d.value === weekTargetDay)?.label.toLowerCase()}.
                  </p>
                </div>
              )}

              {periodType === 'custom' && (
                <div className="mt-4 text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Длина периода (дней)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={customDays}
                    onChange={(e) => setCustomDays(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              )}

              {firstPeriodStart && (
                <>
                  <div className="mt-6 bg-green-50 rounded-xl p-4 border border-green-200">
                    <p className="text-sm text-green-800 font-medium mb-1">Первый период будет:</p>
                    <p className="text-lg font-bold text-green-900">
                      {formatDate(firstPeriodStart)} — {formatDate(calculateNextPeriodEnd(new Date(firstPeriodStart)).toISOString())}
                    </p>
                  </div>

                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm text-amber-800 font-medium mb-3">
                      Следующий период (автоматическое создание)
                      {periodType === 'week' && ` — каждый ${DAYS_OF_WEEK.find(d => d.value === weekTargetDay)?.label.toLowerCase()}`}
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-amber-700">Дата начала:</span>
                        <span className="text-sm font-bold text-amber-900">{formatDate(calculateNextPeriodEnd(new Date(firstPeriodStart)).toISOString())}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-amber-700">Дата конца:</span>
                        <span className="text-sm font-bold text-amber-900">{formatDate(calculateNextPeriodEnd(calculateNextPeriodEnd(new Date(firstPeriodStart))).toISOString())}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleCreateFirstPeriod}
              disabled={!firstPeriodStart || creatingPeriod}
              className="px-8 py-4 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:shadow-xl transition-all font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-3"
            >
              <Play className="w-6 h-6" />
              {creatingPeriod ? 'Создание...' : 'Запустить первый период'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activePeriod && (
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl shadow-lg border border-blue-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Текущий активный период
            </h3>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Период</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatDate(activePeriod.period_start)} — {formatDate(activePeriod.period_end)}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Тип: {getPeriodTypeLabel(activePeriod.period_type)} • Порядковый номер: {activePeriod.period_order}
                  {activePeriod.is_first && ' • Первый период'}
                </p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg font-semibold">
                <CheckCircle className="w-5 h-5" />
                Идёт
              </div>
            </div>

            {settings?.kpi_payroll_last_recalculated_at && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                Пересчитано: {formatDateTime(settings.kpi_payroll_last_recalculated_at)}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCreateNextModal(true)}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                Создать следующий период
              </button>
              <button
                onClick={handleRecalculate}
                className="px-4 py-3 bg-white border-2 border-blue-500 text-blue-600 rounded-xl font-medium hover:bg-blue-50 transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Пересчитать
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Настройка типа периода
          </h3>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Тип периода
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setPeriodType('week')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  periodType === 'week'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="font-semibold">Неделя</div>
                <div className="text-xs mt-1 opacity-80">7 дней</div>
              </button>

              <button
                onClick={() => setPeriodType('month')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  periodType === 'month'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="font-semibold">Месяц</div>
                <div className="text-xs mt-1 opacity-80">По дате</div>
              </button>

              <button
                onClick={() => setPeriodType('custom')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  periodType === 'custom'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="font-semibold">Свой</div>
                <div className="text-xs mt-1 opacity-80">N дней</div>
              </button>
            </div>

            {periodType === 'week' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  День недели для завершения периода
                </label>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.value}
                      onClick={() => setWeekTargetDay(day.value)}
                      className={`p-3 rounded-xl border-2 transition-all text-center ${
                        weekTargetDay === day.value
                          ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="text-xs">{day.label.substring(0, 2)}</div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Периоды будут заканчиваться каждый {DAYS_OF_WEEK.find(d => d.value === weekTargetDay)?.label.toLowerCase()}.
                  Первый период — выравнивающий до ближайшего {DAYS_OF_WEEK.find(d => d.value === weekTargetDay)?.label.toLowerCase()},
                  последующие — ровно 7 дней.
                </p>
              </div>
            )}

            {activePeriod && (
              <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-cyan-600" />
                  <p className="text-sm font-medium text-cyan-900">
                    Следующий период (автоматическое создание)
                    {periodType === 'week' && ` — каждый ${DAYS_OF_WEEK.find(d => d.value === weekTargetDay)?.label.toLowerCase()}`}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-cyan-600">Дата начала:</span>
                    <span className="text-sm font-bold text-cyan-900">{formatDate((() => {
                      const periodEnd = new Date(activePeriod.period_end);
                      periodEnd.setHours(23, 59, 59, 999);
                      const nextStart = new Date(periodEnd);
                      nextStart.setDate(nextStart.getDate() + 1);
                      nextStart.setHours(0, 0, 0, 0);
                      return nextStart.toISOString();
                    })())}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-cyan-600">Дата конца:</span>
                    <span className="text-sm font-bold text-cyan-900">{formatDate((() => {
                      const periodEnd = new Date(activePeriod.period_end);
                      periodEnd.setHours(23, 59, 59, 999);
                      const nextStart = new Date(periodEnd);
                      nextStart.setDate(nextStart.getDate() + 1);
                      nextStart.setHours(0, 0, 0, 0);
                      return calculateNextPeriodEnd(nextStart).toISOString();
                    })())}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {periodType === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Длина периода (дней)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={customDays}
                onChange={(e) => setCustomDays(Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800 font-medium mb-1">
              Автоматическое создание периодов
            </p>
            <p className="text-xs text-amber-700">
              При окончании текущего периода система автоматически создаст следующий период на основе выбранного типа. Вам не нужно создавать периоды вручную каждый раз.
            </p>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </div>
      </div>

      {allPeriods.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-700 to-gray-800 px-6 py-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Все периоды ({allPeriods.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">№</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Период</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Тип</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Статус</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Дата закрытия</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {allPeriods.map(period => (
                  <tr key={period.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{period.period_order}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {formatDate(period.period_start)} — {formatDate(period.period_end)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                        {getPeriodTypeLabel(period.period_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {period.status === 'active' ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Активен
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                          Закрыт
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {period.closed_at ? formatDateTime(period.closed_at) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg font-medium text-sm transition-colors"
                          onClick={() => onOpenReport?.({
                            periodId: period.id,
                            periodStart: period.period_start,
                            periodEnd: period.period_end,
                            closedAt: period.closed_at,
                            status: period.status
                          })}
                        >
                          Отчет
                        </button>
                        {period.status === 'closed' && (
                          <>
                            {canDeletePeriod(period) && (
                              <button
                                onClick={() => openDeleteModal(period)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Удалить период"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                        {period.status === 'active' && (
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-green-600 font-medium">Текущий период</span>
                            {canDeletePeriod(period) && (
                              <button
                                onClick={() => openDeleteModal(period)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Удалить текущий период"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateFirstModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Play className="w-5 h-5" />
                Запустить первый период
              </h3>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Вы создаете первый расчетный период. От него будут отталкиваться все последующие периоды.
              </p>

              {firstPeriodStart && (
                <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
                  <p className="text-xs text-blue-600 mb-1 font-medium">Первый период</p>
                  <p className="font-bold text-blue-900 text-lg">
                    {formatDate(firstPeriodStart)} — {formatDate(calculateNextPeriodEnd(new Date(firstPeriodStart)).toISOString())}
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    Тип: {getPeriodTypeLabel(periodType)}
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-blue-800">
                  Все последующие периоды будут создаваться автоматически от конца предыдущего.
                  При необходимости любой период можно будет удалить.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateFirstModal(false)}
                  disabled={creatingPeriod}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreateFirstPeriod}
                  disabled={creatingPeriod || !firstPeriodStart}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  {creatingPeriod ? 'Создание...' : 'Запустить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateNextModal && activePeriod && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ArrowRight className="w-5 h-5" />
                Создать следующий период
              </h3>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Текущий период будет закрыт, и сразу создастся новый период.
              </p>

              {(() => {
                const now = new Date();
                const nextStart = new Date(now);
                nextStart.setSeconds(0, 0);
                const nextEnd = calculateNextPeriodEnd(nextStart);

                return (
                  <>
                    <div className="bg-red-50 rounded-xl p-4 mb-4 border border-red-200">
                      <p className="text-xs text-red-600 mb-1 font-medium">Закрываемый период</p>
                      <p className="font-bold text-red-900 text-lg">
                        {formatDate(activePeriod.period_start)} — {formatDate(now.toISOString())}
                      </p>
                      <p className="text-xs text-red-600 mt-2">
                        Закроется в момент нажатия кнопки
                      </p>
                    </div>

                    <div className="flex items-center justify-center mb-4">
                      <ArrowRight className="w-6 h-6 text-green-600" />
                    </div>

                    <div className="bg-green-50 rounded-xl p-4 mb-6 border border-green-200">
                      <p className="text-xs text-green-600 mb-1 font-medium">Новый период</p>
                      <p className="font-bold text-green-900 text-lg">
                        {formatDate(nextStart.toISOString())} — {formatDate(nextEnd.toISOString())}
                      </p>
                      <p className="text-xs text-green-600 mt-2">
                        Тип: {getPeriodTypeLabel(periodType)} • Порядковый номер: {activePeriod.period_order + 1}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Начинается сразу после закрытия
                      </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                      <p className="text-sm text-blue-800">
                        Новый период начнётся сразу в момент создания. Для автоматического перехода периодов используется правило полночи.
                      </p>
                    </div>
                  </>
                );
              })()}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateNextModal(false)}
                  disabled={creatingPeriod}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreateNextPeriod}
                  disabled={creatingPeriod}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  {creatingPeriod ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && periodToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Удалить период
              </h3>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Вы действительно хотите удалить последний период?
              </p>

              <div className="bg-red-50 rounded-xl p-4 mb-4 border border-red-200">
                <p className="text-sm text-red-600 mb-1 font-medium">Удаляемый период #{periodToDelete.period_order}</p>
                <p className="font-bold text-red-900 text-lg">
                  {formatDate(periodToDelete.period_start)} — {formatDate(periodToDelete.period_end)}
                </p>
                <p className="text-xs text-red-600 mt-2">
                  Тип: {getPeriodTypeLabel(periodToDelete.period_type)}
                  {periodToDelete.is_first && ' • Первый период'}
                  {periodToDelete.status === 'active' && ' • Активный период'}
                </p>
              </div>

              {allPeriods.length === 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    Это последний период в системе. После удаления вы сможете настроить новый первый период.
                  </p>
                </div>
              )}

              {allPeriods.length > 1 && (() => {
                const sortedPeriods = [...allPeriods].sort((a, b) => b.period_order - a.period_order);
                const previousPeriod = sortedPeriods[1];
                const today = new Date();

                return (
                  <>
                    <div className="flex items-center justify-center mb-4">
                      <ArrowRight className="w-6 h-6 text-green-600 rotate-180" />
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                      <p className="text-sm text-green-800 mb-2 font-medium">
                        Предыдущий период станет активным:
                      </p>
                      <p className="font-bold text-green-900 text-lg">
                        {formatDate(previousPeriod.period_start)} — {formatDate(today.toISOString())}
                      </p>
                      <p className="text-xs text-green-600 mt-2">
                        Период #{previousPeriod.period_order} • Конец периода будет установлен на сегодняшний день
                      </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                      <p className="text-sm text-amber-800">
                        Можно удалять только последний период последовательно. Начальная дата предыдущего периода остается неизменной, конечная переносится на сегодняшний день.
                      </p>
                    </div>
                  </>
                );
              })()}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setPeriodToDelete(null);
                  }}
                  disabled={deletingPeriod}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  onClick={handleDeletePeriod}
                  disabled={deletingPeriod}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {deletingPeriod
                    ? (periodToDelete.status === 'active' && allPeriods.length > 1 ? 'Удаление и перерасчет...' : 'Удаление...')
                    : (periodToDelete.status === 'active' && allPeriods.length > 1 ? 'Удалить и пересчитать' : 'Удалить')
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
