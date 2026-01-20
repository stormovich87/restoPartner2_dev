import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Clock,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EmployeeKPIViewProps {
  partnerId: string;
  employeeId: string;
  branchId: string | null;
  positionId: string | null;
  onBack: () => void;
}

interface PayrollPeriod {
  id: string;
  period_start: string;
  period_end: string;
  period_type: string;
  status: string;
  closed_at: string | null;
  period_order: number;
}

interface TriggerEvent {
  id: string;
  trigger_type: string;
  event_date: string;
  event_time: string;
  branch_name: string;
  schedule_shift_id: string | null;
}

interface IndicatorDetail {
  indicator_name: string;
  indicator_key: string;
  trigger_count: number;
  trigger_limit: number;
  percent: number;
  percent_raw: number;
  minimum_indicator_percent: number;
  triggers: TriggerEvent[];
}

interface SectionDetail {
  section_name: string;
  section_percent: number;
  section_percent_raw: number;
  minimum_section_percent: number;
  indicators: IndicatorDetail[];
}

interface KPIResult {
  overall_kpi_percent: number;
  overall_kpi_percent_raw: number;
  minimum_total_kpi_percent: number;
  trigger_count: number;
  sections: SectionDetail[];
  all_triggers: TriggerEvent[];
}

interface DailyKPI {
  date: string;
  branch_name: string;
  branch_id: string;
  triggers: TriggerEvent[];
  has_issues: boolean;
}

