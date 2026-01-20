import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  MoreVertical,
  Copy,
  Trash2,
  X,
  Clock,
  User,
  Briefcase,
  Search,
  CopyPlus,
  ZoomIn,
  ZoomOut,
  Settings,
  Bell,
  MessageSquare,
  Timer,
  RefreshCw,
  Play,
  Stethoscope,
  LogOut
} from 'lucide-react';
import DeadlinesSettingsModal from '../../components/DeadlinesSettingsModal';
import NotificationDiagnostics from '../../components/NotificationDiagnostics';

interface WorkScheduleProps {
  partnerId: string;
}

interface DayColumn {
  date: string;
  weekday: number;
  weekIndex: number;
  isWeekend: boolean;
  dayOfMonth: number;
  monthName: string;
}

interface Branch {
  id: string;
  name: string;
}

interface BranchSettings {
  id: string;
  branch_id: string;
  min_staff_per_day: number;
  display_order: number;
}

interface Position {
  id: string;
  name: string;
  is_visible: boolean;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string | null;
  position_id: string | null;
  branch_id: string | null;
  current_status: 'working' | 'on_vacation' | 'pending_dismissal' | 'fired';
  dismissal_date: string | null;
  is_active: boolean;
  photo_url: string | null;
  position?: Position;
}

interface Shift {
  id: string;
  partner_id: string;
  branch_id: string;
  staff_member_id: string;
  position_id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_minutes: number;
  status?: 'scheduled' | 'opened' | 'closed';
  attendance_status?: 'scheduled' | 'opened' | 'closed' | 'late' | 'no_show' | null;
  actual_start_at?: string | null;
  actual_end_at?: string | null;
  late_minutes?: number;
  no_show_at?: string | null;
  no_show_reason_text?: string | null;
  no_show_reason_status?: 'pending' | 'approved' | 'rejected' | null;
  no_show_reason_selected_at?: string | null;
  no_show_approved_by?: string | null;
  no_show_approved_at?: string | null;
  no_show_rejected_by?: string | null;
  no_show_rejected_at?: string | null;
  no_show_notified_at?: string | null;
  reminder_before_sent_at?: string | null;
  reminder_late_sent_at?: string | null;
  is_replacement?: boolean;
  replacement_status?: 'none' | 'offered' | 'accepted' | null;
  is_published?: boolean;
  confirmation_status?: 'not_required' | 'pending' | 'confirmed' | 'declined' | 'late_decline_pending' | 'partially_confirmed' | null;
  confirmed_at?: string | null;
  declined_at?: string | null;
  decline_reason?: string | null;
  decline_is_late?: boolean;
  decided_by_responsible_id?: string | null;
  decided_at?: string | null;
  responsible_decision?: 'approved_cancel' | 'rejected_cancel' | null;
  early_leave_minutes?: number;
  early_leave_at?: string | null;
  early_leave_reset?: boolean;
}

interface ShiftConflict {
  branchName: string;
  startTime: string;
  endTime: string;
  freeFrom: string;
}

interface ReminderSettings {
  enabled: boolean;
  offsetMinutes: number;
  comment: string | null;
  closeReminderEnabled: boolean;
  autoCloseOffsetMinutes: number;
}

type ViewMode = 'week' | 'month';

function buildDaysRange(mode: ViewMode, anchorDate: Date): DayColumn[] {
  const days: DayColumn[] = [];
  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  if (mode === 'week') {
    const d = new Date(anchorDate);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? 1 : -(day - 1);
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);

    for (let i = 0; i < 7; i++) {
      const current = new Date(monday);
      current.setDate(monday.getDate() + i);
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const date = String(current.getDate()).padStart(2, '0');
      days.push({
        date: `${year}-${month}-${date}`,
        weekday: current.getDay(),
        weekIndex: 0,
        isWeekend: current.getDay() === 0 || current.getDay() === 6,
        dayOfMonth: current.getDate(),
        monthName: monthNames[current.getMonth()]
      });
    }
  } else {
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let weekIndex = 0;
    const current = new Date(firstDay);

    while (current <= lastDay) {
      const weekday = current.getDay();
      if (weekday === 1 && current.getDate() > 1) {
        weekIndex++;
      }

      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const date = String(current.getDate()).padStart(2, '0');

      days.push({
        date: `${year}-${month}-${date}`,
        weekday,
        weekIndex,
        isWeekend: weekday === 0 || weekday === 6,
        dayOfMonth: current.getDate(),
        monthName: monthNames[current.getMonth()]
      });

      current.setDate(current.getDate() + 1);
    }
  }

  return days;
}

function getWeekdayShort(weekday: number): string {
  const names = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return names[weekday];
}

