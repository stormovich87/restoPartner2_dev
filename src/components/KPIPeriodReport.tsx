import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  FileText,
  Calendar,
  Users,
  Building2,
  Briefcase,
  Search,
  TrendingUp,
  AlertTriangle,
  Clock,
  Filter,
  X,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface KPIPeriodReportProps {
  partnerId: string;
  periodId: string;
  periodStart: string;
  periodEnd: string;
  closedAt: string | null;
  status: string;
  onBack: () => void;
}

interface Branch {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
  last_name: string;
  photo_url: string | null;
  position_id: string;
  position_name: string;
  branch_id: string;
  branch_name: string;
}

interface SectionDetail {
  section_name: string;
  section_percent: number;
  section_percent_raw: number;
  minimum_section_percent: number;
  indicators: IndicatorDetail[];
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

interface EmployeeKPIResult {
  employee: Employee;
  overall_kpi_percent: number;
  overall_kpi_percent_raw: number;
  punctuality_percent: number;
  minimum_total_kpi_percent: number;
  trigger_count: number;
  sections: SectionDetail[];
  employee_triggers: TriggerEvent[];
}

interface TriggerEvent {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_photo: string | null;
  branch_name: string;
  position_name: string;
  trigger_type: string;
  event_date: string;
  event_time: string;
  schedule_shift_id: string | null;
}

export default function KPIPeriodReport({
  partnerId,
  periodId,
  periodStart,
  periodEnd,
  closedAt,
  status,
  onBack
}: KPIPeriodReportProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [triggerEvents, setTriggerEvents] = useState<TriggerEvent[]>([]);
  const [kpiResults, setKpiResults] = useState<EmployeeKPIResult[]>([]);

  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBranchFilter, setShowBranchFilter] = useState(false);
  const [showPositionFilter, setShowPositionFilter] = useState(false);

  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'results' | 'triggers'>('results');
  const [sortField, setSortField] = useState<'name' | 'kpi' | 'punctuality'>('kpi');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedIndicator, setSelectedIndicator] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [partnerId, periodId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [branchesRes, positionsRes, employeesRes] = await Promise.all([
        supabase
          .from('branches')
          .select('id, name')
          .eq('partner_id', partnerId)
          .order('name'),
        supabase
          .from('positions')
          .select('id, name')
          .eq('partner_id', partnerId)
          .order('name'),
        supabase
          .from('employees')
          .select(`
            id,
            first_name,
            last_name,
            photo_url,
            position_id,
            branch_id,
            positions!inner(name),
            branches!inner(name)
          `)
          .eq('partner_id', partnerId)
          .is('dismissal_date', null)
      ]);

      if (branchesRes.error) throw branchesRes.error;
      if (positionsRes.error) throw positionsRes.error;
      if (employeesRes.error) throw employeesRes.error;

      setBranches(branchesRes.data || []);
      setPositions(positionsRes.data || []);

      const formattedEmployees = (employeesRes.data || []).map((emp: any) => ({
        id: emp.id,
        name: emp.first_name || '',
        last_name: emp.last_name || '',
        photo_url: emp.photo_url,
        position_id: emp.position_id,
        position_name: emp.positions.name,
        branch_id: emp.branch_id,
        branch_name: emp.branches.name
      }));
      setEmployees(formattedEmployees);

      // Determine time boundaries for filtering triggers
      // Ensure periodStart includes time (default to 00:00:00)
      const periodStartTime = periodStart.includes('T') ? periodStart : `${periodStart}T00:00:00`;
      // Use closed_at if available (for closed periods), otherwise use end of period day
      const periodEndTime = closedAt || `${periodEnd.split('T')[0]}T23:59:59`;

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
          branches(name),
          positions(name)
        `)
        .eq('partner_id', partnerId)
        .not('no_show_at', 'is', null)
        .gte('no_show_at', periodStartTime)
        .lte('no_show_at', periodEndTime)
        .order('no_show_at', { ascending: false });

      const filteredNoShows = (noShowShifts || []).filter((shift: any) => {
        if (shift.no_show_reason_status === 'approved') {
          return false;
        }
        if (!shift.staff_member_id) {
          return false;
        }
        return true;
      });

      // Split no-shows: those with confirmed_at go only to no_show trigger,
      // those without confirmed_at go to both no_show and unconfirmed_open_shift triggers
      const noShowsForUnconfirmedTrigger = filteredNoShows.filter((shift: any) => !shift.confirmed_at);

      // Load unconfirmed shifts
      const { data: unconfirmedShifts } = await supabase
        .from('schedule_shifts')
        .select(`
          id,
          staff_member_id,
          date,
          start_time,
          end_time,
          branch_id,
          position_id,
          confirmation_status,
          confirmed_at,
          created_at,
          branches(name),
          positions(name),
          work_segments(id)
        `)
        .eq('partner_id', partnerId)
        .in('confirmation_status', ['pending', 'partially_confirmed'])
        .gte('created_at', periodStartTime)
        .lte('created_at', periodEndTime)
        .not('staff_member_id', 'is', null)
        .order('date', { ascending: false });

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
          position_id,
          branches(name),
          positions(name)
        `)
        .eq('partner_id', partnerId)
        .gt('late_minutes', 0)
        .gte('date', periodStart.split('T')[0])
        .lte('date', periodEnd.split('T')[0])
        .not('staff_member_id', 'is', null)
        .order('date', { ascending: false });

      const allEmployeeIds = [
        ...new Set([
          ...filteredNoShows.map((s: any) => s.staff_member_id),
          ...(unconfirmedShifts || []).map((s: any) => s.staff_member_id),
          ...(lateShifts || []).map((s: any) => s.staff_member_id)
        ])
      ];
      const employeesMap = new Map<string, any>();

      if (allEmployeeIds.length > 0) {
        const { data: empData } = await supabase
          .from('employees')
          .select('id, first_name, last_name, photo_url, position_id, branch_id, positions(name), branches(name)')
          .in('id', allEmployeeIds);

        (empData || []).forEach((emp: any) => {
          employeesMap.set(emp.id, emp);
        });
      }

      const noShowEvents: TriggerEvent[] = filteredNoShows.map((shift: any) => {
        const emp = employeesMap.get(shift.staff_member_id);
        const noShowDate = new Date(shift.no_show_at);

        return {
          id: shift.id,
          employee_id: shift.staff_member_id,
          employee_name: emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : '',
          employee_photo: emp?.photo_url || null,
          branch_name: shift.branches?.name || emp?.branches?.name || '',
          position_name: shift.positions?.name || emp?.positions?.name || '',
          trigger_type: 'no_show',
          event_date: noShowDate.toLocaleDateString('ru-RU'),
          event_time: noShowDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          schedule_shift_id: shift.id
        };
      });

      const unconfirmedEvents: TriggerEvent[] = (unconfirmedShifts || [])
        .filter((shift: any) => {
          if (shift.confirmed_at) {
            return false;
          }
          const hasWorkSegments = shift.work_segments && shift.work_segments.length > 0;
          return hasWorkSegments;
        })
        .map((shift: any) => {
          const emp = employeesMap.get(shift.staff_member_id);
          const shiftDate = new Date(`${shift.date}T${shift.start_time || '00:00:00'}`);
          const hasWorkSegments = shift.work_segments && shift.work_segments.length > 0;
          const triggerType = hasWorkSegments ? 'unconfirmed_closed_shift' : 'unconfirmed_open_shift';

          return {
            id: shift.id,
            employee_id: shift.staff_member_id,
            employee_name: emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : '',
            employee_photo: emp?.photo_url || null,
            branch_name: shift.branches?.name || emp?.branches?.name || '',
            position_name: shift.positions?.name || emp?.positions?.name || '',
            trigger_type: triggerType,
            event_date: shiftDate.toLocaleDateString('ru-RU'),
            event_time: shiftDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            schedule_shift_id: shift.id
          };
        });

      // Add no-shows without confirmation as unconfirmed_open_shift triggers
      const unconfirmedNoShowEvents: TriggerEvent[] = noShowsForUnconfirmedTrigger.map((shift: any) => {
        const emp = employeesMap.get(shift.staff_member_id);
        const noShowDate = new Date(shift.no_show_at);

        return {
          id: `${shift.id}-unconfirmed`,
          employee_id: shift.staff_member_id,
          employee_name: emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : '',
          employee_photo: emp?.photo_url || null,
          branch_name: shift.branches?.name || emp?.branches?.name || '',
          position_name: shift.positions?.name || emp?.positions?.name || '',
          trigger_type: 'unconfirmed_open_shift',
          event_date: noShowDate.toLocaleDateString('ru-RU'),
          event_time: noShowDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          schedule_shift_id: shift.id
        };
      });

      // Add late events (опоздания)
      const lateEvents: TriggerEvent[] = (lateShifts || []).map((shift: any) => {
        const emp = employeesMap.get(shift.staff_member_id);
        const lateDate = shift.actual_start_at
          ? new Date(shift.actual_start_at)
          : new Date(`${shift.date}T${shift.start_time || '00:00:00'}`);

        return {
          id: `${shift.id}-late`,
          employee_id: shift.staff_member_id,
          employee_name: emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : '',
          employee_photo: emp?.photo_url || null,
          branch_name: shift.branches?.name || emp?.branches?.name || '',
          position_name: shift.positions?.name || emp?.positions?.name || '',
          trigger_type: 'late',
          event_date: lateDate.toLocaleDateString('ru-RU'),
          event_time: lateDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          schedule_shift_id: shift.id
        };
      });

      const formattedEvents = [...noShowEvents, ...unconfirmedEvents, ...unconfirmedNoShowEvents, ...lateEvents];
      setTriggerEvents(formattedEvents);

      await calculateKPIResults(formattedEmployees, formattedEvents);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
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

  const calculateKPIResults = async (emps: Employee[], events: TriggerEvent[]) => {
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

      const findTemplate = (emp: Employee) => {
        return templates?.find(t => {
          const positionMatch = t.position_id === emp.position_id;
          const branchMatch = t.branch_id === null || t.branch_id === emp.branch_id;
          return positionMatch && branchMatch;
        }) || templates?.find(t => {
          return t.branch_id === emp.branch_id && t.position_id === emp.position_id;
        });
      };

      const results: EmployeeKPIResult[] = emps
        .filter(emp => {
          const template = findTemplate(emp);
          return !!template;
        })
        .map(emp => {
        const template = findTemplate(emp);

        if (!template) {
          return null as any;
        }

        const empEvents = events.filter(ev => ev.employee_id === emp.id);

        let sectionPercents: number[] = [];
        let sectionPercentsRaw: number[] = [];
        const sectionsDetails: SectionDetail[] = [];

        template.kpi_template_sections?.forEach((section: any) => {
          let indicatorPercents: number[] = [];
          const indicatorDetails: IndicatorDetail[] = [];

          section.kpi_template_indicators?.forEach((indicator: any) => {
            if (!indicator.is_enabled) return;

            const indicatorTriggers = empEvents.filter(ev =>
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

        const punctualitySection = template.kpi_template_sections?.find((s: any) =>
          s.kpi_template_indicators?.some((i: any) => i.indicator_key === 'punctuality')
        );
        const punctualityIndicator = punctualitySection?.kpi_template_indicators?.find(
          (i: any) => i.indicator_key === 'punctuality'
        );

        let punctualityPercent = 100;
        if (punctualityIndicator?.is_enabled) {
          const triggerCount = empEvents.filter(ev =>
            punctualityIndicator.trigger_types?.includes(ev.trigger_type)
          ).length;

          if (punctualityIndicator.trigger_limit > 0) {
            const step = 100 / punctualityIndicator.trigger_limit;
            punctualityPercent = Math.max(0, Math.min(100, 100 - triggerCount * step));
          } else if (punctualityIndicator.trigger_limit === 0 && triggerCount > 0) {
            punctualityPercent = 0;
          }
        }

        return {
          employee: emp,
          overall_kpi_percent: Math.round(overallKPI),
          overall_kpi_percent_raw: Math.round(totalPercentRaw),
          punctuality_percent: Math.round(punctualityPercent),
          minimum_total_kpi_percent: template.minimum_total_kpi_percent,
          trigger_count: empEvents.length,
          sections: sectionsDetails,
          employee_triggers: empEvents
        };
      });

      setKpiResults(results);
    } catch (error) {
      console.error('Error calculating KPI:', error);
    }
  };

  const filteredResults = useMemo(() => {
    let filtered = kpiResults;

    if (selectedBranches.length > 0) {
      filtered = filtered.filter(r => selectedBranches.includes(r.employee.branch_id));
    }

    if (selectedPositions.length > 0) {
      filtered = filtered.filter(r => selectedPositions.includes(r.employee.position_id));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.employee.name.toLowerCase().includes(query) ||
        r.employee.last_name.toLowerCase().includes(query)
      );
    }

    filtered.sort((a, b) => {
      let valueA: number | string;
      let valueB: number | string;

      switch (sortField) {
        case 'name':
          valueA = `${a.employee.name} ${a.employee.last_name}`;
          valueB = `${b.employee.name} ${b.employee.last_name}`;
          break;
        case 'kpi':
          valueA = a.overall_kpi_percent;
          valueB = b.overall_kpi_percent;
          break;
        case 'punctuality':
          valueA = a.punctuality_percent;
          valueB = b.punctuality_percent;
          break;
        default:
          valueA = a.overall_kpi_percent;
          valueB = b.overall_kpi_percent;
      }

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDirection === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }

      return sortDirection === 'asc'
        ? (valueA as number) - (valueB as number)
        : (valueB as number) - (valueA as number);
    });

    return filtered;
  }, [kpiResults, selectedBranches, selectedPositions, searchQuery, sortField, sortDirection]);

  const filteredTriggers = useMemo(() => {
    let filtered = triggerEvents;

    if (selectedBranches.length > 0) {
      const branchNames = branches.filter(b => selectedBranches.includes(b.id)).map(b => b.name);
      filtered = filtered.filter(t => branchNames.includes(t.branch_name));
    }

    if (selectedPositions.length > 0) {
      const positionNames = positions.filter(p => selectedPositions.includes(p.id)).map(p => p.name);
      filtered = filtered.filter(t => positionNames.includes(t.position_name));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.employee_name.toLowerCase().includes(query));
    }

    return filtered;
  }, [triggerEvents, selectedBranches, selectedPositions, searchQuery, branches, positions]);

  const toggleBranch = (branchId: string) => {
    setSelectedBranches(prev =>
      prev.includes(branchId) ? prev.filter(id => id !== branchId) : [...prev, branchId]
    );
  };

  const togglePosition = (positionId: string) => {
    setSelectedPositions(prev =>
      prev.includes(positionId) ? prev.filter(id => id !== positionId) : [...prev, positionId]
    );
  };

  const toggleRowExpanded = (employeeId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  const handleSort = (field: 'name' | 'kpi' | 'punctuality') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getTriggerLabel = (type: string) => {
    switch (type) {
      case 'no_show': return 'Прогул';
      case 'late': return 'Опоздание';
      default: return type;
    }
  };

  const getKPIColor = (percent: number) => {
    if (percent >= 80) return 'text-green-600 bg-green-100';
    if (percent >= 50) return 'text-amber-600 bg-amber-100';
    return 'text-red-600 bg-red-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Загрузка отчета...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" />
            Отчет KPI за период
          </h2>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-gray-600">
              {formatDate(periodStart)} — {formatDate(periodEnd)}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              status === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {status === 'active' ? 'Активный' : 'Закрыт'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative">
            <button
              onClick={() => setShowBranchFilter(!showBranchFilter)}
              className="px-4 py-2 rounded-xl font-medium flex items-center gap-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 transition-all"
            >
              <Building2 className="w-4 h-4" />
              Филиалы
              {selectedBranches.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs font-semibold">
                  {selectedBranches.length}
                </span>
              )}
            </button>

            {showBranchFilter && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-64 overflow-y-auto">
                <div className="p-2 border-b border-gray-200 flex justify-between items-center">
                  <span className="text-sm text-gray-600">Выберите филиалы</span>
                  <button onClick={() => setShowBranchFilter(false)}>
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="p-2 space-y-1">
                  {branches.map(branch => (
                    <label
                      key={branch.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selectedBranches.includes(branch.id)
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300'
                      }`}>
                        {selectedBranches.includes(branch.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedBranches.includes(branch.id)}
                        onChange={() => toggleBranch(branch.id)}
                        className="sr-only"
                      />
                      <span className="text-sm text-gray-700">{branch.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowPositionFilter(!showPositionFilter)}
              className="px-4 py-2 rounded-xl font-medium flex items-center gap-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 transition-all"
            >
              <Briefcase className="w-4 h-4" />
              Должности
              {selectedPositions.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-green-600 text-white rounded-full text-xs font-semibold">
                  {selectedPositions.length}
                </span>
              )}
            </button>

            {showPositionFilter && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-64 overflow-y-auto">
                <div className="p-2 border-b border-gray-200 flex justify-between items-center">
                  <span className="text-sm text-gray-600">Выберите должности</span>
                  <button onClick={() => setShowPositionFilter(false)}>
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="p-2 space-y-1">
                  {positions.map(position => (
                    <label
                      key={position.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selectedPositions.includes(position.id)
                          ? 'bg-green-600 border-green-600'
                          : 'border-gray-300'
                      }`}>
                        {selectedPositions.includes(position.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedPositions.includes(position.id)}
                        onChange={() => togglePosition(position.id)}
                        className="sr-only"
                      />
                      <span className="text-sm text-gray-700">{position.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по сотруднику..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveSection('results')}
          className={`px-6 py-3 font-medium transition-all relative ${
            activeSection === 'results' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Результаты сотрудников
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
              {filteredResults.length}
            </span>
          </div>
          {activeSection === 'results' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
          )}
        </button>
        <button
          onClick={() => setActiveSection('triggers')}
          className={`px-6 py-3 font-medium transition-all relative ${
            activeSection === 'triggers' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Срабатывания триггеров
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
              {filteredTriggers.length}
            </span>
          </div>
          {activeSection === 'triggers' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
          )}
        </button>
      </div>

      {activeSection === 'results' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    Сотрудник
                    {sortField === 'name' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Должность
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Филиал
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                  <button
                    onClick={() => handleSort('kpi')}
                    className="flex items-center gap-1 hover:text-gray-900 mx-auto"
                  >
                    Итоговый KPI
                    {sortField === 'kpi' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    Нет данных для отображения
                  </td>
                </tr>
              ) : (
                filteredResults.map(result => {
                  const isExpanded = expandedRows.has(result.employee.id);
                  return (
                    <>
                      <tr
                        key={result.employee.id}
                        onClick={() => toggleRowExpanded(result.employee.id)}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <button className="text-gray-400 hover:text-gray-600">
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </button>
                            {result.employee.photo_url ? (
                              <img
                                src={result.employee.photo_url}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <Users className="w-5 h-5 text-gray-500" />
                              </div>
                            )}
                            <span className="font-medium text-gray-900">
                              {result.employee.name} {result.employee.last_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {result.employee.position_name}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {result.employee.branch_name}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center px-4 py-2 rounded-lg font-bold text-lg ${getKPIColor(result.overall_kpi_percent)}`}>
                            {result.overall_kpi_percent}%
                          </span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${result.employee.id}-details`} className="bg-gray-50">
                          <td colSpan={4} className="px-6 py-6">
                            <div className="space-y-6">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white rounded-xl p-4 border border-gray-200">
                                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-blue-600" />
                                    Расчет KPI
                                  </h4>
                                  <div className="space-y-3">
                                    {result.sections.map((section, sIdx) => (
                                      <div key={sIdx} className="border-l-4 border-blue-500 pl-3">
                                        <div
                                          className="flex justify-between items-center mb-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
                                          onClick={() => setSelectedSection(
                                            selectedSection === section.section_name ? null : section.section_name
                                          )}
                                        >
                                          <span className="font-medium text-gray-700">{section.section_name}</span>
                                          <span className={`font-bold ${getKPIColor(section.section_percent)}`}>
                                            {section.section_percent}%
                                          </span>
                                        </div>
                                        {selectedSection === section.section_name && (
                                          <div className="text-xs text-gray-600 mb-2 ml-2 p-2 bg-blue-50 rounded">
                                            <div>Получилось: {section.section_percent_raw}%</div>
                                            <div>Минимальный: {section.minimum_section_percent}%</div>
                                            {section.section_percent === 0 && section.section_percent_raw < section.minimum_section_percent && (
                                              <div className="text-gray-500 mt-1">
                                                Показатель 0% т.к. меньше минимума
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        <div className="space-y-2 ml-2">
                                          {section.indicators.map((indicator, iIdx) => (
                                            <div key={iIdx}>
                                              <div
                                                className={`flex justify-between items-center text-sm p-2 rounded cursor-pointer transition-colors ${
                                                  selectedIndicator === indicator.indicator_key
                                                    ? 'bg-blue-100 border border-blue-400'
                                                    : 'hover:bg-gray-50'
                                                }`}
                                                onClick={() => setSelectedIndicator(
                                                  selectedIndicator === indicator.indicator_key ? null : indicator.indicator_key
                                                )}
                                              >
                                                <div className="flex-1">
                                                  <span className="text-gray-600">
                                                    {indicator.indicator_name}
                                                    <span className="text-xs text-gray-400 ml-1">
                                                      ({indicator.trigger_count}/{indicator.trigger_limit > 0 ? indicator.trigger_limit : '∞'})
                                                    </span>
                                                  </span>
                                                </div>
                                                <span className={`font-semibold ${getKPIColor(indicator.percent)}`}>
                                                  {indicator.percent}%
                                                </span>
                                              </div>
                                              {selectedIndicator === indicator.indicator_key && (
                                                <div className="text-xs text-gray-600 mt-1 ml-2 p-2 bg-blue-50 rounded">
                                                  <div>Получилось: {indicator.percent_raw}%</div>
                                                  <div>Минимальный: {indicator.minimum_indicator_percent}%</div>
                                                  {indicator.percent === 0 && indicator.percent_raw < indicator.minimum_indicator_percent && (
                                                    <div className="text-gray-500 mt-1">
                                                      Показатель 0% т.к. меньше минимума
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                    <div className="pt-3 border-t border-gray-200">
                                      <div className="flex justify-between items-center mb-2">
                                        <div>
                                          <span className="font-bold text-gray-900">Итоговый KPI</span>
                                        </div>
                                        <span className={`text-xl font-bold ${getKPIColor(result.overall_kpi_percent)}`}>
                                          {result.overall_kpi_percent}%
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-600 space-y-1">
                                        <div>Средний процент по разделам: {result.overall_kpi_percent_raw}%</div>
                                        <div>Минимальный: {result.minimum_total_kpi_percent}%</div>
                                        {result.overall_kpi_percent === 0 && result.overall_kpi_percent_raw < result.minimum_total_kpi_percent && (
                                          <div className="text-gray-500 mt-1">
                                            Общий KPI 0% т.к. средний процент по разделам ниже минимума
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="bg-white rounded-xl p-4 border border-gray-200">
                                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                                    Срабатывания триггеров ({result.employee_triggers.length})
                                  </h4>
                                  {result.employee_triggers.length === 0 ? (
                                    <p className="text-gray-500 text-sm text-center py-4">
                                      Нет срабатываний за период
                                    </p>
                                  ) : (
                                    <div className="space-y-4">
                                      {Array.from(new Set(result.employee_triggers.map(t => {
                                        if (t.trigger_type === 'no_show') {
                                          return 'punctuality';
                                        }
                                        if (t.trigger_type === 'late') {
                                          return 'late_arrivals';
                                        }
                                        if (t.trigger_type === 'unconfirmed_open_shift' || t.trigger_type === 'unconfirmed_closed_shift') {
                                          return 'shift_confirmation';
                                        }
                                        return 'other';
                                      }))).map(indicatorKey => {
                                        const indicatorTriggers = selectedIndicator && selectedIndicator !== indicatorKey
                                          ? []
                                          : result.employee_triggers.filter(t => {
                                            if (indicatorKey === 'punctuality') {
                                              return t.trigger_type === 'no_show';
                                            }
                                            if (indicatorKey === 'late_arrivals') {
                                              return t.trigger_type === 'late';
                                            }
                                            if (indicatorKey === 'shift_confirmation') {
                                              return t.trigger_type === 'unconfirmed_open_shift' || t.trigger_type === 'unconfirmed_closed_shift';
                                            }
                                            return false;
                                          });

                                        if (indicatorTriggers.length === 0 && (!selectedIndicator || selectedIndicator === indicatorKey)) {
                                          if (selectedIndicator !== indicatorKey) return null;
                                          return (
                                            <div key={indicatorKey} className="border border-gray-200 rounded-lg overflow-hidden">
                                              <div className="bg-gray-100 px-3 py-2">
                                                <h5 className="text-sm font-semibold text-gray-900">
                                                  {getIndicatorName(indicatorKey)}
                                                </h5>
                                              </div>
                                              <p className="text-gray-500 text-sm text-center py-4">
                                                Нет срабатываний за период
                                              </p>
                                            </div>
                                          );
                                        }
                                        if (indicatorTriggers.length === 0) return null;

                                        return (
                                          <div key={indicatorKey} className="border border-gray-200 rounded-lg overflow-hidden">
                                            <div className="bg-gray-100 px-3 py-2">
                                              <h5 className="text-sm font-semibold text-gray-900">
                                                {getIndicatorName(indicatorKey)}
                                              </h5>
                                            </div>
                                            <div className="space-y-2 p-3">
                                              {indicatorTriggers.map((trigger, tIdx) => (
                                                <div
                                                  key={tIdx}
                                                  className="flex justify-between items-start p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                                >
                                                  <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                      <Clock className="w-4 h-4 text-gray-400" />
                                                      <span className="text-sm font-medium text-gray-900">
                                                        {trigger.event_date} в {trigger.event_time}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                      <Building2 className="w-4 h-4 text-gray-400" />
                                                      <span className="text-xs text-gray-600">
                                                        {trigger.branch_name}
                                                      </span>
                                                    </div>
                                                  </div>
                                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    trigger.trigger_type === 'no_show'
                                                      ? 'bg-red-100 text-red-700'
                                                      : trigger.trigger_type === 'late'
                                                      ? 'bg-orange-100 text-orange-700'
                                                      : 'bg-yellow-100 text-yellow-700'
                                                  }`}>
                                                    {getIndicatorName(trigger.trigger_type)}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeSection === 'triggers' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Дата / Время
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Сотрудник
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Филиал
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Должность
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                  Тип
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTriggers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Нет срабатываний триггеров за этот период
                  </td>
                </tr>
              ) : (
                filteredTriggers.map(trigger => (
                  <tr key={trigger.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-gray-900 font-medium">{trigger.event_date}</div>
                      <div className="text-gray-500 text-sm">{trigger.event_time}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {trigger.employee_photo ? (
                          <img
                            src={trigger.employee_photo}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <Users className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{trigger.employee_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {trigger.branch_name}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {trigger.position_name}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                        trigger.trigger_type === 'no_show'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {trigger.trigger_type === 'no_show' ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        {getTriggerLabel(trigger.trigger_type)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{filteredResults.length}</div>
            <div className="text-sm text-gray-500">Сотрудников</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {filteredResults.filter(r => r.overall_kpi_percent >= 80).length}
            </div>
            <div className="text-sm text-gray-500">KPI 80%+</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600">
              {filteredResults.filter(r => r.overall_kpi_percent >= 50 && r.overall_kpi_percent < 80).length}
            </div>
            <div className="text-sm text-gray-500">KPI 50-79%</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {filteredResults.filter(r => r.overall_kpi_percent < 50).length}
            </div>
            <div className="text-sm text-gray-500">KPI &lt;50%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