export default function EmployeeKPIView({
  partnerId,
  employeeId,
  branchId,
  positionId,
  onBack
}: EmployeeKPIViewProps) {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState(0);
  const [kpiResult, setKpiResult] = useState<KPIResult | null>(null);
  const [dailyKPIs, setDailyKPIs] = useState<DailyKPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPeriodsModal, setShowPeriodsModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<DailyKPI | null>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<string | null>(null);
  const [expandedIndicatorInfo, setExpandedIndicatorInfo] = useState<Set<string>>(new Set());

  const currentPeriod = periods[currentPeriodIndex];

  useEffect(() => {
    loadPeriods();
  }, [partnerId]);

  useEffect(() => {
    if (currentPeriod) {
      loadKPIData();
      setSelectedIndicator(null);
    }
  }, [currentPeriod, employeeId]);

  const loadPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('kpi_payroll_periods')
        .select('*')
        .eq('partner_id', partnerId)
        .order('period_start', { ascending: false });

      if (error) throw error;

      setPeriods(data || []);
      const activeIndex = (data || []).findIndex(p => p.status === 'active');
      setCurrentPeriodIndex(activeIndex >= 0 ? activeIndex : 0);
    } catch (error) {
      console.error('Error loading periods:', error);
    }
  };

  const loadKPIData = async () => {
    if (!currentPeriod) return;

    setLoading(true);
    try {
      const periodStartTime = currentPeriod.period_start.includes('T')
        ? currentPeriod.period_start
        : `${currentPeriod.period_start}T00:00:00`;
      const periodEndTime = currentPeriod.closed_at ||
        `${currentPeriod.period_end.split('T')[0]}T23:59:59`;

      const { data: noShowShifts } = await supabase
        .from('schedule_shifts')
        .select(`
          id,
          staff_member_id,
          date,
          start_time,
          branch_id,
          position_id,
          no_show_at,
          no_show_reason_status,
          confirmed_at,
          branches(name)
        `)
        .eq('partner_id', partnerId)
        .eq('staff_member_id', employeeId)
        .not('no_show_at', 'is', null)
        .gte('no_show_at', periodStartTime)
        .lte('no_show_at', periodEndTime)
        .order('no_show_at', { ascending: false });

      const filteredNoShows = (noShowShifts || []).filter((shift: any) => {
        if (shift.no_show_reason_status === 'approved') return false;
        return true;
      });

      const noShowsForUnconfirmedTrigger = filteredNoShows.filter((shift: any) => !shift.confirmed_at);

      const { data: unconfirmedShifts } = await supabase
        .from('schedule_shifts')
        .select(`
          id,
          staff_member_id,
          date,
          start_time,
          end_time,
          branch_id,
          confirmation_status,
          confirmed_at,
          created_at,
          branches(name),
          work_segments(id)
        `)
        .eq('partner_id', partnerId)
        .eq('staff_member_id', employeeId)
        .in('confirmation_status', ['pending', 'partially_confirmed'])
        .gte('created_at', periodStartTime)
        .lte('created_at', periodEndTime)
        .order('date', { ascending: false });

      const noShowEvents: TriggerEvent[] = filteredNoShows.map((shift: any) => {
        const noShowDate = new Date(shift.no_show_at);
        return {
          id: shift.id,
          trigger_type: 'no_show',
          event_date: noShowDate.toLocaleDateString('ru-RU'),
          event_time: noShowDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          branch_name: shift.branches?.name || '',
          schedule_shift_id: shift.id
        };
      });

      const unconfirmedEvents: TriggerEvent[] = (unconfirmedShifts || [])
        .filter((shift: any) => {
          if (shift.confirmed_at) return false;
          const hasWorkSegments = shift.work_segments && shift.work_segments.length > 0;
          return hasWorkSegments;
        })
        .map((shift: any) => {
          const shiftDate = new Date(`${shift.date}T${shift.start_time || '00:00:00'}`);
          return {
            id: shift.id,
            trigger_type: 'unconfirmed_closed_shift',
            event_date: shiftDate.toLocaleDateString('ru-RU'),
            event_time: shiftDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            branch_name: shift.branches?.name || '',
            schedule_shift_id: shift.id
          };
        });

      const unconfirmedNoShowEvents: TriggerEvent[] = noShowsForUnconfirmedTrigger.map((shift: any) => {
        const noShowDate = new Date(shift.no_show_at);
        return {
          id: `${shift.id}-unconfirmed`,
          trigger_type: 'unconfirmed_open_shift',
          event_date: noShowDate.toLocaleDateString('ru-RU'),
          event_time: noShowDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          branch_name: shift.branches?.name || '',
          schedule_shift_id: shift.id
        };
      });

      // Load late shifts (shifts with late_minutes > 0)
      const { data: lateShifts } = await supabase
        .from('schedule_shifts')
        .select(`
          id,
          staff_member_id,
          date,
          start_time,
          actual_start_at,
          late_minutes,
          branch_id,
          branches(name)
        `)
        .eq('partner_id', partnerId)
        .eq('staff_member_id', employeeId)
        .gt('late_minutes', 0)
        .gte('date', currentPeriod.period_start.split('T')[0])
        .lte('date', currentPeriod.period_end.split('T')[0])
        .order('date', { ascending: false });

      const lateEvents: TriggerEvent[] = (lateShifts || []).map((shift: any) => {
        const lateDate = shift.actual_start_at
          ? new Date(shift.actual_start_at)
          : new Date(`${shift.date}T${shift.start_time || '00:00:00'}`);

        return {
          id: `${shift.id}-late`,
          trigger_type: 'late',
          event_date: lateDate.toLocaleDateString('ru-RU'),
          event_time: lateDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          branch_name: shift.branches?.name || '',
          schedule_shift_id: shift.id
        };
      });

      const allEvents = [...noShowEvents, ...unconfirmedEvents, ...unconfirmedNoShowEvents, ...lateEvents];

      await calculateKPI(allEvents);

      const { data: shiftsForPeriod } = await supabase
        .from('schedule_shifts')
        .select(`
          id,
          date,
          start_time,
          end_time,
          branch_id,
          branches(name)
        `)
        .eq('partner_id', partnerId)
        .eq('staff_member_id', employeeId)
        .gte('date', currentPeriod.period_start.split('T')[0])
        .lte('date', currentPeriod.period_end.split('T')[0])
        .order('date', { ascending: false });

      const dailyMap = new Map<string, DailyKPI>();

      (shiftsForPeriod || []).forEach((shift: any) => {
        const dateKey = shift.date;
        const shiftTriggers = allEvents.filter(ev => {
          const evDateParts = ev.event_date.split('.');
          const evDateFormatted = `${evDateParts[2]}-${evDateParts[1].padStart(2, '0')}-${evDateParts[0].padStart(2, '0')}`;
          return evDateFormatted === dateKey;
        });

        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, {
            date: dateKey,
            branch_name: shift.branches?.name || '',
            branch_id: shift.branch_id,
            triggers: shiftTriggers,
            has_issues: shiftTriggers.length > 0
          });
        } else {
          const existing = dailyMap.get(dateKey)!;
          existing.triggers = [...existing.triggers, ...shiftTriggers.filter(t =>
            !existing.triggers.some(et => et.id === t.id)
          )];
          existing.has_issues = existing.triggers.length > 0;
        }
      });

      setDailyKPIs(Array.from(dailyMap.values()).sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ));

    } catch (error) {
      console.error('Error loading KPI data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateKPI = async (events: TriggerEvent[]) => {
    try {
      const { data: templates } = await supabase
        .from('kpi_templates')
        .select(`
          id,
          branch_id,
          position_id,
          minimum_total_kpi_percent,
          kpi_template_sections (
            id,
            title,
            minimum_section_percent,
            kpi_template_indicators (
              id,
              indicator_key,
              is_enabled,
              minimum_indicator_percent,
              trigger_types,
              trigger_limit
            )
          )
        `)
        .eq('partner_id', partnerId);

      const template = templates?.find(t => {
        const positionMatch = t.position_id === positionId;
        const branchMatch = t.branch_id === null || t.branch_id === branchId;
        return positionMatch && branchMatch;
      }) || templates?.find(t => {
        return t.branch_id === branchId && t.position_id === positionId;
      });

      if (!template) {
        setKpiResult(null);
        return;
      }

      let sectionPercents: number[] = [];
      let sectionPercentsRaw: number[] = [];
      const sectionsDetails: SectionDetail[] = [];

      template.kpi_template_sections?.forEach((section: any) => {
        let indicatorPercents: number[] = [];
        const indicatorDetails: IndicatorDetail[] = [];

        section.kpi_template_indicators?.forEach((indicator: any) => {
          if (!indicator.is_enabled) return;

          const indicatorTriggers = events.filter(ev =>
            indicator.trigger_types?.includes(ev.trigger_type)
          );
          const triggerCount = indicatorTriggers.length;

          let percentRaw = 100;
          if (indicator.trigger_limit > 0) {
            const step = 100 / indicator.trigger_limit;
            percentRaw = Math.max(0, Math.min(100, 100 - triggerCount * step));
          } else if (indicator.trigger_limit === 0 && triggerCount > 0) {
            percentRaw = 0;
          }

          const finalPercent = percentRaw < indicator.minimum_indicator_percent ? 0 : percentRaw;
          indicatorPercents.push(finalPercent);

          indicatorDetails.push({
            indicator_name: getIndicatorName(indicator.indicator_key),
            indicator_key: indicator.indicator_key,
            trigger_count: triggerCount,
            trigger_limit: indicator.trigger_limit,
            percent: Math.round(finalPercent),
            percent_raw: Math.round(percentRaw),
            minimum_indicator_percent: indicator.minimum_indicator_percent,
            triggers: indicatorTriggers
          });
        });

        if (indicatorPercents.length > 0) {
          const sectionPercentRaw = indicatorPercents.reduce((a, b) => a + b, 0) / indicatorPercents.length;
          const sectionPercent = sectionPercentRaw < section.minimum_section_percent ? 0 : sectionPercentRaw;
          sectionPercents.push(sectionPercent);
          sectionPercentsRaw.push(sectionPercentRaw);

          sectionsDetails.push({
            section_name: section.title || 'Секция',
            section_percent: Math.round(sectionPercent),
            section_percent_raw: Math.round(sectionPercentRaw),
            minimum_section_percent: section.minimum_section_percent,
            indicators: indicatorDetails
          });
        }
      });

      const totalPercentRaw = sectionPercentsRaw.length > 0
        ? sectionPercentsRaw.reduce((a, b) => a + b, 0) / sectionPercentsRaw.length
        : 0;

      const overallKPI = totalPercentRaw < template.minimum_total_kpi_percent ? 0 : totalPercentRaw;

      setKpiResult({
        overall_kpi_percent: Math.round(overallKPI),
        overall_kpi_percent_raw: Math.round(totalPercentRaw),
        minimum_total_kpi_percent: template.minimum_total_kpi_percent,
        trigger_count: events.length,
        sections: sectionsDetails,
        all_triggers: events
      });
    } catch (error) {
      console.error('Error calculating KPI:', error);
    }
  };

  const getIndicatorName = (key: string): string => {
    const names: Record<string, string> = {
      'punctuality': 'Прогулы',
      'late_arrivals': 'Опоздания',
      'shift_confirmation': 'Подтверждение смен',
      'no_show': 'Неявки',
      'late': 'Опоздания',
      'early_leave': 'Ранние уходы',
      'red_card': 'Красные карточки',
      'unconfirmed_open_shift': 'Неподтвержденная смена',
      'unconfirmed_closed_shift': 'Неподтвержденная смена'
    };
    return names[key] || key;
  };

  const getTriggerTypeName = (type: string): string => {
    const names: Record<string, string> = {
      'no_show': 'Прогул',
      'late': 'Опоздание',
      'early_leave': 'Ранний уход',
      'unconfirmed_open_shift': 'Неподтвержденная смена',
      'unconfirmed_closed_shift': 'Неподтвержденная смена',
      'red_card': 'Красная карточка'
    };
    return names[type] || type;
  };

  const formatPeriodDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const formatPeriodLabel = (period: PayrollPeriod) => {
    return `${formatPeriodDate(period.period_start)} - ${formatPeriodDate(period.period_end)}`;
  };

  const formatDayDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleDateString('ru-RU', { month: 'short' });
    const weekday = date.toLocaleDateString('ru-RU', { weekday: 'short' });
    return { day, month, weekday };
  };

  const getKPIColor = (percent: number) => {
    if (percent >= 80) return 'text-green-600';
    if (percent >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getKPIBgColor = (percent: number) => {
    if (percent >= 80) return 'bg-green-100 text-green-700';
    if (percent >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  const toggleSection = (sectionName: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionName)) {
      newExpanded.delete(sectionName);
    } else {
      newExpanded.add(sectionName);
    }
    setExpandedSections(newExpanded);
  };

  const toggleIndicatorInfo = (indicatorKey: string) => {
    const newExpanded = new Set(expandedIndicatorInfo);
    if (newExpanded.has(indicatorKey)) {
      newExpanded.delete(indicatorKey);
    } else {
      newExpanded.add(indicatorKey);
    }
    setExpandedIndicatorInfo(newExpanded);
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentPeriodIndex > 0) {
      setCurrentPeriodIndex(currentPeriodIndex - 1);
    } else if (direction === 'next' && currentPeriodIndex < periods.length - 1) {
      setCurrentPeriodIndex(currentPeriodIndex + 1);
    }
  };

  if (loading && !kpiResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="font-bold text-lg text-gray-900">KPI</h1>
          </div>
        </div>

        {currentPeriod && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-2">
              <button
                onClick={() => navigatePeriod('next')}
                disabled={currentPeriodIndex >= periods.length - 1}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowPeriodsModal(true)}
                className="flex-1 text-center py-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span className="font-semibold text-gray-900">
                  {formatPeriodLabel(currentPeriod)}
                </span>
                {currentPeriod.status === 'active' && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    Текущий
                  </span>
                )}
              </button>
              <button
                onClick={() => navigatePeriod('prev')}
                disabled={currentPeriodIndex <= 0}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {kpiResult ? (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Итоговый KPI
                  </h3>
                  <div className={`text-2xl font-bold ${
                    kpiResult.overall_kpi_percent >= 80 ? 'text-green-300' :
                    kpiResult.overall_kpi_percent >= 50 ? 'text-amber-300' :
                    'text-red-300'
                  }`}>
                    {kpiResult.overall_kpi_percent}%
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {kpiResult.sections.map((section, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection(section.section_name)}
                      className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">{section.section_name}</span>
                        {section.section_percent < section.minimum_section_percent && (
                          <span className="text-xs text-red-600">
                            (ниже мин. {section.minimum_section_percent}%)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${getKPIColor(section.section_percent)}`}>
                          {section.section_percent}%
                        </span>
                        {expandedSections.has(section.section_name) ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {expandedSections.has(section.section_name) && (
                      <div className="p-4 space-y-3 bg-white">
                        {section.indicators.map((indicator, iIdx) => {
                          const isSelected = selectedIndicator === indicator.indicator_key;
                          const statusText = indicator.percent === 0 && indicator.percent_raw < indicator.minimum_indicator_percent
                            ? `Показатель ${indicator.percent}% т.к. меньше минимума`
                            : `Показатель ${indicator.percent}%`;

                          return (
                            <div key={iIdx} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setSelectedIndicator(isSelected ? null : indicator.indicator_key)}
                                  className={`flex-1 transition-all ${
                                    isSelected ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:bg-gray-50'
                                  } rounded-lg p-3 text-left`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-gray-700 font-medium">{indicator.indicator_name}</span>
                                      <span className="text-xs text-gray-400">
                                        ({indicator.trigger_count}/{indicator.trigger_limit})
                                      </span>
                                    </div>
                                    <span className={`text-sm font-semibold ${getKPIColor(indicator.percent)}`}>
                                      {indicator.percent}%
                                    </span>
                                  </div>
                                </button>
                                <button
                                  onClick={() => toggleIndicatorInfo(indicator.indicator_key)}
                                  className="p-3 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                                  title="Информация о показателе"
                                >
                                  <Info className="w-4 h-4 text-blue-600" />
                                </button>
                              </div>
                              {expandedIndicatorInfo.has(indicator.indicator_key) && (
                                <div className="mx-3 p-3 bg-blue-50 rounded-lg space-y-1 text-xs border border-blue-200">
                                  <div className="text-gray-700">
                                    Получилось: <span className="font-semibold text-blue-600">{indicator.percent_raw}%</span>
                                  </div>
                                  <div className="text-gray-700">
                                    Минимальный: <span className="font-semibold text-blue-600">{indicator.minimum_indicator_percent}%</span>
                                  </div>
                                  <div className={`${
                                    indicator.percent === 0 && indicator.percent_raw < indicator.minimum_indicator_percent
                                      ? 'text-red-600 font-semibold'
                                      : 'text-gray-700'
                                  }`}>
                                    {statusText}
                                  </div>
                                </div>
                              )}
                              {indicator.triggers.length > 0 && (
                                <div className="pl-4 space-y-1">
                                  {indicator.triggers.map((trigger, tIdx) => {
                                    const step = indicator.trigger_limit > 0 ? 100 / indicator.trigger_limit : 100;
                                    const triggerNumber = indicator.triggers.length - tIdx;
                                    const percentAfterTrigger = indicator.trigger_limit > 0
                                      ? Math.max(0, Math.min(100, 100 - triggerNumber * step))
                                      : 0;

                                    return (
                                      <div
                                        key={tIdx}
                                        className="flex items-center justify-between gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2"
                                      >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <Clock className="w-3 h-3 flex-shrink-0" />
                                          <span className="truncate">{trigger.event_date} {trigger.event_time}</span>
                                          <Building2 className="w-3 h-3 flex-shrink-0 ml-1" />
                                          <span className="truncate">{trigger.branch_name}</span>
                                        </div>
                                        <span className="text-xs font-semibold text-red-600 whitespace-nowrap ml-2">
                                          → {Math.round(percentAfterTrigger)}%
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {kpiResult.overall_kpi_percent === 0 && kpiResult.overall_kpi_percent_raw > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">KPI = 0%</div>
                        <div className="text-xs mt-1">
                          Средний процент по разделам ({kpiResult.overall_kpi_percent_raw}%)
                          ниже минимального ({kpiResult.minimum_total_kpi_percent}%)
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(() => {
              const selectedIndicatorData = selectedIndicator
                ? kpiResult.sections
                    .flatMap(s => s.indicators)
                    .find(ind => ind.indicator_key === selectedIndicator)
                : null;

              const filteredTriggers = selectedIndicatorData
                ? kpiResult.all_triggers.filter(trigger =>
                    selectedIndicatorData.triggers.some(t => t.id === trigger.id)
                  )
                : kpiResult.all_triggers;

              const showTriggersBlock = filteredTriggers.length > 0;

              return showTriggersBlock && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Срабатывания ({filteredTriggers.length})
                      </h3>
                      {selectedIndicator && (
                        <button
                          onClick={() => setSelectedIndicator(null)}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          Показать все
                        </button>
                      )}
                    </div>
                    {selectedIndicatorData && (
                      <p className="text-xs text-gray-500 mt-1">
                        Показатель: {selectedIndicatorData.indicator_name}
                      </p>
                    )}
                  </div>
                  <div className="divide-y divide-gray-100">
                    {filteredTriggers.map((trigger, idx) => (
                      <div key={idx} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {trigger.event_date} {trigger.event_time}
                            </span>
                            <span className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                              <Building2 className="w-3 h-3" />
                              {trigger.branch_name}
                            </span>
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          trigger.trigger_type === 'no_show' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {getTriggerTypeName(trigger.trigger_type)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {dailyKPIs.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    По дням
                  </h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {dailyKPIs.map((day, idx) => {
                    const { day: dayNum, month, weekday } = formatDayDate(day.date);
                    return (
                      <button
                        key={idx}
                        onClick={() => day.has_issues && setSelectedDay(day)}
                        className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                          !day.has_issues ? 'cursor-default' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-xl flex flex-col items-center justify-center">
                            <span className="text-xs text-gray-400 leading-none">{weekday}</span>
                            <span className="font-bold text-gray-900 leading-none">{dayNum}</span>
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-medium text-gray-900">{day.branch_name}</div>
                            <div className="text-xs text-gray-400">{month}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {day.has_issues ? (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {day.triggers.length}
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              OK
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Нет данных KPI для этой должности</p>
          </div>
        )}
      </div>

      {showPeriodsModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowPeriodsModal(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[70vh] overflow-hidden animate-slide-up">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Периоды</h3>
                <button
                  onClick={() => setShowPeriodsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[60vh] pb-6">
              <div className="divide-y divide-gray-100">
                {periods.map((period, idx) => (
                  <button
                    key={period.id}
                    onClick={() => {
                      setCurrentPeriodIndex(idx);
                      setShowPeriodsModal(false);
                    }}
                    className={`w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                      idx === currentPeriodIndex ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-medium text-gray-900">
                        {formatPeriodLabel(period)}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {period.period_type === 'month' ? 'Месяц' :
                         period.period_type === 'half_month' ? 'Полмесяца' : 'Неделя'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {period.status === 'active' && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          Текущий
                        </span>
                      )}
                      {period.status === 'closed' && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                          Закрыт
                        </span>
                      )}
                      {idx === currentPeriodIndex && (
                        <Check className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {selectedDay && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedDay(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[70vh] overflow-hidden animate-slide-up">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {new Date(selectedDay.date).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      weekday: 'long'
                    })}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedDay.branch_name}</p>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-3">
              {selectedDay.triggers.map((trigger, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {getTriggerTypeName(trigger.trigger_type)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {trigger.event_time}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