function formatPeriodLabel(mode: ViewMode, anchorDate: Date): string {
  if (mode === 'week') {
    const days = buildDaysRange('week', anchorDate);
    const first = days[0];
    const last = days[days.length - 1];
    const formatDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}`;
    };
    const [year] = last.date.split('-').map(Number);
    return `${formatDate(first.date)}-${formatDate(last.date)}.${year}`;
  } else {
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    return `${monthNames[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
  }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0 && mins === 0) return '0ч';
  if (mins === 0) return `${hours}ч`;
  return `${hours}ч ${mins}м`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

function isSameWeek(date1: Date, date2: Date): boolean {
  const week1Start = getWeekStart(date1);
  const week2Start = getWeekStart(date2);
  return week1Start.getTime() === week2Start.getTime();
}

export default function WorkSchedule({ partnerId }: WorkScheduleProps) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchSettings, setBranchSettings] = useState<BranchSettings[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set());
  const [branchMenuOpen, setBranchMenuOpen] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState<string | null>(null);
  const [draggedBranchId, setDraggedBranchId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [activeCellPopup, setActiveCellPopup] = useState<{
    employeeId: string;
    branchId: string;
    positionId: string;
    date: string;
    shift?: Shift;
    rect: DOMRect;
  } | null>(null);
  const [employeeSelector, setEmployeeSelector] = useState<{
    branchId: string;
    callback: (employeeId: string, positionId: string) => void;
  } | null>(null);
  const [branchEmployees, setBranchEmployees] = useState<Record<string, { employeeId: string; positionId: string }[]>>({});
  const [currentPeriodId, setCurrentPeriodId] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
    enabled: false,
    offsetMinutes: 15,
    comment: null,
    closeReminderEnabled: false,
    autoCloseOffsetMinutes: 30
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [showCommentField, setShowCommentField] = useState(false);
  const [showDeadlinesModal, setShowDeadlinesModal] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [noShowThresholdMinutes, setNoShowThresholdMinutes] = useState(30);
  const [planningHorizonDays, setPlanningHorizonDays] = useState(14);
  const [timezone, setTimezone] = useState('Europe/Kiev');
  const branchScrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const calendarButtonRef = useRef<HTMLButtonElement>(null);

  const daysRange = useMemo(() => buildDaysRange(viewMode, anchorDate), [viewMode, anchorDate]);

  const dateRangeStart = daysRange[0]?.date;
  const dateRangeEnd = daysRange[daysRange.length - 1]?.date;

  useEffect(() => {
    const loadPlanningHorizonFirst = async () => {
      const { data } = await supabase
        .from('partner_settings')
        .select('planning_horizon_days')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (data?.planning_horizon_days !== undefined) {
        setPlanningHorizonDays(data.planning_horizon_days);
      }
    };

    loadPlanningHorizonFirst();
    loadInitialData();
  }, [partnerId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadPlanningHorizon();
      }
    };

    const loadPlanningHorizon = async () => {
      const { data } = await supabase
        .from('partner_settings')
        .select('planning_horizon_days')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (data?.planning_horizon_days !== undefined) {
        setPlanningHorizonDays(data.planning_horizon_days);
      }
    };

    loadPlanningHorizon();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [partnerId]);

  useEffect(() => {
    if (dateRangeStart && dateRangeEnd) {
      ensurePeriodExists();
      loadShifts();
    }
  }, [partnerId, dateRangeStart, dateRangeEnd, viewMode, timezone, planningHorizonDays]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (branchMenuOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('.branch-menu-button') && !target.closest('.branch-menu-dropdown')) {
          setBranchMenuOpen(null);
        }
      }
    };

    if (branchMenuOpen) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [branchMenuOpen]);

  useEffect(() => {
    const checkMidnight = () => {
      const now = new Date();
      const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).getTime() - now.getTime();

      const timeoutId = setTimeout(() => {
        loadShifts();
        checkMidnight();
      }, msUntilMidnight + 1000);

      return timeoutId;
    };

    const timeoutId = checkMidnight();
    return () => clearTimeout(timeoutId);
  }, [dateRangeStart, dateRangeEnd, timezone, planningHorizonDays]);

  useEffect(() => {
    const channel = supabase
      .channel('partner_settings_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'partner_settings',
          filter: `partner_id=eq.${partnerId}`
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData.planning_horizon_days !== undefined) {
            setPlanningHorizonDays(newData.planning_horizon_days);
          }
          if (newData.no_show_threshold_minutes !== undefined) {
            setNoShowThresholdMinutes(newData.no_show_threshold_minutes);
          }
          if (newData.shift_reminders_enabled !== undefined || newData.shift_reminder_offset_minutes !== undefined) {
            setReminderSettings(prev => ({
              ...prev,
              enabled: newData.shift_reminders_enabled ?? prev.enabled,
              offsetMinutes: newData.shift_reminder_offset_minutes ?? prev.offsetMinutes,
              comment: newData.shift_reminder_comment ?? prev.comment,
              closeReminderEnabled: newData.shift_close_reminder_enabled ?? prev.closeReminderEnabled,
              autoCloseOffsetMinutes: newData.shift_auto_close_offset_minutes ?? prev.autoCloseOffsetMinutes
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [partnerId]);

  const ensurePeriodExists = async () => {
    if (!dateRangeStart || !dateRangeEnd) return;

    try {
      const { data: existingPeriod } = await supabase
        .from('schedule_periods')
        .select('id')
        .eq('partner_id', partnerId)
        .eq('type', viewMode)
        .eq('date_start', dateRangeStart)
        .eq('date_end', dateRangeEnd)
        .maybeSingle();

      if (existingPeriod) {
        setCurrentPeriodId(existingPeriod.id);
        return;
      }

      const periodName = formatPeriodLabel(viewMode, anchorDate);
      const { data: newPeriod, error } = await supabase
        .from('schedule_periods')
        .insert({
          partner_id: partnerId,
          type: viewMode,
          date_start: dateRangeStart,
          date_end: dateRangeEnd,
          name: periodName
        })
        .select('id')
        .single();

      if (error) throw error;
      if (newPeriod) {
        setCurrentPeriodId(newPeriod.id);
      }
    } catch (error) {
      console.error('Error ensuring period exists:', error);
    }
  };

  const deleteNoShowNotifications = async (shiftId: string) => {
    try {
      const { data: settings, error: settingsError } = await supabase
        .from('partner_settings')
        .select('employee_bot_token')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (settingsError || !settings?.employee_bot_token) {
        console.error('Error fetching bot token:', settingsError);
        return;
      }

      const botToken = settings.employee_bot_token;

      const { data: events, error: eventsError } = await supabase
        .from('employee_events')
        .select('id, telegram_chat_id, telegram_message_id')
        .eq('related_shift_id', shiftId)
        .in('event_type', ['no_show', 'urgent_shift']);

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
        return;
      }

      if (events && events.length > 0) {
        const deleteMessagePromises = events
          .filter(event => event.telegram_chat_id && event.telegram_message_id)
          .map(event =>
            supabase.functions.invoke('delete-telegram-message', {
              body: {
                bot_token: botToken,
                chat_id: event.telegram_chat_id,
                message_id: event.telegram_message_id
              }
            })
          );

        await Promise.allSettled(deleteMessagePromises);

        const { error: deleteError } = await supabase
          .from('employee_events')
          .delete()
          .eq('related_shift_id', shiftId)
          .in('event_type', ['no_show', 'urgent_shift']);

        if (deleteError) {
          console.error('Error deleting events:', deleteError);
        }
      }
    } catch (error) {
      console.error('Error in deleteNoShowNotifications:', error);
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [branchesRes, settingsRes, positionsRes, employeesRes, partnerSettingsRes] = await Promise.all([
        supabase
          .from('branches')
          .select('id, name')
          .eq('partner_id', partnerId)
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('branch_schedule_settings')
          .select('*')
          .eq('partner_id', partnerId),
        supabase
          .from('positions')
          .select('id, name, is_visible')
          .eq('partner_id', partnerId)
          .eq('is_visible', true)
          .order('name'),
        supabase
          .from('employees')
          .select('id, first_name, last_name, position_id, branch_id, current_status, dismissal_date, is_active, photo_url, position:positions(id, name, is_visible)')
          .eq('partner_id', partnerId)
          .eq('is_active', true)
          .in('current_status', ['working', 'on_vacation', 'pending_dismissal'])
          .order('first_name'),
        supabase
          .from('partner_settings')
          .select('shift_reminders_enabled, shift_reminder_offset_minutes, shift_reminder_comment, shift_close_reminder_enabled, shift_auto_close_offset_minutes, no_show_threshold_minutes, planning_horizon_days, timezone')
          .eq('partner_id', partnerId)
          .maybeSingle()
      ]);

      if (branchesRes.data) setBranches(branchesRes.data);
      if (settingsRes.data) setBranchSettings(settingsRes.data);
      if (positionsRes.data) setPositions(positionsRes.data);
      if (employeesRes.data) setEmployees(employeesRes.data as Employee[]);
      if (partnerSettingsRes.data) {
        setReminderSettings({
          enabled: partnerSettingsRes.data.shift_reminders_enabled || false,
          offsetMinutes: partnerSettingsRes.data.shift_reminder_offset_minutes || 15,
          comment: partnerSettingsRes.data.shift_reminder_comment || null,
          closeReminderEnabled: partnerSettingsRes.data.shift_close_reminder_enabled || false,
          autoCloseOffsetMinutes: partnerSettingsRes.data.shift_auto_close_offset_minutes || 30
        });
        setShowCommentField(!!partnerSettingsRes.data.shift_reminder_comment);
        setNoShowThresholdMinutes(partnerSettingsRes.data.no_show_threshold_minutes || 30);
        setPlanningHorizonDays(partnerSettingsRes.data.planning_horizon_days || 14);
        setTimezone(partnerSettingsRes.data.timezone || 'Europe/Kiev');
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadShifts = async () => {
    if (!dateRangeStart || !dateRangeEnd) return;

    const now = new Date();
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    tzDate.setHours(0, 0, 0, 0);
    const todayStr = `${tzDate.getFullYear()}-${String(tzDate.getMonth() + 1).padStart(2, '0')}-${String(tzDate.getDate()).padStart(2, '0')}`;

    const horizonEndDate = new Date(tzDate);
    horizonEndDate.setDate(horizonEndDate.getDate() + planningHorizonDays);
    const horizonEndStr = `${horizonEndDate.getFullYear()}-${String(horizonEndDate.getMonth() + 1).padStart(2, '0')}-${String(horizonEndDate.getDate()).padStart(2, '0')}`;

    const effectiveStart = dateRangeStart < todayStr ? dateRangeStart : todayStr;
    const effectiveEnd = dateRangeEnd > horizonEndStr ? dateRangeEnd : horizonEndStr;

    try {
      const { data, error } = await supabase
        .from('schedule_shifts')
        .select('id, partner_id, branch_id, staff_member_id, position_id, date, start_time, end_time, total_minutes, status, attendance_status, actual_start_at, actual_end_at, late_minutes, no_show_at, no_show_reason_text, no_show_reason_status, no_show_reason_selected_at, no_show_approved_by, no_show_approved_at, no_show_rejected_by, no_show_rejected_at, no_show_notified_at, reminder_before_sent_at, reminder_late_sent_at, is_replacement, replacement_status, is_published, confirmation_status, confirmed_at, declined_at, decline_reason, decline_is_late, decided_by_responsible_id, decided_at, responsible_decision, early_leave_minutes, early_leave_at, early_leave_reset')
        .eq('partner_id', partnerId)
        .gte('date', effectiveStart)
        .lte('date', effectiveEnd);

      if (error) throw error;

      setShifts(data || []);

      const empByBranch: Record<string, { employeeId: string; positionId: string }[]> = {};
      (data || []).forEach(shift => {
        if (!shift.staff_member_id) return;
        if (!empByBranch[shift.branch_id]) {
          empByBranch[shift.branch_id] = [];
        }
        const exists = empByBranch[shift.branch_id].some(e => e.employeeId === shift.staff_member_id);
        if (!exists) {
          empByBranch[shift.branch_id].push({
            employeeId: shift.staff_member_id,
            positionId: shift.position_id
          });
        }
      });
      setBranchEmployees(empByBranch);
    } catch (error) {
      console.error('Error loading shifts:', error);
    }
  };

  const saveReminderSettings = async () => {
    setSettingsLoading(true);
    try {
      const { error } = await supabase
        .from('partner_settings')
        .update({
          shift_reminders_enabled: reminderSettings.enabled,
          shift_reminder_offset_minutes: reminderSettings.offsetMinutes,
          shift_reminder_comment: showCommentField ? reminderSettings.comment : null,
          shift_close_reminder_enabled: reminderSettings.closeReminderEnabled,
          shift_auto_close_offset_minutes: reminderSettings.autoCloseOffsetMinutes
        })
        .eq('partner_id', partnerId);

      if (error) throw error;
      setShowSettingsModal(false);
    } catch (error) {
      console.error('Error saving reminder settings:', error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const formatOffsetTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const parseOffsetTime = (timeStr: string): number => {
    const [hours, mins] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (mins || 0);
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(anchorDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
    }
    setAnchorDate(newDate);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const handleDateSelect = (date: Date) => {
    setAnchorDate(date);
    setShowCalendar(false);
  };

  const getOrderedBranches = useMemo(() => {
    return [...branches].sort((a, b) => {
      const settingA = branchSettings.find(s => s.branch_id === a.id);
      const settingB = branchSettings.find(s => s.branch_id === b.id);
      const orderA = settingA?.display_order ?? 999;
      const orderB = settingB?.display_order ?? 999;
      return orderA - orderB;
    });
  }, [branches, branchSettings]);

  const getBranchEmployeeRows = useCallback((branchId: string) => {
    return branchEmployees[branchId] || [];
  }, [branchEmployees]);

  const getShiftForCell = useCallback((employeeId: string, branchId: string, date: string) => {
    return shifts.find(s =>
      s.staff_member_id === employeeId &&
      s.branch_id === branchId &&
      s.date === date
    );
  }, [shifts]);

  const getEmployeeShiftsOnDate = useCallback((employeeId: string, date: string, excludeBranchId?: string) => {
    return shifts.filter(s =>
      s.staff_member_id === employeeId &&
      s.date === date &&
      (excludeBranchId ? s.branch_id !== excludeBranchId : true)
    );
  }, [shifts]);

  const checkShiftConflict = useCallback((employeeId: string, date: string, startTime: string, endTime: string, excludeBranchId: string): ShiftConflict | null => {
    const otherShifts = getEmployeeShiftsOnDate(employeeId, date, excludeBranchId);
    if (otherShifts.length === 0) return null;

    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);

    for (const shift of otherShifts) {
      const existingStart = timeToMinutes(shift.start_time.slice(0, 5));
      const existingEnd = timeToMinutes(shift.end_time.slice(0, 5));

      const hasOverlap = !(newEnd <= existingStart || newStart >= existingEnd);

      if (hasOverlap) {
        const branch = branches.find(b => b.id === shift.branch_id);
        return {
          branchName: branch?.name || 'Другой филиал',
          startTime: shift.start_time.slice(0, 5),
          endTime: shift.end_time.slice(0, 5),
          freeFrom: shift.end_time.slice(0, 5)
        };
      }
    }

    return null;
  }, [getEmployeeShiftsOnDate, branches]);

  const calculateEmployeeTotalMinutes = useCallback((employeeId: string, branchId: string) => {
    return shifts
      .filter(s => s.staff_member_id === employeeId && s.branch_id === branchId)
      .reduce((sum, s) => sum + s.total_minutes, 0);
  }, [shifts]);

  const calculateBranchDayMinutes = useCallback((branchId: string, date: string) => {
    return shifts
      .filter(s => s.branch_id === branchId && s.date === date)
      .reduce((sum, s) => sum + s.total_minutes, 0);
  }, [shifts]);

  const calculateBranchTotalMinutes = useCallback((branchId: string) => {
    return shifts
      .filter(s => s.branch_id === branchId)
      .reduce((sum, s) => sum + s.total_minutes, 0);
  }, [shifts]);

  const checkBranchProblems = useCallback((branchId: string) => {
    const setting = branchSettings.find(s => s.branch_id === branchId);
    const minStaff = setting?.min_staff_per_day || 1;
    const problemDays: string[] = [];

    for (const day of daysRange) {
      const dayShiftsCount = shifts.filter(
        s => s.branch_id === branchId && s.date === day.date
      ).length;

      if (dayShiftsCount < minStaff) {
        problemDays.push(day.date);
      }
    }

    return problemDays;
  }, [daysRange, branchSettings, shifts]);

  const getTodayInTimezone = useCallback((): Date => {
    const now = new Date();
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    tzDate.setHours(0, 0, 0, 0);
    return tzDate;
  }, [timezone]);

  const formatDateToYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const checkHorizonCoverage = useCallback((branchId: string) => {
    const today = getTodayInTimezone();

    const requiredDate = new Date(today);
    requiredDate.setDate(requiredDate.getDate() + planningHorizonDays);

    const setting = branchSettings.find(s => s.branch_id === branchId);
    const minStaff = setting?.min_staff_per_day || 1;

    const requiredDateStr = formatDateToYYYYMMDD(requiredDate);

    const unfilledDays: string[] = [];
    const currentDate = new Date(today);

    while (currentDate <= requiredDate) {
      const dateStr = formatDateToYYYYMMDD(currentDate);
      const dayShifts = shifts.filter(
        s => s.branch_id === branchId && s.date === dateStr && s.staff_member_id
      );

      if (dayShifts.length < minStaff) {
        unfilledDays.push(dateStr);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      isCovered: unfilledDays.length === 0,
      requiredDate: requiredDateStr,
      unfilledDays
    };
  }, [planningHorizonDays, branchSettings, shifts, getTodayInTimezone]);

  const getAvailableEmployees = useCallback((forDate?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const checkDate = forDate || today;

    return employees.filter(emp => {
      if (emp.current_status === 'fired') return false;
      if (!emp.is_active) return false;
      if (emp.dismissal_date && checkDate >= emp.dismissal_date) return false;
      if (emp.position_id) {
        const position = positions.find(p => p.id === emp.position_id);
        if (position && !position.is_visible) return false;
      }
      return true;
    });
  }, [employees, positions]);

  const isEmployeeInBranch = useCallback((branchId: string, employeeId: string) => {
    return (branchEmployees[branchId] || []).some(e => e.employeeId === employeeId);
  }, [branchEmployees]);

  const addEmployeeToBranch = useCallback((branchId: string, employeeId: string, positionId: string) => {
    setBranchEmployees(prev => {
      const current = prev[branchId] || [];
      if (current.some(e => e.employeeId === employeeId)) return prev;
      return {
        ...prev,
        [branchId]: [...current, { employeeId, positionId }]
      };
    });
  }, []);

  const removeEmployeeFromBranch = useCallback(async (branchId: string, employeeId: string) => {
    if (!employeeId) return;

    try {
      await supabase
        .from('schedule_shifts')
        .delete()
        .eq('partner_id', partnerId)
        .eq('branch_id', branchId)
        .eq('staff_member_id', employeeId)
        .gte('date', dateRangeStart)
        .lte('date', dateRangeEnd);

      setBranchEmployees(prev => ({
        ...prev,
        [branchId]: (prev[branchId] || []).filter(e => e.employeeId !== employeeId)
      }));

      setShifts(prev => prev.filter(s =>
        !(s.branch_id === branchId && s.staff_member_id === employeeId)
      ));
    } catch (error) {
      console.error('Error removing employee:', error);
    }
  }, [partnerId, dateRangeStart, dateRangeEnd]);

  const saveShift = async (
    employeeId: string,
    branchId: string,
    positionId: string,
    date: string,
    startTime: string,
    endTime: string
  ) => {
    if (!currentPeriodId) {
      alert('Ошибка: период графика не инициализирован. Попробуйте перезагрузить страницу.');
      return false;
    }

    const employee = employees.find(e => e.id === employeeId);
    if (employee?.dismissal_date && date >= employee.dismissal_date) {
      alert('Невозможно назначить смену: сотрудник уволен или будет уволен на эту дату');
      return false;
    }

    const conflict = checkShiftConflict(employeeId, date, startTime, endTime, branchId);
    if (conflict) {
      alert(`Конфликт смен!\n\nСотрудник уже работает в "${conflict.branchName}"\nс ${conflict.startTime} до ${conflict.endTime}.\n\nСвободен с ${conflict.freeFrom}`);
      return false;
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const totalMinutes = endMinutes >= startMinutes
      ? endMinutes - startMinutes
      : (24 * 60 - startMinutes) + endMinutes;

    const existingShift = getShiftForCell(employeeId, branchId, date);

    try {
      if (existingShift) {
        const timeChanged = existingShift.start_time?.slice(0, 5) !== startTime ||
                           existingShift.end_time?.slice(0, 5) !== endTime;

        const now = new Date();
        const shiftDateTime = new Date(`${date}T${startTime}:00`);
        const shiftNotStartedYet = shiftDateTime > now;

        const updateData: Record<string, unknown> = {
          start_time: startTime,
          end_time: endTime,
          total_minutes: totalMinutes
        };

        if (timeChanged && shiftNotStartedYet) {
          if (existingShift.status === 'scheduled' && !existingShift.actual_start_at) {
            const wasNoShow = existingShift.attendance_status === 'no_show';

            updateData.attendance_status = null;
            updateData.no_show_at = null;
            updateData.late_minutes = 0;
            updateData.reminder_before_sent_at = null;
            updateData.reminder_late_sent_at = null;

            if (wasNoShow) {
              await deleteNoShowNotifications(existingShift.id);
            }
          }
        }

        const { error } = await supabase
          .from('schedule_shifts')
          .update(updateData)
          .eq('id', existingShift.id);

        if (error) throw error;

        setShifts(prev => prev.map(s =>
          s.id === existingShift.id
            ? { ...s, ...updateData }
            : s
        ));
      } else {
        const { data, error } = await supabase
          .from('schedule_shifts')
          .insert({
            partner_id: partnerId,
            period_id: currentPeriodId,
            branch_id: branchId,
            staff_member_id: employeeId,
            position_id: positionId,
            date,
            start_time: startTime,
            end_time: endTime,
            total_minutes: totalMinutes,
            confirmation_status: 'pending'
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setShifts(prev => [...prev, data]);

          const empInBranch = isEmployeeInBranch(branchId, employeeId);
          if (!empInBranch) {
            addEmployeeToBranch(branchId, employeeId, positionId);
          }
        }
      }

      await loadShifts();
      return true;
    } catch (error: unknown) {
      console.error('Error saving shift:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('idx_unique_shift_per_employee_branch_date') ||
          errorMessage.includes('duplicate key') ||
          errorMessage.includes('unique constraint')) {
        alert('Смена на эту дату уже существует. Попробуйте изменить существующую смену.');
      } else {
        alert('Ошибка при сохранении смены. Попробуйте ещё раз.');
      }
      await loadShifts();
      return false;
    }
  };

  const clearShift = async (employeeId: string, branchId: string, date: string) => {
    const existingShift = getShiftForCell(employeeId, branchId, date);
    if (!existingShift) return;

    try {
      if (existingShift.status === 'opened') {
        const now = new Date().toISOString();

        const { error: segmentError } = await supabase
          .from('work_segments')
          .update({ segment_end_at: now })
          .eq('shift_id', existingShift.id)
          .is('segment_end_at', null);

        if (segmentError) {
          console.error('Error closing work segments:', segmentError);
        }
      }

      const { error } = await supabase
        .from('schedule_shifts')
        .delete()
        .eq('id', existingShift.id);

      if (error) throw error;

      setShifts(prev => prev.filter(s => s.id !== existingShift.id));

      await loadShifts();
    } catch (error) {
      console.error('Error clearing shift:', error);
    }
  };

  const copyFromPreviousPeriod = async (branchId: string) => {
    console.log('copyFromPreviousPeriod called for branch:', branchId);
    setBranchMenuOpen(null);

    if (!currentPeriodId) {
      alert('Ошибка: период графика не инициализирован. Попробуйте перезагрузить страницу.');
      return;
    }

    let prevStart: Date;
    let prevEnd: Date;

    if (viewMode === 'week') {
      prevStart = new Date(anchorDate);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevDays = buildDaysRange('week', prevStart);
      prevEnd = new Date(prevDays[prevDays.length - 1].date);
    } else {
      prevStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 1, 1);
      prevEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 0);
    }

    try {
      const { data: prevShifts } = await supabase
        .from('schedule_shifts')
        .select('*')
        .eq('partner_id', partnerId)
        .eq('branch_id', branchId)
        .gte('date', prevStart.toISOString().split('T')[0])
        .lte('date', prevEnd.toISOString().split('T')[0]);

      if (!prevShifts || prevShifts.length === 0) {
        alert('В предыдущем периоде нет данных для этого филиала');
        return;
      }

      const dayOffset = viewMode === 'week' ? 7 : 0;
      const newShifts = [];

      for (const shift of prevShifts) {
        let newDate: string;
        if (viewMode === 'week') {
          const oldDate = new Date(shift.date);
          oldDate.setDate(oldDate.getDate() + dayOffset);
          newDate = oldDate.toISOString().split('T')[0];
        } else {
          const oldDate = new Date(shift.date);
          const newMonth = anchorDate.getMonth();
          const newYear = anchorDate.getFullYear();
          const maxDay = new Date(newYear, newMonth + 1, 0).getDate();
          const day = Math.min(oldDate.getDate(), maxDay);
          newDate = new Date(newYear, newMonth, day).toISOString().split('T')[0];
        }

        if (newDate >= dateRangeStart && newDate <= dateRangeEnd) {
          const existing = shifts.find(s =>
            s.branch_id === branchId &&
            s.staff_member_id === shift.staff_member_id &&
            s.date === newDate
          );

          if (!existing) {
            newShifts.push({
              partner_id: partnerId,
              period_id: currentPeriodId,
              branch_id: branchId,
              staff_member_id: shift.staff_member_id,
              position_id: shift.position_id,
              date: newDate,
              start_time: shift.start_time,
              end_time: shift.end_time,
              total_minutes: shift.total_minutes,
              confirmation_status: 'pending'
            });
          }
        }
      }

      if (newShifts.length > 0) {
        const { error } = await supabase
          .from('schedule_shifts')
          .insert(newShifts);

        if (error) throw error;

        await loadShifts();

        const periodName = viewMode === 'week' ? 'недели' : 'месяца';
        const uniqueEmployees = new Set(newShifts.map(s => s.staff_member_id)).size;
        alert(`Успешно скопировано ${newShifts.length} смен для ${uniqueEmployees} сотрудников из предыдущего ${periodName}`);
      } else {
        alert('Все смены из предыдущего периода уже существуют в текущем периоде');
      }
    } catch (error) {
      console.error('Error copying from previous period:', error);
      alert('Ошибка при копировании');
    }
  };

  const clearBranchSchedule = async (branchId: string) => {
    try {
      await supabase
        .from('schedule_shifts')
        .delete()
        .eq('partner_id', partnerId)
        .eq('branch_id', branchId)
        .gte('date', dateRangeStart)
        .lte('date', dateRangeEnd);

      setShifts(prev => prev.filter(s => s.branch_id !== branchId));
      setBranchEmployees(prev => ({ ...prev, [branchId]: [] }));
      setShowConfirmClear(null);
      setBranchMenuOpen(null);
    } catch (error) {
      console.error('Error clearing schedule:', error);
    }
  };

  const toggleBranchCollapse = (branchId: string) => {
    setCollapsedBranches(prev => {
      const next = new Set(prev);
      if (next.has(branchId)) {
        next.delete(branchId);
      } else {
        next.add(branchId);
      }
      return next;
    });
  };

  const handleDragStart = (branchId: string) => {
    setDraggedBranchId(branchId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetBranchId: string) => {
    if (!draggedBranchId || draggedBranchId === targetBranchId) {
      setDraggedBranchId(null);
      return;
    }

    const orderedIds = getOrderedBranches.map(b => b.id);
    const dragIndex = orderedIds.indexOf(draggedBranchId);
    const dropIndex = orderedIds.indexOf(targetBranchId);

    orderedIds.splice(dragIndex, 1);
    orderedIds.splice(dropIndex, 0, draggedBranchId);

    const updates = orderedIds.map((id, index) => ({
      partner_id: partnerId,
      branch_id: id,
      display_order: index,
      min_staff_per_day: branchSettings.find(s => s.branch_id === id)?.min_staff_per_day || 1
    }));

    try {
      for (const update of updates) {
        await supabase
          .from('branch_schedule_settings')
          .upsert(update, { onConflict: 'partner_id,branch_id' });
      }

      setBranchSettings(prev => {
        const newSettings = [...prev];
        for (const update of updates) {
          const idx = newSettings.findIndex(s => s.branch_id === update.branch_id);
          if (idx >= 0) {
            newSettings[idx] = { ...newSettings[idx], display_order: update.display_order };
          } else {
            newSettings.push({
              id: crypto.randomUUID(),
              branch_id: update.branch_id,
              min_staff_per_day: update.min_staff_per_day,
              display_order: update.display_order
            });
          }
        }
        return newSettings;
      });
    } catch (error) {
      console.error('Error updating branch order:', error);
    }

    setDraggedBranchId(null);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>, sourceBranchId: string) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    branchScrollRefs.current.forEach((ref, branchId) => {
      if (branchId !== sourceBranchId && ref) {
        ref.scrollLeft = scrollLeft;
      }
    });
  };

  const horizonCoverageByBranch = useMemo(() => {
    const coverage: Record<string, { isCovered: boolean; requiredDate: string; unfilledDays: string[] }> = {};
    branches.forEach(branch => {
      const result = checkHorizonCoverage(branch.id);
      coverage[branch.id] = result;
    });
    return coverage;
  }, [branches, checkHorizonCoverage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-3 md:p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleViewModeChange('week')}
              className={`px-3 md:px-4 py-2 rounded-xl font-medium transition-all text-sm md:text-base ${
                viewMode === 'week'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Неделя
            </button>
            <button
              onClick={() => handleViewModeChange('month')}
              className={`px-3 md:px-4 py-2 rounded-xl font-medium transition-all text-sm md:text-base ${
                viewMode === 'month'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Месяц
            </button>

            <div className="flex items-center gap-1 ml-2 border-l border-gray-300 pl-2">
              <button
                onClick={() => setScale(prev => Math.max(0.4, prev - 0.1))}
                disabled={scale <= 0.4}
                className={`p-2 rounded-xl transition-colors ${
                  scale <= 0.4
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Уменьшить масштаб"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-xs font-medium text-gray-600 min-w-[3rem] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale(prev => Math.min(1.5, prev + 0.1))}
                disabled={scale >= 1.5}
                className={`p-2 rounded-xl transition-colors ${
                  scale >= 1.5
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Увеличить масштаб"
              >
                <ZoomIn className="w-5 h-5" />
              </button>

              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-2 rounded-xl transition-colors text-gray-600 hover:bg-gray-100 relative"
                title="Оповещения о сменах"
              >
                <Bell className="w-5 h-5" />
                {reminderSettings.enabled && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full" />
                )}
              </button>

              <button
                onClick={() => setShowDeadlinesModal(true)}
                className="p-2 rounded-xl transition-colors text-gray-600 hover:bg-gray-100 relative"
                title="Дедлайны"
              >
                <Timer className="w-5 h-5" />
                {noShowThresholdMinutes > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>

              <button
                onClick={() => setShowDiagnostics(true)}
                className="p-2 rounded-xl transition-colors text-purple-600 hover:bg-purple-50"
                title="Диагностика уведомлений"
              >
                <Stethoscope className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-center md:justify-end">
            <button
              onClick={() => navigatePeriod('prev')}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>

            <div className="relative flex-1 md:flex-none">
              <button
                ref={calendarButtonRef}
                onClick={() => setShowCalendar(!showCalendar)}
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors w-full md:min-w-[220px] justify-between text-sm md:text-base"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-gray-800">
                    {formatPeriodLabel(viewMode, anchorDate)}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>

              {showCalendar && (
                <CalendarPicker
                  anchorDate={anchorDate}
                  viewMode={viewMode}
                  onSelect={handleDateSelect}
                  onClose={() => setShowCalendar(false)}
                  buttonRef={calendarButtonRef}
                />
              )}
            </div>

            <button
              onClick={() => navigatePeriod('next')}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {getOrderedBranches.map(branch => {
          const problems = checkBranchProblems(branch.id);
          const hasProblems = problems.length > 0;
          const horizonCoverage = horizonCoverageByBranch[branch.id] || { isCovered: true, requiredDate: '', unfilledDays: [] };
          const isCollapsed = collapsedBranches.has(branch.id);
          const employeeRows = getBranchEmployeeRows(branch.id);
          const totalMinutes = calculateBranchTotalMinutes(branch.id);

          return (
            <div
              key={branch.id}
              draggable
              onDragStart={() => handleDragStart(branch.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(branch.id)}
              className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border transition-all ${
                hasProblems ? 'border-amber-300' : 'border-gray-200/50'
              } ${draggedBranchId === branch.id ? 'opacity-50' : ''}`}
            >
              <div className={`flex flex-col md:flex-row items-start md:items-center justify-between px-3 md:px-4 py-2 md:py-3 border-b ${
                hasProblems ? 'border-amber-200 bg-amber-50/50' : 'border-gray-100'
              }`}>
                <div className="flex items-center gap-2 md:gap-3 flex-wrap w-full md:w-auto">
                  <div className="cursor-grab p-1 hover:bg-gray-100 rounded hidden md:block">
                    <GripVertical className="w-5 h-5 text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm md:text-base">{branch.name}</h3>
                  {hasProblems ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 md:py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
                      <AlertTriangle className="w-3 md:w-3.5 h-3 md:h-3.5" />
                      <span className="hidden md:inline">Требует внимания ({problems.length} дн.)</span>
                      <span className="md:hidden">{problems.length} дн.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-0.5 md:py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      <Check className="w-3 md:w-3.5 h-3 md:h-3.5" />
                      <span>OK</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 px-2 py-0.5 md:py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                    <Clock className="w-3 md:w-3.5 h-3 md:h-3.5" />
                    <span className="hidden sm:inline">Итого: {formatMinutesToHours(totalMinutes)}</span>
                    <span className="sm:hidden">{formatMinutesToHours(totalMinutes)}</span>
                  </div>
                </div>

                {!horizonCoverage.isCovered && (
                  <div className="w-full md:w-auto mt-2 md:mt-0 md:ml-3">
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <div>
                          <div className="font-semibold text-amber-900 text-sm">
                            Горизонт планирования НЕ покрыт
                          </div>
                          <div className="text-amber-700 text-xs mt-1">
                            Требуемая дата: {new Date(horizonCoverage.requiredDate).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-amber-600 text-xs mt-0.5">
                            Часовой пояс: {timezone}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-2 md:mt-0">
                  <button
                    onClick={() => toggleBranchCollapse(branch.id)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="p-3 md:p-4">
                  <ScheduleTable
                    branchId={branch.id}
                    daysRange={daysRange}
                    viewMode={viewMode}
                    employeeRows={employeeRows}
                    employees={employees}
                    problemDays={problems}
                    unfilledHorizonDays={horizonCoverage.unfilledDays}
                    shifts={shifts}
                    scale={scale}
                    onCellClick={(employeeId, positionId, date, rect, shift) => {
                      setActiveCellPopup({ employeeId, branchId: branch.id, positionId, date, shift, rect });
                    }}
                    onRemoveEmployee={(employeeId) => removeEmployeeFromBranch(branch.id, employeeId)}
                    calculateEmployeeTotalMinutes={(empId) => calculateEmployeeTotalMinutes(empId, branch.id)}
                    calculateBranchDayMinutes={(date) => calculateBranchDayMinutes(branch.id, date)}
                    getShiftForCell={(empId, date) => getShiftForCell(empId, branch.id, date)}
                    scrollRef={(ref) => {
                      if (ref) branchScrollRefs.current.set(branch.id, ref);
                    }}
                    onScroll={(e) => handleScroll(e, branch.id)}
                  />

                  <button
                    onClick={() => setEmployeeSelector({
                      branchId: branch.id,
                      callback: (employeeId, positionId) => {
                        addEmployeeToBranch(branch.id, employeeId, positionId);
                        setEmployeeSelector(null);
                      }
                    })}
                    className="mt-3 md:mt-4 flex items-center justify-center md:justify-start gap-2 px-3 md:px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors font-medium text-sm md:text-base w-full md:w-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Добавить сотрудника</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showConfirmClear && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Подтверждение</h3>
            <p className="text-gray-600 mb-6">
              Вы уверены, что хотите очистить график для этого филиала за текущий период?
              Это действие нельзя отменить.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmClear(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
              >
                Отмена
              </button>
              <button
                onClick={() => clearBranchSchedule(showConfirmClear)}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-xl transition-colors font-medium"
              >
                Очистить
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCellPopup && (
        <ShiftCellPopup
          employeeId={activeCellPopup.employeeId}
          branchId={activeCellPopup.branchId}
          date={activeCellPopup.date}
          shift={activeCellPopup.shift}
          rect={activeCellPopup.rect}
          employees={employees}
          partnerId={partnerId}
          currentUserId={user && 'staff_member_id' in user ? user.staff_member_id : undefined}
          checkConflict={(startTime, endTime) =>
            checkShiftConflict(activeCellPopup.employeeId, activeCellPopup.date, startTime, endTime, activeCellPopup.branchId)
          }
          onSave={async (startTime, endTime) => {
            const success = await saveShift(
              activeCellPopup.employeeId,
              activeCellPopup.branchId,
              activeCellPopup.positionId,
              activeCellPopup.date,
              startTime,
              endTime
            );
            if (success) setActiveCellPopup(null);
          }}
          onClear={() => {
            clearShift(activeCellPopup.employeeId, activeCellPopup.branchId, activeCellPopup.date);
            setActiveCellPopup(null);
          }}
          onClose={() => setActiveCellPopup(null)}
          onDuplicateToNextDay={async (startTime, endTime) => {
            const currentDate = new Date(activeCellPopup.date);
            const nextDate = new Date(currentDate);
            nextDate.setDate(currentDate.getDate() + 1);
            const nextDateStr = nextDate.toISOString().split('T')[0];

            const success = await saveShift(
              activeCellPopup.employeeId,
              activeCellPopup.branchId,
              activeCellPopup.positionId,
              activeCellPopup.date,
              startTime,
              endTime
            );

            if (success) {
              const nextDaySuccess = await saveShift(
                activeCellPopup.employeeId,
                activeCellPopup.branchId,
                activeCellPopup.positionId,
                nextDateStr,
                startTime,
                endTime
              );

              if (nextDaySuccess) {
                setActiveCellPopup(null);
              }
            }
          }}
        />
      )}

      {employeeSelector && (
        <EmployeeSelectorModal
          employees={getAvailableEmployees()}
          positions={positions}
          isEmployeeInBranch={(empId) => isEmployeeInBranch(employeeSelector.branchId, empId)}
          onSelect={employeeSelector.callback}
          onClose={() => setEmployeeSelector(null)}
        />
      )}

      {branchMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setBranchMenuOpen(null)} />
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Настройки графика</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-blue-600" />
                  <h4 className="font-medium text-gray-900">Напоминания о смене</h4>
                </div>

                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Включить напоминания</span>
                  <button
                    onClick={() => setReminderSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      reminderSettings.enabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        reminderSettings.enabled ? 'translate-x-6' : ''
                      }`}
                    />
                  </button>
                </label>

                {reminderSettings.enabled && (
                  <div className="space-y-4 pl-8 border-l-2 border-blue-100">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        За сколько времени ДО начала смены напоминать
                      </label>
                      <input
                        type="time"
                        value={formatOffsetTime(reminderSettings.offsetMinutes)}
                        onChange={(e) => setReminderSettings(prev => ({
                          ...prev,
                          offsetMinutes: parseOffsetTime(e.target.value)
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Бот отправит напоминание за указанное время до начала смены.
                        Например: смена в 09:00, напоминание за 00:15 = сообщение в 08:45.
                      </p>
                    </div>

                    <div>
                      {!showCommentField ? (
                        <button
                          onClick={() => setShowCommentField(true)}
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          <MessageSquare className="w-4 h-4" />
                          + Комментарий
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-sm text-gray-600">Комментарий к напоминанию</label>
                            <button
                              onClick={() => {
                                setShowCommentField(false);
                                setReminderSettings(prev => ({ ...prev, comment: null }));
                              }}
                              className="p-1 hover:bg-red-50 rounded text-red-500 hover:text-red-600"
                              title="Удалить комментарий"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <textarea
                            value={reminderSettings.comment || ''}
                            onChange={(e) => setReminderSettings(prev => ({
                              ...prev,
                              comment: e.target.value || null
                            }))}
                            placeholder="Текст комментария, который будет добавлен в напоминание..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                            rows={3}
                          />
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-800">
                      <p className="font-medium mb-1">Как работают напоминания:</p>
                      <ul className="list-disc list-inside space-y-1 text-blue-700">
                        <li>За указанное время до смены - напоминание о начале</li>
                        <li>Если смена не открыта вовремя - повторное уведомление</li>
                        <li>После открытия смены сообщения удаляются</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-orange-600" />
                  <h4 className="font-medium text-gray-900">Напоминание о закрытии смены</h4>
                </div>

                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Включить напоминание о закрытии</span>
                  <button
                    onClick={() => setReminderSettings(prev => ({ ...prev, closeReminderEnabled: !prev.closeReminderEnabled }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      reminderSettings.closeReminderEnabled ? 'bg-orange-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        reminderSettings.closeReminderEnabled ? 'translate-x-6' : ''
                      }`}
                    />
                  </button>
                </label>

                {reminderSettings.closeReminderEnabled && (
                  <div className="space-y-4 pl-8 border-l-2 border-orange-100">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Автоматически закрывать смену через
                      </label>
                      <input
                        type="time"
                        value={formatOffsetTime(reminderSettings.autoCloseOffsetMinutes)}
                        onChange={(e) => setReminderSettings(prev => ({
                          ...prev,
                          autoCloseOffsetMinutes: parseOffsetTime(e.target.value)
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        После планового окончания смены бот сразу отправит сообщение.
                        Если смена не будет закрыта вручную - система закроет её автоматически через указанное время.
                      </p>
                    </div>

                    <div className="bg-orange-50 rounded-xl p-3 text-sm text-orange-800">
                      <p className="font-medium mb-1">Как работает автозакрытие:</p>
                      <ul className="list-disc list-inside space-y-1 text-orange-700">
                        <li>При окончании смены - сообщение с просьбой закрыть</li>
                        <li>При ручном закрытии - сообщение удаляется</li>
                        <li>Через указанное время - автоматическое закрытие</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={saveReminderSettings}
                disabled={settingsLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {settingsLoading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeadlinesModal && (
        <DeadlinesSettingsModal
          partnerId={partnerId}
          onClose={() => {
            setShowDeadlinesModal(false);
            loadInitialData();
          }}
        />
      )}

      {showDiagnostics && (
        <NotificationDiagnostics
          partnerId={partnerId}
          onClose={() => setShowDiagnostics(false)}
        />
      )}
    </div>
  );
}

interface CalendarPickerProps {
  anchorDate: Date;
  viewMode: ViewMode;
  onSelect: (date: Date) => void;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement>;
}

function CalendarPicker({ anchorDate, viewMode, onSelect, onClose, buttonRef }: CalendarPickerProps) {
  const [displayMonth, setDisplayMonth] = useState(() => new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1));
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, buttonRef]);

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  const daysInMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1).getDay();
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const handleDayClick = (day: number) => {
    const selected = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day);
    onSelect(selected);
  };

  const handleMonthClick = () => {
    const selected = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
    onSelect(selected);
  };

  const navigateMonth = (delta: number) => {
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + delta, 1));
  };

  const buttonRect = buttonRef.current?.getBoundingClientRect();
  const style: React.CSSProperties = {
    position: 'fixed',
    top: (buttonRect?.bottom || 0) + 8,
    left: buttonRect?.left || 0,
    zIndex: 9999
  };

  const isInSelectedWeek = (day: number): boolean => {
    if (!day) return false;
    const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day);
    return isSameWeek(date, anchorDate);
  };

  const isInHoveredWeek = (day: number): boolean => {
    if (!day || !hoveredDate) return false;
    const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day);
    return isSameWeek(date, hoveredDate);
  };

  const isWeekStart = (day: number): boolean => {
    if (!day) return false;
    const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day);
    return date.getDay() === 1;
  };

  return createPortal(
    <div ref={popupRef} style={style} className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
        <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-white/20 rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={handleMonthClick}
          className="font-semibold hover:bg-white/20 px-3 py-1 rounded-lg transition-colors"
        >
          {monthNames[displayMonth.getMonth()]} {displayMonth.getFullYear()}
        </button>
        <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-white/20 rounded-lg">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {viewMode === 'week' && (
        <div className="p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              if (day === null) {
                return <div key={idx} className="w-9 h-9" />;
              }

              const isSelected = isInSelectedWeek(day);
              const isHovered = isInHoveredWeek(day);
              const isMonday = isWeekStart(day);
              const isToday = day === new Date().getDate() &&
                displayMonth.getMonth() === new Date().getMonth() &&
                displayMonth.getFullYear() === new Date().getFullYear();

              return (
                <button
                  key={idx}
                  onClick={() => handleDayClick(day)}
                  onMouseEnter={() => setHoveredDate(new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day))}
                  onMouseLeave={() => setHoveredDate(null)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-all relative ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : isHovered
                        ? 'bg-blue-100 text-blue-700'
                        : isToday
                          ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-400'
                          : 'hover:bg-gray-100 text-gray-700'
                  } ${isMonday ? 'ring-1 ring-gray-300' : ''}`}
                >
                  {day}
                  {isMonday && (
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-400 rounded" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-gray-500 text-center">
            Наведите на день для выделения недели
          </div>
        </div>
      )}

      {viewMode === 'month' && (
        <div className="p-4 grid grid-cols-3 gap-2">
          {monthNames.map((month, idx) => {
            const isSelected = idx === anchorDate.getMonth() &&
              displayMonth.getFullYear() === anchorDate.getFullYear();
            return (
              <button
                key={month}
                onClick={() => {
                  const selected = new Date(displayMonth.getFullYear(), idx, 1);
                  onSelect(selected);
                }}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {month.slice(0, 3)}
              </button>
            );
          })}
        </div>
      )}
    </div>,
    document.body
  );
}

interface ScheduleTableProps {
  branchId: string;
  daysRange: DayColumn[];
  viewMode: ViewMode;
  employeeRows: { employeeId: string; positionId: string }[];
  employees: Employee[];
  problemDays: string[];
  unfilledHorizonDays: string[];
  shifts: Shift[];
  scale: number;
  onCellClick: (employeeId: string, positionId: string, date: string, rect: DOMRect, shift?: Shift) => void;
  onRemoveEmployee: (employeeId: string) => void;
  calculateEmployeeTotalMinutes: (employeeId: string) => number;
  calculateBranchDayMinutes: (date: string) => number;
  getShiftForCell: (employeeId: string, date: string) => Shift | undefined;
  scrollRef: (ref: HTMLDivElement | null) => void;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

function ScheduleTable({
  daysRange,
  viewMode,
  employeeRows,
  employees,
  problemDays,
  unfilledHorizonDays,
  scale,
  onCellClick,
  onRemoveEmployee,
  calculateEmployeeTotalMinutes,
  calculateBranchDayMinutes,
  getShiftForCell,
  scrollRef,
  onScroll
}: ScheduleTableProps) {
  const getEmployeeName = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return 'Неизвестный';
    return `${emp.first_name}${emp.last_name ? ' ' + emp.last_name : ''}`;
  };

  const getEmployeePosition = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    return emp?.position?.name || '';
  };

  const cellHeight = Math.max(20, Math.round(40 * scale));
  const avatarSize = Math.max(20, Math.round(40 * scale));
  const minColWidth = Math.max(35, Math.round(70 * scale));
  const nameColWidth = Math.max(100, Math.round(200 * scale));
  const cellPadding = Math.max(2, Math.round(8 * scale));
  const gapSize = Math.max(4, Math.round(8 * scale));

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="overflow-x-auto"
        style={{
          overflowX: 'scroll',
          scrollbarWidth: 'thin',
          scrollbarColor: '#CBD5E1 #F1F5F9'
        }}
      >
        <div className="inline-block min-w-full">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-20 bg-gray-50 text-left font-semibold text-gray-500 uppercase border-b border-r border-gray-200"
                  style={{
                    minWidth: `${nameColWidth}px`,
                    fontSize: `${Math.max(7, 12 * scale)}px`,
                    padding: `${cellPadding}px`
                  }}
                >
                  Сотрудник
                </th>
                {daysRange.map((day, idx) => {
                  const hasProblem = problemDays.includes(day.date);
                  const needsToFill = unfilledHorizonDays.includes(day.date);
                  const isNewWeek = viewMode === 'month' && idx > 0 && daysRange[idx - 1].weekIndex !== day.weekIndex;
                  const isMonday = day.weekday === 1;

                  return (
                    <th
                      key={day.date}
                      className={`text-center font-semibold border-b border-gray-200 ${
                        needsToFill
                          ? 'bg-orange-100 text-orange-800 ring-2 ring-orange-400'
                          : hasProblem
                            ? 'bg-amber-50 text-amber-700'
                            : day.isWeekend
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-gray-50 text-gray-500'
                      } ${isNewWeek ? 'border-l-4 border-l-blue-400' : ''} ${isMonday && viewMode === 'month' ? 'ring-1 ring-blue-200' : ''}`}
                      style={{
                        minWidth: `${minColWidth}px`,
                        fontSize: `${Math.max(6, 11 * scale)}px`,
                        padding: `${cellPadding}px`
                      }}
                    >
                      <div className="capitalize">{getWeekdayShort(day.weekday)}</div>
                      <div className="font-bold mt-0.5" style={{ fontSize: `${Math.max(7, 14 * scale)}px` }}>{day.dayOfMonth}</div>
                      {viewMode === 'month' && isMonday && (
                        <div className="text-blue-600 mt-0.5 font-bold" style={{ fontSize: `${Math.max(5, 9 * scale)}px` }}>Нед. {day.weekIndex + 1}</div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {employeeRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={daysRange.length + 1}
                    className="p-8 text-center text-gray-400"
                  >
                    Добавьте сотрудников в график
                  </td>
                </tr>
              ) : (
                employeeRows.map(({ employeeId, positionId }) => {
                  const totalMinutes = calculateEmployeeTotalMinutes(employeeId);
                  const emp = employees.find(e => e.id === employeeId);
                  const isPendingDismissal = emp?.current_status === 'pending_dismissal';

                  return (
                    <tr key={employeeId} className="group hover:bg-gray-50/50">
                      <td
                        className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-b border-r border-gray-200"
                        style={{ padding: `${cellPadding}px` }}
                      >
                        <div className="flex items-center" style={{ gap: `${gapSize}px` }}>
                          {emp?.photo_url ? (
                            <img
                              src={emp.photo_url}
                              alt={getEmployeeName(employeeId)}
                              className="rounded-full object-cover flex-shrink-0 border-2 border-gray-200"
                              style={{ width: `${avatarSize}px`, height: `${avatarSize}px` }}
                            />
                          ) : (
                            <div
                              className={`rounded-full flex items-center justify-center flex-shrink-0 ${
                                isPendingDismissal
                                  ? 'bg-gradient-to-br from-amber-500 to-orange-500'
                                  : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                              }`}
                              style={{ width: `${avatarSize}px`, height: `${avatarSize}px` }}
                            >
                              <User className="text-white" style={{ width: `${Math.max(10, Math.round(20 * scale))}px`, height: `${Math.max(10, Math.round(20 * scale))}px` }} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900" style={{ fontSize: `${Math.max(9, 14 * scale)}px` }}>
                              <div className="md:truncate">
                                <span className="hidden md:inline">{getEmployeeName(employeeId)}</span>
                                <span className="md:hidden block leading-tight">{emp?.first_name}</span>
                                {emp?.last_name && (
                                  <span className="md:hidden block leading-tight">{emp.last_name}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-gray-500 truncate" style={{ fontSize: `${Math.max(8, 12 * scale)}px` }}>
                              {getEmployeePosition(employeeId)}
                            </div>
                            {isPendingDismissal && emp?.dismissal_date && (
                              <div className="text-amber-600" style={{ fontSize: `${Math.max(8, 12 * scale)}px` }}>
                                До {new Date(emp.dismissal_date).toLocaleDateString('ru-RU')}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0" style={{ gap: `${Math.max(2, Math.round(4 * scale))}px` }}>
                            <div className="font-semibold text-blue-700 whitespace-nowrap" style={{ fontSize: `${Math.max(7, 14 * scale)}px` }}>
                              {formatMinutesToHours(totalMinutes)}
                            </div>
                            <button
                              onClick={() => onRemoveEmployee(employeeId)}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 style={{ width: `${Math.max(8, Math.round(16 * scale))}px`, height: `${Math.max(8, Math.round(16 * scale))}px` }} />
                            </button>
                          </div>
                        </div>
                      </td>

                      {daysRange.map((day, idx) => {
                        const shift = getShiftForCell(employeeId, day.date);
                        const hasProblem = problemDays.includes(day.date);
                        const needsToFill = unfilledHorizonDays.includes(day.date);
                        const isNewWeek = viewMode === 'month' && idx > 0 && daysRange[idx - 1].weekIndex !== day.weekIndex;
                        const isUnavailable = emp?.dismissal_date && day.date >= emp.dismissal_date;

                        return (
                          <td
                            key={day.date}
                            className={`border-b border-gray-200 ${
                              needsToFill
                                ? 'bg-orange-100/50 ring-2 ring-orange-300'
                                : hasProblem
                                  ? 'bg-amber-50/30'
                                  : day.isWeekend
                                    ? 'bg-gray-50/50'
                                    : ''
                            } ${isNewWeek ? 'border-l-4 border-l-blue-400' : ''}`}
                            style={{ padding: `${Math.max(2, Math.round(4 * scale))}px` }}
                          >
                            <button
                              onClick={(e) => {
                                if (!isUnavailable) {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  onCellClick(employeeId, positionId, day.date, rect, shift);
                                }
                              }}
                              disabled={isUnavailable}
                              className={`w-full rounded-lg border-2 border-dashed transition-all flex flex-col items-center justify-center relative ${
                                isUnavailable
                                  ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                                  : shift
                                    ? shift.status === 'opened'
                                      ? 'border-green-400 bg-green-50 hover:bg-green-100 cursor-pointer'
                                      : shift.attendance_status === 'no_show'
                                        ? shift.no_show_reason_status === 'approved'
                                          ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 cursor-pointer'
                                          : 'border-red-300 bg-red-50 hover:bg-red-100 cursor-pointer'
                                        : shift.confirmation_status === 'pending'
                                          ? 'border-amber-400 bg-amber-50 hover:bg-amber-100 cursor-pointer'
                                          : shift.confirmation_status === 'declined' || shift.confirmation_status === 'late_decline_pending'
                                            ? 'border-red-400 bg-red-50 hover:bg-red-100 cursor-pointer'
                                            : shift.is_replacement
                                              ? 'border-green-300 bg-green-50 hover:bg-green-100 cursor-pointer'
                                              : 'border-blue-300 bg-blue-50 hover:bg-blue-100 cursor-pointer'
                                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                              }`}
                              style={{ height: `${cellHeight}px` }}
                              title={shift?.status === 'opened'
                                ? 'Смена открыта'
                                : shift?.attendance_status === 'no_show'
                                  ? `Не выход${shift.no_show_reason_text ? `: ${shift.no_show_reason_text}` : ''}${shift.no_show_reason_status === 'approved' ? ' (причина одобрена)' : shift.no_show_reason_status === 'rejected' ? ' (причина отклонена)' : ''}`
                                  : shift?.confirmation_status === 'pending'
                                    ? 'Не подтверждено'
                                    : shift?.confirmation_status === 'late_decline_pending'
                                      ? `Отказ (поздно) - на решении${shift.decline_reason ? ': ' + shift.decline_reason : ''}`
                                      : shift?.confirmation_status === 'declined'
                                        ? `Отказ${shift.decline_reason ? ': ' + shift.decline_reason : ''}`
                                        : shift?.is_replacement
                                          ? 'Замена'
                                          : undefined
                              }
                            >
                              {shift && (
                                <>
                                  {shift.status === 'opened' && (
                                    <div className="absolute top-0 right-0 p-0.5">
                                      <Play className="text-green-600" style={{ width: `${Math.max(6, 10 * scale)}px`, height: `${Math.max(6, 10 * scale)}px` }} />
                                    </div>
                                  )}
                                  {shift.attendance_status === 'closed' && shift.early_leave_minutes && shift.early_leave_minutes > 0 && !shift.early_leave_reset && shift.status !== 'opened' && (
                                    <div className="absolute top-0 right-0 p-0.5">
                                      <LogOut className="text-orange-600" style={{ width: `${Math.max(6, 10 * scale)}px`, height: `${Math.max(6, 10 * scale)}px` }} />
                                    </div>
                                  )}
                                  {shift.is_replacement && shift.status !== 'opened' && !(shift.attendance_status === 'closed' && shift.early_leave_minutes && shift.early_leave_minutes > 0 && !shift.early_leave_reset) && (
                                    <div className="absolute top-0 right-0 p-0.5">
                                      <RefreshCw className="text-green-600" style={{ width: `${Math.max(6, 10 * scale)}px`, height: `${Math.max(6, 10 * scale)}px` }} />
                                    </div>
                                  )}
                                  {shift.confirmation_status === 'pending' && shift.status !== 'opened' && (
                                    <div className="absolute top-0 left-0 p-0.5">
                                      <Clock className="text-amber-600" style={{ width: `${Math.max(6, 10 * scale)}px`, height: `${Math.max(6, 10 * scale)}px` }} />
                                    </div>
                                  )}
                                  {(shift.confirmation_status === 'declined' || shift.confirmation_status === 'late_decline_pending') && shift.status !== 'opened' && (
                                    <div className="absolute top-0 left-0 p-0.5">
                                      <AlertTriangle className="text-red-600" style={{ width: `${Math.max(6, 10 * scale)}px`, height: `${Math.max(6, 10 * scale)}px` }} />
                                    </div>
                                  )}
                                  {shift.status === 'opened' && shift.attendance_status !== 'no_show' && (
                                    <div className="font-semibold text-green-700" style={{ fontSize: `${Math.max(5, 9 * scale)}px` }}>
                                      Работает
                                    </div>
                                  )}
                                  {shift.attendance_status === 'closed' && shift.early_leave_minutes && shift.early_leave_minutes > 0 && !shift.early_leave_reset && (
                                    <div className="font-semibold text-orange-700" style={{ fontSize: `${Math.max(5, 9 * scale)}px` }}>
                                      Раннее закрытие
                                    </div>
                                  )}
                                  {shift.attendance_status === 'closed' && (!shift.early_leave_minutes || shift.early_leave_minutes === 0 || shift.early_leave_reset) && shift.status !== 'opened' && shift.confirmation_status !== 'pending' && shift.confirmation_status !== 'declined' && shift.confirmation_status !== 'late_decline_pending' && shift.attendance_status !== 'no_show' && (
                                    <div className="font-semibold text-gray-700" style={{ fontSize: `${Math.max(5, 9 * scale)}px` }}>
                                      Закрыта
                                    </div>
                                  )}
                                  {shift.attendance_status === 'no_show' && (
                                    <div className={`font-semibold ${
                                      shift.no_show_reason_status === 'approved' ? 'text-amber-700' : 'text-red-700'
                                    }`} style={{ fontSize: `${Math.max(5, 10 * scale)}px` }}>
                                      {shift.no_show_reason_status === 'approved' ? 'Причина' : 'Не выход'}
                                    </div>
                                  )}
                                  {shift.confirmation_status === 'pending' && shift.attendance_status !== 'no_show' && shift.status !== 'opened' && shift.attendance_status !== 'closed' && (
                                    <div className="font-semibold text-amber-700" style={{ fontSize: `${Math.max(5, 9 * scale)}px` }}>
                                      Ожидает
                                    </div>
                                  )}
                                  {shift.confirmation_status === 'late_decline_pending' && shift.attendance_status !== 'no_show' && shift.status !== 'opened' && (
                                    <div className="font-semibold text-red-700" style={{ fontSize: `${Math.max(5, 9 * scale)}px` }}>
                                      Отказ
                                    </div>
                                  )}
                                  <div className={`font-medium ${
                                    shift.status === 'opened'
                                      ? 'text-green-800'
                                      : shift.attendance_status === 'closed' && shift.early_leave_minutes && shift.early_leave_minutes > 0 && !shift.early_leave_reset
                                        ? 'text-orange-800'
                                        : shift.attendance_status === 'closed'
                                          ? 'text-gray-800'
                                          : shift.attendance_status === 'no_show'
                                            ? shift.no_show_reason_status === 'approved' ? 'text-amber-800' : 'text-red-800'
                                            : shift.confirmation_status === 'pending'
                                              ? 'text-amber-800'
                                              : shift.confirmation_status === 'declined' || shift.confirmation_status === 'late_decline_pending'
                                                ? 'text-red-800'
                                                : shift.is_replacement
                                                  ? 'text-green-800'
                                                  : 'text-blue-800'
                                  }`} style={{ fontSize: `${Math.max(6, 12 * scale)}px` }}>
                                    {shift.start_time.slice(0, 5)}
                                  </div>
                                  <div className={`${
                                    shift.status === 'opened'
                                      ? 'text-green-600'
                                      : shift.attendance_status === 'closed' && shift.early_leave_minutes && shift.early_leave_minutes > 0 && !shift.early_leave_reset
                                        ? 'text-orange-600'
                                        : shift.attendance_status === 'closed'
                                          ? 'text-gray-600'
                                          : shift.attendance_status === 'no_show'
                                            ? shift.no_show_reason_status === 'approved' ? 'text-amber-600' : 'text-red-600'
                                            : shift.confirmation_status === 'pending'
                                              ? 'text-amber-600'
                                              : shift.confirmation_status === 'declined' || shift.confirmation_status === 'late_decline_pending'
                                                ? 'text-red-600'
                                                : shift.is_replacement
                                                ? 'text-green-600'
                                                : 'text-blue-600'
                                  }`} style={{ fontSize: `${Math.max(5, 10 * scale)}px` }}>
                                    {shift.end_time.slice(0, 5)}
                                  </div>
                                </>
                              )}
                              {!shift && !isUnavailable && (
                                <Plus className="text-gray-400" style={{ width: `${Math.max(8, Math.round(16 * scale))}px`, height: `${Math.max(8, Math.round(16 * scale))}px` }} />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface ShiftCellPopupProps {
  employeeId: string;
  branchId: string;
  date: string;
  shift?: Shift;
  rect: DOMRect;
  employees: Employee[];
  partnerId: string;
  currentUserId?: string;
  checkConflict: (startTime: string, endTime: string) => ShiftConflict | null;
  onSave: (startTime: string, endTime: string) => void;
  onClear: () => void;
  onClose: () => void;
  onDuplicateToNextDay: (startTime: string, endTime: string) => void;
}

function ShiftCellPopup({
  employeeId,
  date,
  shift,
  rect,
  employees,
  partnerId,
  currentUserId,
  checkConflict,
  onSave,
  onClear,
  onClose,
  onDuplicateToNextDay
}: ShiftCellPopupProps) {
  const [startTime, setStartTime] = useState(shift?.start_time?.slice(0, 5) || '09:00');
  const [endTime, setEndTime] = useState(shift?.end_time?.slice(0, 5) || '18:00');
  const [conflict, setConflict] = useState<ShiftConflict | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [approvedByEmployee, setApprovedByEmployee] = useState<Employee | null>(null);
  const [rejectedByEmployee, setRejectedByEmployee] = useState<Employee | null>(null);
  const [isChangingDecision, setIsChangingDecision] = useState(false);
  const [isEditingDecision, setIsEditingDecision] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const totalMinutes = endMinutes >= startMinutes
    ? endMinutes - startMinutes
    : (24 * 60 - startMinutes) + endMinutes;

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  const emp = employees.find(e => e.id === employeeId);
  const employeeName = emp ? `${emp.first_name}${emp.last_name ? ' ' + emp.last_name : ''}` : '';

  const dateObj = new Date(date);
  const formattedDate = dateObj.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const c = checkConflict(startTime, endTime);
    setConflict(c);
  }, [startTime, endTime, checkConflict]);

  useEffect(() => {
    const loadDecisionEmployees = async () => {
      if (shift?.no_show_approved_by) {
        const { data } = await supabase
          .from('employees')
          .select('id, first_name, last_name, photo_url')
          .eq('id', shift.no_show_approved_by)
          .maybeSingle();
        if (data) setApprovedByEmployee(data as Employee);
      }
      if (shift?.no_show_rejected_by) {
        const { data } = await supabase
          .from('employees')
          .select('id, first_name, last_name, photo_url')
          .eq('id', shift.no_show_rejected_by)
          .maybeSingle();
        if (data) setRejectedByEmployee(data as Employee);
      }
    };
    loadDecisionEmployees();
  }, [shift]);

  const changeDecision = async (newStatus: 'approved' | 'rejected') => {
    if (!shift?.id || !shift?.staff_member_id || isChangingDecision) return;

    setIsChangingDecision(true);
    try {
      const currentEmployee = currentUserId ? employees.find(e => e.id === currentUserId) : null;

      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        no_show_reason_status: newStatus
      };

      if (newStatus === 'approved') {
        updateData.no_show_approved_by = currentUserId || null;
        updateData.no_show_approved_at = now;
        updateData.no_show_rejected_by = null;
        updateData.no_show_rejected_at = null;
      } else {
        updateData.no_show_rejected_by = currentUserId || null;
        updateData.no_show_rejected_at = now;
        updateData.no_show_approved_by = null;
        updateData.no_show_approved_at = null;
      }

      const { error: shiftError } = await supabase
        .from('schedule_shifts')
        .update(updateData)
        .eq('id', shift.id);

      if (shiftError) throw shiftError;

      const { data: events } = await supabase
        .from('employee_events')
        .select('id, telegram_message_id, telegram_chat_id')
        .eq('related_shift_id', shift.id)
        .eq('related_employee_id', shift.staff_member_id)
        .eq('event_type', 'no_show_reason_selected');

      if (events && events.length > 0) {
        for (const event of events) {
          await supabase
            .from('employee_events')
            .update({
              action_status: newStatus,
              action_taken_at: now
            })
            .eq('id', event.id);

          if (event.telegram_message_id && event.telegram_chat_id) {
            const { data: partnerSettings } = await supabase
              .from('partner_settings')
              .select('employee_bot_token')
              .eq('partner_id', partnerId)
              .maybeSingle();

            if (partnerSettings?.employee_bot_token) {
              const responsibleText = currentEmployee
                ? `${currentEmployee.first_name}${currentEmployee.last_name ? ' ' + currentEmployee.last_name : ''}`
                : 'Администратор';

              const shiftDateObj = new Date(shift.date);
              const shiftDateFormatted = shiftDateObj.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              });
              const shiftTime = `${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}`;

              await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram-message`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  bot_token: partnerSettings.employee_bot_token,
                  chat_id: event.telegram_chat_id,
                  message: `<b>Решение по не выходу изменено</b>\n\nВаша причина была <b>${newStatus === 'approved' ? 'одобрена' : 'отклонена'}</b>\n\n<b>Смена:</b> ${shiftDateFormatted}, ${shiftTime}\n<b>Ответственный:</b> ${responsibleText}`
                })
              });
            }
          }
        }
      }

      const { data: targetEmployee } = await supabase
        .from('employees')
        .select('telegram_user_id')
        .eq('id', shift.staff_member_id)
        .maybeSingle();

      let newMessageId: number | null = null;
      let newChatId: string | null = null;

      if (targetEmployee?.telegram_user_id) {
        const { data: partnerSettings } = await supabase
          .from('partner_settings')
          .select('employee_bot_token')
          .eq('partner_id', partnerId)
          .maybeSingle();

        if (partnerSettings?.employee_bot_token) {
          const { data: previousEvent } = await supabase
            .from('employee_events')
            .select('telegram_message_id, telegram_chat_id')
            .eq('related_shift_id', shift.id)
            .in('event_type', ['no_show_approved', 'no_show_rejected'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (previousEvent?.telegram_message_id && previousEvent?.telegram_chat_id) {
            try {
              await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-telegram-message`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  bot_token: partnerSettings.employee_bot_token,
                  chat_id: previousEvent.telegram_chat_id,
                  message_id: previousEvent.telegram_message_id
                })
              });
            } catch (deleteError) {
              console.error('Error deleting previous message:', deleteError);
            }
          }

          const shiftDateObj = new Date(shift.date);
          const shiftDateFormatted = shiftDateObj.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
          const shiftTime = `${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}`;

          const responsibleName = currentEmployee
            ? `${currentEmployee.first_name}${currentEmployee.last_name ? ' ' + currentEmployee.last_name : ''}`
            : 'Администратор';

          const telegramMessage = newStatus === 'approved'
            ? `<b>Причина одобрена</b>\n\n` +
              `Ваша причина не выхода на смену одобрена.\n\n` +
              `<b>Смена:</b> ${shiftDateFormatted}, ${shiftTime}\n` +
              `<b>Причина:</b> ${shift.no_show_reason_text}\n` +
              `<b>Ответственный:</b> ${responsibleName}`
            : `<b>Причина отклонена</b>\n\n` +
              `Ваша причина не выхода на смену отклонена.\n\n` +
              `<b>Смена:</b> ${shiftDateFormatted}, ${shiftTime}\n` +
              `<b>Причина:</b> ${shift.no_show_reason_text}\n` +
              `<b>Ответственный:</b> ${responsibleName}\n\n` +
              `Обратитесь к руководству для уточнения.`;

          const telegramResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram-message`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              bot_token: partnerSettings.employee_bot_token,
              chat_id: targetEmployee.telegram_user_id,
              message: telegramMessage
            })
          });

          if (telegramResponse.ok) {
            const telegramData = await telegramResponse.json();
            if (telegramData.telegram_response?.result?.message_id) {
              newMessageId = telegramData.telegram_response.result.message_id;
              newChatId = targetEmployee.telegram_user_id;
            }
          }
        }
      }

      const eventType = newStatus === 'approved' ? 'no_show_approved' : 'no_show_rejected';
      const eventTitle = newStatus === 'approved' ? 'Причина одобрена' : 'Причина отклонена';
      const responsibleName = currentEmployee
        ? `${currentEmployee.first_name}${currentEmployee.last_name ? ' ' + currentEmployee.last_name : ''}`
        : 'Администратор';
      const eventMessage = newStatus === 'approved'
        ? `Ваша причина не выхода на смену одобрена ответственным ${responsibleName}`
        : `Ваша причина не выхода на смену отклонена ответственным ${responsibleName}. Обратитесь к руководству для уточнения.`;

      await supabase.from('employee_events').insert({
        partner_id: partnerId,
        employee_id: shift.staff_member_id,
        event_type: eventType,
        title: eventTitle,
        message: eventMessage,
        related_shift_id: shift.id,
        no_show_reason_text: shift.no_show_reason_text,
        telegram_message_id: newMessageId,
        telegram_chat_id: newChatId,
      });

      setIsEditingDecision(false);
      onClose();
    } catch (err) {
      console.error('Error changing decision:', err);
      alert('Ошибка при изменении решения');
    } finally {
      setIsChangingDecision(false);
    }
  };

  const handleSave = async () => {
    if (conflict || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(startTime, endTime);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (conflict || isSaving) return;

    setIsSaving(true);
    try {
      await onDuplicateToNextDay(startTime, endTime);
    } finally {
      setIsSaving(false);
    }
  };

  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]" onClick={onClose} />
        <div className="fixed inset-0 flex items-center justify-center z-[101] p-4">
          <div ref={popupRef} className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{employeeName}</div>
                  <div className="text-xs opacity-80 capitalize">{formattedDate}</div>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <button
                onClick={() => {
                  const input = document.getElementById('shift-start-time') as HTMLInputElement;
                  input?.showPicker?.();
                  input?.focus();
                }}
                className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors text-left"
              >
                <div className="text-xs text-gray-500 mb-1">Начало смены</div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <input
                    id="shift-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="text-xl font-bold text-gray-900 bg-transparent border-none outline-none w-full cursor-pointer"
                  />
                </div>
              </button>

              <button
                onClick={() => {
                  const input = document.getElementById('shift-end-time') as HTMLInputElement;
                  input?.showPicker?.();
                  input?.focus();
                }}
                className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors text-left"
              >
                <div className="text-xs text-gray-500 mb-1">Конец смены</div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <input
                    id="shift-end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="text-xl font-bold text-gray-900 bg-transparent border-none outline-none w-full cursor-pointer"
                  />
                </div>
              </button>

              <div className="flex items-center justify-center gap-2 py-3 bg-blue-50 rounded-xl">
                <span className="text-sm text-gray-600">Итого:</span>
                <span className="text-xl font-bold text-blue-700">
                  {hours}ч {mins > 0 ? `${mins}м` : ''}
                </span>
              </div>

              {conflict && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                  <div className="flex items-center gap-2 text-amber-700 font-medium mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Конфликт смен</span>
                  </div>
                  <div className="text-amber-600 text-xs">
                    Сотрудник работает в "{conflict.branchName}"
                    с {conflict.startTime} до {conflict.endTime}.
                    Свободен с {conflict.freeFrom}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={!!conflict || isSaving}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all text-base ${
                    conflict || isSaving
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700'
                  }`}
                >
                  {isSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
                {shift && (
                  <button
                    onClick={onClear}
                    disabled={isSaving}
                    className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                    title="Очистить"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              {shift && (shift.actual_start_at || shift.actual_end_at || shift.attendance_status === 'no_show') && (
                <div className="border-t border-gray-200 pt-4 mt-4 space-y-3">
                  <div className="text-sm font-semibold text-gray-900">Информация о смене</div>

                  {shift.actual_start_at && (
                    <div className="p-3 bg-blue-50 rounded-xl">
                      <div className="text-xs text-gray-600 mb-1">Фактический приход</div>
                      <div className="font-semibold text-blue-700">
                        {new Date(shift.actual_start_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}

                  {shift.actual_end_at && (
                    <div className="p-3 bg-green-50 rounded-xl">
                      <div className="text-xs text-gray-600 mb-1">Фактический уход</div>
                      <div className="font-semibold text-green-700">
                        {new Date(shift.actual_end_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}

                  {shift.actual_start_at && shift.actual_end_at && (
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <div className="text-xs text-gray-600 mb-1">Фактически отработано</div>
                      <div className="font-semibold text-gray-900">
                        {(() => {
                          const actualStart = new Date(shift.actual_start_at);
                          const actualEnd = new Date(shift.actual_end_at);
                          const diffMs = actualEnd.getTime() - actualStart.getTime();
                          const diffMins = Math.floor(diffMs / 60000);
                          const hrs = Math.floor(diffMins / 60);
                          const mins = diffMins % 60;
                          return `${hrs}ч ${mins}м`;
                        })()}
                      </div>
                      {shift.early_leave_minutes && shift.early_leave_minutes > 0 && !shift.early_leave_reset && (
                        <div className="mt-2 text-xs text-orange-600">
                          Ушел раньше на {Math.floor(shift.early_leave_minutes / 60)}ч {shift.early_leave_minutes % 60}м
                        </div>
                      )}
                    </div>
                  )}

                  {shift.attendance_status === 'no_show' && (
                    <div className={`p-3 border rounded-xl ${
                      shift.no_show_reason_text ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="text-xs text-gray-600 mb-1">
                        {shift.no_show_reason_text ? 'Причина не выхода' : 'Статус'}
                      </div>
                      <div className={`font-medium mb-2 ${
                        shift.no_show_reason_text ? 'text-amber-900' : 'text-red-900'
                      }`}>
                        {shift.no_show_reason_text || 'Не выход без причины'}
                      </div>

                      {shift.no_show_reason_text && shift.no_show_reason_status && (
                        <div className="space-y-2 mt-3">
                          {shift.no_show_reason_status === 'pending' || isEditingDecision ? (
                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={() => changeDecision('approved')}
                                disabled={isChangingDecision}
                                className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Одобрить
                              </button>
                              <button
                                onClick={() => changeDecision('rejected')}
                                disabled={isChangingDecision}
                                className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Отклонить
                              </button>
                            </div>
                          ) : (
                            <>
                              {shift.no_show_reason_status === 'approved' && (
                                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
                                      <Check className="w-4 h-4 text-green-600" />
                                    </div>
                                    <span className="font-medium text-green-900">Причина одобрена</span>
                                  </div>
                                  {approvedByEmployee && (
                                    <div className="text-xs text-green-700 ml-8">
                                      Ответственный: {approvedByEmployee.first_name}{approvedByEmployee.last_name ? ' ' + approvedByEmployee.last_name : ''}
                                    </div>
                                  )}
                                </div>
                              )}

                              {shift.no_show_reason_status === 'rejected' && (
                                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100">
                                      <X className="w-4 h-4 text-red-600" />
                                    </div>
                                    <span className="font-medium text-red-900">Причина отклонена</span>
                                  </div>
                                  {rejectedByEmployee && (
                                    <div className="text-xs text-red-700 ml-8">
                                      Ответственный: {rejectedByEmployee.first_name}{rejectedByEmployee.last_name ? ' ' + rejectedByEmployee.last_name : ''}
                                    </div>
                                  )}
                                </div>
                              )}

                              <button
                                onClick={() => setIsEditingDecision(true)}
                                disabled={isChangingDecision}
                                className="w-full py-2 rounded-lg text-sm font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Изменить решение
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {shift && shift.confirmation_status === 'late_decline_pending' && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                      <AlertTriangle className="w-5 h-5" />
                      <span>Поздний отказ от смены</span>
                    </div>
                    <div className="text-sm text-gray-700 mb-1">
                      Сотрудник отказался от смены слишком поздно.
                    </div>
                    {shift.decline_reason && (
                      <div className="text-sm text-gray-600 mb-3">
                        <span className="font-medium">Причина:</span> {shift.decline_reason}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mb-3">
                      Требуется решение ответственного.
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (!shift.id || isChangingDecision) return;
                          setIsChangingDecision(true);
                          try {
                            const { error } = await supabase
                              .from('schedule_shifts')
                              .update({
                                confirmation_status: 'declined',
                                responsible_decision: 'approved_cancel',
                                decided_at: new Date().toISOString(),
                                decided_by_responsible_id: currentUserId || null,
                                staff_member_id: null
                              })
                              .eq('id', shift.id);
                            if (error) throw error;
                            onClose();
                          } catch (err) {
                            console.error('Error approving cancel:', err);
                            alert('Ошибка');
                          } finally {
                            setIsChangingDecision(false);
                          }
                        }}
                        disabled={isChangingDecision}
                        className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
                      >
                        Принять отказ
                      </button>
                      <button
                        onClick={async () => {
                          if (!shift.id || isChangingDecision) return;
                          setIsChangingDecision(true);
                          try {
                            const { error } = await supabase
                              .from('schedule_shifts')
                              .update({
                                confirmation_status: 'confirmed',
                                responsible_decision: 'rejected_cancel',
                                decided_at: new Date().toISOString(),
                                decided_by_responsible_id: currentUserId || null,
                                decline_reason: null,
                                decline_is_late: false,
                                declined_at: null
                              })
                              .eq('id', shift.id);
                            if (error) throw error;
                            onClose();
                          } catch (err) {
                            console.error('Error rejecting cancel:', err);
                            alert('Ошибка');
                          } finally {
                            setIsChangingDecision(false);
                          }
                        }}
                        disabled={isChangingDecision}
                        className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                      >
                        Отклонить отказ
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {shift && shift.confirmation_status === 'pending' && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                      <Clock className="w-5 h-5" />
                      <span>Ожидает подтверждения</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Сотрудник ещё не подтвердил эту смену.
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleDuplicate}
                disabled={!!conflict || isSaving}
                className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-base ${
                  conflict || isSaving
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600'
                }`}
              >
                <CopyPlus className="w-4 h-4" />
                <span>Дублировать на следующий день</span>
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4">
        <div ref={popupRef} className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{employeeName}</div>
                <div className="text-xs opacity-80 capitalize">{formattedDate}</div>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1">
        <button
          onClick={() => {
            const input = document.getElementById('shift-start-time') as HTMLInputElement;
            input?.showPicker?.();
            input?.focus();
          }}
          className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors text-left"
        >
          <div className="text-xs text-gray-500 mb-1">Начало смены</div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <input
              id="shift-start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="text-xl font-bold text-gray-900 bg-transparent border-none outline-none w-full cursor-pointer"
            />
          </div>
        </button>

        <button
          onClick={() => {
            const input = document.getElementById('shift-end-time') as HTMLInputElement;
            input?.showPicker?.();
            input?.focus();
          }}
          className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors text-left"
        >
          <div className="text-xs text-gray-500 mb-1">Конец смены</div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <input
              id="shift-end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="text-xl font-bold text-gray-900 bg-transparent border-none outline-none w-full cursor-pointer"
            />
          </div>
        </button>

        <div className="flex items-center justify-center gap-2 py-2 bg-blue-50 rounded-xl">
          <span className="text-sm text-gray-600">Итого:</span>
          <span className="text-lg font-bold text-blue-700">
            {hours}ч {mins > 0 ? `${mins}м` : ''}
          </span>
        </div>

        {conflict && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
            <div className="flex items-center gap-2 text-amber-700 font-medium mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span>Конфликт смен</span>
            </div>
            <div className="text-amber-600 text-xs">
              Сотрудник работает в "{conflict.branchName}"
              с {conflict.startTime} до {conflict.endTime}.
              Свободен с {conflict.freeFrom}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!!conflict || isSaving}
            className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
              conflict || isSaving
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700'
            }`}
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
          {shift && (
            <button
              onClick={onClear}
              disabled={isSaving}
              className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
              title="Очистить"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {shift && (shift.actual_start_at || shift.actual_end_at || shift.attendance_status === 'no_show') && (
          <div className="border-t border-gray-200 pt-4 mt-4 space-y-3">
            <div className="text-sm font-semibold text-gray-900">Информация о смене</div>

            {shift.actual_start_at && (
              <div className="p-2.5 bg-blue-50 rounded-xl">
                <div className="text-xs text-gray-600 mb-1">Фактический приход</div>
                <div className="font-semibold text-blue-700 text-sm">
                  {new Date(shift.actual_start_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )}

            {shift.actual_end_at && (
              <div className="p-2.5 bg-green-50 rounded-xl">
                <div className="text-xs text-gray-600 mb-1">Фактический уход</div>
                <div className="font-semibold text-green-700 text-sm">
                  {new Date(shift.actual_end_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )}

            {shift.actual_start_at && shift.actual_end_at && (
              <div className="p-2.5 bg-gray-50 rounded-xl">
                <div className="text-xs text-gray-600 mb-1">Фактически отработано</div>
                <div className="font-semibold text-gray-900 text-sm">
                  {(() => {
                    const actualStart = new Date(shift.actual_start_at);
                    const actualEnd = new Date(shift.actual_end_at);
                    const diffMs = actualEnd.getTime() - actualStart.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const hrs = Math.floor(diffMins / 60);
                    const mins = diffMins % 60;
                    return `${hrs}ч ${mins}м`;
                  })()}
                </div>
                {shift.early_leave_minutes && shift.early_leave_minutes > 0 && !shift.early_leave_reset && (
                  <div className="mt-1.5 text-xs text-orange-600">
                    Ушел раньше на {Math.floor(shift.early_leave_minutes / 60)}ч {shift.early_leave_minutes % 60}м
                  </div>
                )}
              </div>
            )}

            {shift.attendance_status === 'no_show' && (
              <div className={`p-2.5 border rounded-xl ${
                shift.no_show_reason_text ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="text-xs text-gray-600 mb-1">
                  {shift.no_show_reason_text ? 'Причина не выхода' : 'Статус'}
                </div>
                <div className={`font-medium text-sm mb-2 ${
                  shift.no_show_reason_text ? 'text-amber-900' : 'text-red-900'
                }`}>
                  {shift.no_show_reason_text || 'Не выход без причины'}
                </div>

                {shift.no_show_reason_text && shift.no_show_reason_status && (
                  <div className="space-y-2 mt-3">
                    {shift.no_show_reason_status === 'approved' && approvedByEmployee && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100">
                          <Check className="w-3 h-3 text-green-600" />
                        </div>
                        <span className="text-gray-700">
                          Одобрено: {approvedByEmployee.first_name}{approvedByEmployee.last_name ? ' ' + approvedByEmployee.last_name : ''}
                        </span>
                      </div>
                    )}

                    {shift.no_show_reason_status === 'rejected' && rejectedByEmployee && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100">
                          <X className="w-3 h-3 text-red-600" />
                        </div>
                        <span className="text-gray-700">
                          Отклонено: {rejectedByEmployee.first_name}{rejectedByEmployee.last_name ? ' ' + rejectedByEmployee.last_name : ''}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => changeDecision('approved')}
                        disabled={isChangingDecision}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          shift.no_show_reason_status === 'approved'
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-green-500 text-white hover:bg-green-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {shift.no_show_reason_status === 'approved' ? 'Одобрено' : 'Одобрить'}
                      </button>
                      <button
                        onClick={() => changeDecision('rejected')}
                        disabled={isChangingDecision}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          shift.no_show_reason_status === 'rejected'
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-red-500 text-white hover:bg-red-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {shift.no_show_reason_status === 'rejected' ? 'Отклонено' : 'Отклонить'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {shift && shift.confirmation_status === 'late_decline_pending' && (
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Поздний отказ от смены</span>
              </div>
              <div className="text-xs text-gray-700 mb-1">
                Сотрудник отказался от смены слишком поздно.
              </div>
              {shift.decline_reason && (
                <div className="text-xs text-gray-600 mb-2">
                  <span className="font-medium">Причина:</span> {shift.decline_reason}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={async () => {
                    if (!shift.id || isChangingDecision) return;
                    setIsChangingDecision(true);
                    try {
                      const { error } = await supabase
                        .from('schedule_shifts')
                        .update({
                          confirmation_status: 'declined',
                          responsible_decision: 'approved_cancel',
                          decided_at: new Date().toISOString(),
                          decided_by_responsible_id: currentUserId || null,
                          staff_member_id: null
                        })
                        .eq('id', shift.id);
                      if (error) throw error;
                      onClose();
                    } catch (err) {
                      console.error('Error approving cancel:', err);
                      alert('Ошибка');
                    } finally {
                      setIsChangingDecision(false);
                    }
                  }}
                  disabled={isChangingDecision}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
                >
                  Принять отказ
                </button>
                <button
                  onClick={async () => {
                    if (!shift.id || isChangingDecision) return;
                    setIsChangingDecision(true);
                    try {
                      const { error } = await supabase
                        .from('schedule_shifts')
                        .update({
                          confirmation_status: 'confirmed',
                          responsible_decision: 'rejected_cancel',
                          decided_at: new Date().toISOString(),
                          decided_by_responsible_id: currentUserId || null,
                          decline_reason: null,
                          decline_is_late: false,
                          declined_at: null
                        })
                        .eq('id', shift.id);
                      if (error) throw error;
                      onClose();
                    } catch (err) {
                      console.error('Error rejecting cancel:', err);
                      alert('Ошибка');
                    } finally {
                      setIsChangingDecision(false);
                    }
                  }}
                  disabled={isChangingDecision}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                >
                  Отклонить отказ
                </button>
              </div>
            </div>
          </div>
        )}

        {shift && shift.confirmation_status === 'pending' && (
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 text-amber-700 font-medium mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Ожидает подтверждения</span>
              </div>
              <div className="text-xs text-gray-600">
                Сотрудник ещё не подтвердил эту смену.
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleDuplicate}
          disabled={!!conflict || isSaving}
          className={`w-full py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
            conflict || isSaving
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600'
          }`}
        >
          <CopyPlus className="w-4 h-4" />
          <span>Дублировать на следующий день</span>
        </button>
          </div>
        </div>
      </div>
    </>
  );
}

interface EmployeeSelectorModalProps {
  employees: Employee[];
  positions: Position[];
  isEmployeeInBranch: (employeeId: string) => boolean;
  onSelect: (employeeId: string, positionId: string) => void;
  onClose: () => void;
}

function EmployeeSelectorModal({
  employees,
  positions,
  isEmployeeInBranch,
  onSelect,
  onClose
}: EmployeeSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set(positions.map(p => p.id)));

  const getEmployeeName = (emp: Employee) => {
    return `${emp.first_name}${emp.last_name ? ' ' + emp.last_name : ''}`;
  };

  const employeesByPosition = useMemo(() => {
    const grouped: Record<string, Employee[]> = {};
    positions.forEach(pos => {
      grouped[pos.id] = employees.filter(e => e.position_id === pos.id);
    });
    return grouped;
  }, [positions, employees]);

  const togglePosition = (posId: string) => {
    setExpandedPositions(prev => {
      const next = new Set(prev);
      if (next.has(posId)) {
        next.delete(posId);
      } else {
        next.add(posId);
      }
      return next;
    });
  };

  const filteredPositions = positions.filter(pos => {
    const emps = employeesByPosition[pos.id] || [];
    if (searchQuery) {
      return emps.some(e => getEmployeeName(e).toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return emps.length > 0;
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Выберите сотрудника</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск сотрудника..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredPositions.map(pos => {
            const emps = employeesByPosition[pos.id] || [];
            const filteredEmps = searchQuery
              ? emps.filter(e => getEmployeeName(e).toLowerCase().includes(searchQuery.toLowerCase()))
              : emps;

            if (filteredEmps.length === 0) return null;

            const isExpanded = expandedPositions.has(pos.id);

            return (
              <div key={pos.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePosition(pos.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-700">{pos.name}</span>
                    <span className="text-xs text-gray-400">({filteredEmps.length})</span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200">
                    {filteredEmps.map(emp => {
                      const isInBranch = isEmployeeInBranch(emp.id);
                      const empName = getEmployeeName(emp);
                      const isPendingDismissal = emp.current_status === 'pending_dismissal';

                      return (
                        <button
                          key={emp.id}
                          onClick={() => !isInBranch && onSelect(emp.id, pos.id)}
                          disabled={isInBranch}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                            isInBranch
                              ? 'bg-gray-50 cursor-not-allowed'
                              : 'hover:bg-blue-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {emp.photo_url ? (
                              <img
                                src={emp.photo_url}
                                alt={empName}
                                className={`w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 ${
                                  isInBranch ? 'border-gray-300 opacity-50' : 'border-gray-200'
                                }`}
                              />
                            ) : (
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isInBranch
                                  ? 'bg-gray-200'
                                  : isPendingDismissal
                                    ? 'bg-gradient-to-br from-amber-500 to-orange-500'
                                    : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                              }`}>
                                <User className={`w-5 h-5 ${isInBranch ? 'text-gray-400' : 'text-white'}`} />
                              </div>
                            )}
                            <div>
                              <div className={`font-medium ${isInBranch ? 'text-gray-400' : 'text-gray-900'}`}>
                                {empName}
                              </div>
                              {isPendingDismissal && emp.dismissal_date && (
                                <div className="text-xs text-amber-600">
                                  Увольнение: {new Date(emp.dismissal_date).toLocaleDateString('ru-RU')}
                                </div>
                              )}
                              {isInBranch && (
                                <div className="text-xs text-amber-600 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Уже в графике
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
