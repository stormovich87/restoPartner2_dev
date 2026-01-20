import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { AssignReplacementModal } from '../components/AssignReplacementModal';
import EmployeeKPIView from '../components/EmployeeKPIView';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
import {
  Home,
  Calendar,
  DollarSign,
  User,
  Bell,
  CheckSquare,
  Lock,
  LogIn,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Building2,
  Phone,
  Mail,
  AtSign,
  CreditCard,
  Briefcase,
  X,
  Users,
  Play,
  Square,
  Navigation,
  Loader2,
  LogOut,
  Timer,
  RefreshCw,
  Check,
  AlertTriangle,
  Pencil,
  TrendingUp
} from 'lucide-react';

interface Employee {
  id: string;
  partner_id: string;
  branch_id: string | null;
  position_id: string | null;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  telegram_username: string | null;
  telegram_user_id: string | null;
  bank_card_number: string | null;
  current_status: 'working' | 'on_vacation' | 'pending_dismissal' | 'fired';
  vacation_end_date: string | null;
  hire_date: string;
  is_active: boolean;
  photo_url: string | null;
  branch?: { id: string; name: string; address?: string | null } | null;
  position?: { id: string; name: string } | null;
  weeklyHours?: number;
  shiftOnSelectedDate?: {
    start_time: string;
    end_time: string;
    branch_name: string;
    total_minutes: number;
  } | null;
}

interface Partner {
  id: string;
  name: string;
  logo_url?: string | null;
}

interface Shift {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_minutes: number;
  branch_id: string;
  branch?: { id: string; name: string; address?: string | null; latitude?: number | null; longitude?: number | null } | null;
  status: 'scheduled' | 'opened' | 'closed';
  attendance_status?: 'scheduled' | 'opened' | 'closed' | 'late' | 'no_show' | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  late_minutes: number;
  no_show_at?: string | null;
  no_show_reason_text?: string | null;
  no_show_reason_status?: 'pending' | 'approved' | 'rejected' | null;
  work_segments?: WorkSegment[];
  close_reminder_message_id?: number | null;
  close_reminder_chat_id?: string | null;
  is_published?: boolean;
  confirmation_status?: 'not_required' | 'pending' | 'confirmed' | 'declined' | 'late_decline_pending' | 'partially_confirmed';
  confirmed_at?: string | null;
  declined_at?: string | null;
  decline_reason?: string | null;
  decline_is_late?: boolean;
  decided_by_responsible_id?: string | null;
  decided_at?: string | null;
  responsible_decision?: 'approved_cancel' | 'rejected_cancel' | null;
  assignment?: ShiftAssignment | null;
}

interface ShiftAssignment {
  id: string;
  shift_id: string;
  employee_id: string;
  partner_id: string;
  assignment_status: 'pending_confirm' | 'confirmed' | 'declined';
  confirmed_at: string | null;
  declined_at: string | null;
  decline_reason_id: string | null;
  decline_comment: string | null;
}

interface DeclineReason {
  id: string;
  reason_text: string;
  is_active: boolean;
}

interface EmployeeEvent {
  id: string;
  partner_id: string;
  employee_id: string;
  event_type: string;
  title: string;
  message: string;
  related_shift_id?: string | null;
  related_employee_id?: string | null;
  related_employee_photo_url?: string | null;
  related_employee_name?: string | null;
  related_branch_name?: string | null;
  related_shift_time?: string | null;
  no_show_reason_text?: string | null;
  action_type?: string | null;
  action_status?: string | null;
  action_taken_at?: string | null;
  telegram_message_id?: number | null;
  telegram_chat_id?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  replacement_employee_id?: string | null;
  replacement_employee_name?: string | null;
}

interface WorkSegment {
  id: string;
  shift_id: string;
  segment_start_at: string;
  segment_end_at: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  opened_with_location: boolean;
  closed_with_location: boolean;
}

interface ShiftSettings {
  shiftRequireLocation: boolean;
  shiftRequireLocationOnClose: boolean;
  shiftLocationRadius: number;
  shiftGraceMinutes: number;
  employeeBotToken: string | null;
}

interface ColleagueInfo {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  position?: { id: string; name: string } | null;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'opened' | 'closed';
  actual_start_at: string | null;
  actual_end_at: string | null;
  late_minutes: number;
  shift_id: string;
  work_segments?: WorkSegment[];
  worked_minutes?: number;
  auto_closed?: boolean;
  closed_by?: string;
}

type TabType = 'home' | 'schedule' | 'finances' | 'profile' | 'events' | 'tasks';
type ScheduleViewMode = 'week' | 'month';

const WEEKDAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const WEEKDAY_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function getWeekDays(date: Date): Date[] {
  const days: Date[] = [];
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);

  for (let i = 0; i < 7; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    days.push(current);
  }
  return days;
}

function getMonthWeeks(date: Date): Date[][] {
  const weeks: Date[][] = [];
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let currentWeek: Date[] = [];
  const current = new Date(firstDay);

  const firstDayOfWeek = current.getDay();
  const daysToSubtract = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  current.setDate(current.getDate() - daysToSubtract);

  while (current <= lastDay || currentWeek.length > 0) {
    currentWeek.push(new Date(current));

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
      if (current > lastDay) break;
    }
    current.setDate(current.getDate() + 1);
  }

  return weeks;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(time: string): string {
  return time.substring(0, 5);
}

function formatMinutesToDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}м`;
  if (mins === 0) return `${hours}ч`;
  return `${hours}ч ${mins}м`;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

function formatLateTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

interface LateTimerProps {
  plannedStartTime: string;
  graceMinutes: number;
  actualStartAt: string | null;
  lateMinutes: number;
  shiftDate: string;
}

function LateTimer({ plannedStartTime, graceMinutes, actualStartAt, lateMinutes, shiftDate }: LateTimerProps) {
  const [lateSeconds, setLateSeconds] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hasAnimated = useRef(false);

  const getPlannedStartWithGrace = useCallback(() => {
    const [hours, minutes] = plannedStartTime.split(':').map(Number);
    const plannedStart = new Date(shiftDate);
    plannedStart.setHours(hours, minutes + graceMinutes, 0, 0);
    return plannedStart;
  }, [plannedStartTime, graceMinutes, shiftDate]);

  useEffect(() => {
    if (actualStartAt) {
      const plannedStartWithGrace = getPlannedStartWithGrace();
      const actualStart = new Date(actualStartAt);

      if (actualStart < plannedStartWithGrace) {
        setLateSeconds(null);
        setIsVisible(false);
        return;
      }

      setLateSeconds(null);
      if (lateMinutes > 0) {
        if (!hasAnimated.current) {
          setTimeout(() => setIsVisible(true), 50);
          hasAnimated.current = true;
        } else {
          setIsVisible(true);
        }
      }
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const plannedStartWithGrace = getPlannedStartWithGrace();

      if (now < plannedStartWithGrace) {
        setLateSeconds(null);
        setIsVisible(false);
        return;
      }

      const diffMs = now.getTime() - plannedStartWithGrace.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      setLateSeconds(diffSeconds);

      if (!hasAnimated.current && diffSeconds >= 0) {
        setTimeout(() => setIsVisible(true), 50);
        hasAnimated.current = true;
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [actualStartAt, lateMinutes, getPlannedStartWithGrace]);

  if (actualStartAt && lateMinutes === 0) {
    return null;
  }

  if (!actualStartAt && lateSeconds === null) {
    return null;
  }

  const displayValue = actualStartAt
    ? `+${lateMinutes} мин`
    : lateSeconds !== null ? formatLateTime(lateSeconds) : '';

  return (
    <div
      className={`mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl transition-all duration-300 ease-out ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-1.5'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-700">
          <Timer className="w-5 h-5" />
          <span className="font-medium">Опоздание</span>
        </div>
        <div className="text-xl font-bold text-amber-700 tabular-nums">
          {displayValue}
        </div>
      </div>
    </div>
  );
}

export default function EmployeeCabinet() {
  const { employee_slug } = useParams<{ employee_slug: string }>();
  const slug = employee_slug;
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [showKPIView, setShowKPIView] = useState(false);
  const [homeKPIPercent, setHomeKPIPercent] = useState<number | null>(null);
  const [homeKPILoading, setHomeKPILoading] = useState(false);
  const [hasKPITemplate, setHasKPITemplate] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [scheduleViewMode, setScheduleViewMode] = useState<ScheduleViewMode>('week');
  const [scheduleAnchorDate, setScheduleAnchorDate] = useState(() => new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);

  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [colleagues, setColleagues] = useState<ColleagueInfo[]>([]);
  const [colleaguesLoading, setColleaguesLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<{ id: string; name: string; address?: string | null } | null>(null);
  const [staffCountByDate, setStaffCountByDate] = useState<Record<string, number>>({});
  const [selectedColleagueShift, setSelectedColleagueShift] = useState<ColleagueInfo | null>(null);
  const [shiftDetailsModalOpen, setShiftDetailsModalOpen] = useState(false);
  const [shiftVisibilityDays, setShiftVisibilityDays] = useState(2);

  const [events, setEvents] = useState<EmployeeEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [noShowReasons, setNoShowReasons] = useState<string[]>([]);
  const [noShowReasonsEnabled, setNoShowReasonsEnabled] = useState(false);
  const [showNoShowReasonModal, setShowNoShowReasonModal] = useState(false);
  const [selectedNoShowShift, setSelectedNoShowShift] = useState<Shift | null>(null);
  const [selectedNoShowReason, setSelectedNoShowReason] = useState<string>('');
  const [savingNoShowReason, setSavingNoShowReason] = useState(false);
  const [unreadEventsCount, setUnreadEventsCount] = useState(0);
  const [isCustomReasonMode, setIsCustomReasonMode] = useState(false);
  const [customNoShowReason, setCustomNoShowReason] = useState('');

  const [showReplacementModal, setShowReplacementModal] = useState(false);
  const [selectedReplacementShift, setSelectedReplacementShift] = useState<Shift | null>(null);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [selectedReplacementEmployee, setSelectedReplacementEmployee] = useState<string | null>(null);
  const [replacementStartTime, setReplacementStartTime] = useState('');
  const [assigningReplacement, setAssigningReplacement] = useState(false);

  const [showConfirmShiftModal, setShowConfirmShiftModal] = useState(false);
  const [selectedShiftForConfirm, setSelectedShiftForConfirm] = useState<Shift | null>(null);
  const [declineReasons, setDeclineReasons] = useState<DeclineReason[]>([]);
  const [confirmingShift, setConfirmingShift] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [selectedDeclineReason, setSelectedDeclineReason] = useState<string>('');
  const [declineComment, setDeclineComment] = useState('');
  const [showCancelShiftModal, setShowCancelShiftModal] = useState(false);
  const [cancelReasonText, setCancelReasonText] = useState('');
  const [confirmDeadlineHours, setConfirmDeadlineHours] = useState(24);
  const [lateCancelWarning, setLateCancelWarning] = useState(false);

  const [showAssignReplacementModal, setShowAssignReplacementModal] = useState(false);
  const [assignReplacementData, setAssignReplacementData] = useState<{
    shiftId: string;
    noShowEmployeeId: string;
    shiftDate: string;
    shiftStartTime: string;
    shiftEndTime: string;
    branchId: string;
    previousReplacementEmployeeId?: string;
  } | null>(null);
  const [lateDeclineEventId, setLateDeclineEventId] = useState<string | null>(null);
  const [noShowAlertEventId, setNoShowAlertEventId] = useState<string | null>(null);

  const [shiftSettings, setShiftSettings] = useState<ShiftSettings>({
    shiftRequireLocation: true,
    shiftRequireLocationOnClose: false,
    shiftLocationRadius: 50,
    shiftGraceMinutes: 0,
    employeeBotToken: null
  });
  const [shiftActionLoading, setShiftActionLoading] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      checkAuthentication(slug);
    }
  }, [slug]);

  useEffect(() => {
    if (employee && isAuthenticated) {
      loadShifts();
      loadPartner();
      loadEvents();
      loadDeclineReasons();
    }
  }, [employee, isAuthenticated, scheduleAnchorDate, scheduleViewMode]);

  useEffect(() => {
    if (employee && partner && isAuthenticated) {
      loadHomeKPI();
    }
  }, [employee, partner, isAuthenticated]);

  useEffect(() => {
    if (activeTab === 'events' && events.length > 0) {
      markAllEventsAsRead();
    }
  }, [activeTab, events.length]);

  useEffect(() => {
    if (!employee || !isAuthenticated) return;

    const channel = supabase
      .channel('employee_events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_events',
          filter: `employee_id=eq.${employee.id}`
        },
        (payload) => {
          console.log('Event change detected:', payload);
          if (payload.eventType === 'INSERT') {
            setEvents(prev => [payload.new as EmployeeEvent, ...prev]);
            if (!(payload.new as EmployeeEvent).is_read) {
              setUnreadEventsCount(prev => prev + 1);
            }
          } else if (payload.eventType === 'UPDATE') {
            setEvents(prev => {
              const oldEvent = prev.find(e => e.id === (payload.new as EmployeeEvent).id);
              const newEvents = prev.map(e =>
                e.id === (payload.new as EmployeeEvent).id ? payload.new as EmployeeEvent : e
              );

              if (oldEvent && !oldEvent.is_read && (payload.new as EmployeeEvent).is_read) {
                setUnreadEventsCount(c => Math.max(0, c - 1));
              } else if (oldEvent && oldEvent.is_read && !(payload.new as EmployeeEvent).is_read) {
                setUnreadEventsCount(c => c + 1);
              }

              return newEvents;
            });
          } else if (payload.eventType === 'DELETE') {
            setEvents(prev => {
              const deletedEvent = prev.find(e => e.id === (payload.old as { id: string }).id);
              if (deletedEvent && !deletedEvent.is_read) {
                setUnreadEventsCount(c => Math.max(0, c - 1));
              }
              return prev.filter(e => e.id !== (payload.old as { id: string }).id);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employee, isAuthenticated]);

  const checkAuthentication = async (employeeSlug: string) => {
    setAuthLoading(true);

    const savedAuth = localStorage.getItem(`employee_auth_${employeeSlug}`);
    if (savedAuth) {
      try {
        const { employeeId, expiry } = JSON.parse(savedAuth);
        if (expiry > Date.now()) {
          const { data: employeeData } = await supabase
            .from('employees')
            .select(`
              id, partner_id, branch_id, position_id, first_name, last_name,
              phone, email, telegram_username, telegram_user_id, bank_card_number,
              current_status, vacation_end_date, hire_date, is_active, photo_url,
              branch:branches(id, name, address),
              position:positions(id, name)
            `)
            .eq('id', employeeId)
            .eq('cabinet_slug', employeeSlug)
            .maybeSingle();

          if (employeeData && employeeData.is_active && employeeData.current_status !== 'fired') {
            setEmployee(employeeData as Employee);
            setIsAuthenticated(true);
            setAuthLoading(false);
            setLoading(false);
            return;
          }
        }
        localStorage.removeItem(`employee_auth_${employeeSlug}`);
      } catch {
        localStorage.removeItem(`employee_auth_${employeeSlug}`);
      }
    }

    const { data: employeeExists } = await supabase
      .from('employees')
      .select('id, is_active, current_status, cabinet_login')
      .eq('cabinet_slug', employeeSlug)
      .maybeSingle();

    if (!employeeExists) {
      setError('not_found');
      setAuthLoading(false);
      setLoading(false);
      return;
    }

    if (!employeeExists.is_active || employeeExists.current_status === 'fired') {
      setError('not_active');
      setAuthLoading(false);
      setLoading(false);
      return;
    }

    if (!employeeExists.cabinet_login) {
      setError('no_credentials');
      setAuthLoading(false);
      setLoading(false);
      return;
    }

    setAuthLoading(false);
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;

    setLoginError('');
    setLoginLoading(true);

    const { data: employeeData, error: loginErr } = await supabase
      .from('employees')
      .select(`
        id, partner_id, branch_id, position_id, first_name, last_name,
        phone, email, telegram_username, telegram_user_id, bank_card_number,
        current_status, vacation_end_date, hire_date, is_active, photo_url,
        branch:branches(id, name, address),
        position:positions(id, name)
      `)
      .eq('cabinet_slug', slug)
      .eq('cabinet_login', loginForm.login)
      .eq('cabinet_password', loginForm.password)
      .maybeSingle();

    if (loginErr || !employeeData) {
      setLoginError('Неверный логин или пароль');
      setLoginLoading(false);
      return;
    }

    if (!employeeData.is_active || employeeData.current_status === 'fired') {
      setLoginError('Ваш аккаунт деактивирован');
      setLoginLoading(false);
      return;
    }

    const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(`employee_auth_${slug}`, JSON.stringify({
      employeeId: employeeData.id,
      expiry
    }));

    setEmployee(employeeData as Employee);
    setIsAuthenticated(true);
    setLoginLoading(false);
  };

  const loadPartner = async () => {
    if (!employee) return;

    const [partnerRes, settingsRes] = await Promise.all([
      supabase
        .from('partners')
        .select('id, name, logo_url')
        .eq('id', employee.partner_id)
        .maybeSingle(),
      supabase
        .from('partner_settings')
        .select('employee_shift_visibility_days, shift_require_location, shift_location_radius_meters, shift_grace_minutes, require_location_on_shift_close, employee_bot_token, no_show_reasons_enabled, no_show_reasons, schedule_confirm_deadline_hours')
        .eq('partner_id', employee.partner_id)
        .maybeSingle()
    ]);

    if (partnerRes.data) {
      setPartner(partnerRes.data);
    }

    if (settingsRes.data) {
      setShiftVisibilityDays(settingsRes.data.employee_shift_visibility_days || 2);
      setShiftSettings({
        shiftRequireLocation: settingsRes.data.shift_require_location ?? true,
        shiftRequireLocationOnClose: settingsRes.data.require_location_on_shift_close ?? false,
        shiftLocationRadius: settingsRes.data.shift_location_radius_meters ?? 50,
        shiftGraceMinutes: settingsRes.data.shift_grace_minutes ?? 0,
        employeeBotToken: settingsRes.data.employee_bot_token || null
      });
      setNoShowReasonsEnabled(settingsRes.data.no_show_reasons_enabled || false);
      setNoShowReasons(settingsRes.data.no_show_reasons || []);
      setConfirmDeadlineHours(settingsRes.data.schedule_confirm_deadline_hours || 24);
    }
  };

  const loadEvents = async () => {
    if (!employee) return;

    setEventsLoading(true);
    try {
      const { data, error } = await supabase
        .from('employee_events')
        .select('*')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setEvents(data || []);
      setUnreadEventsCount(data?.filter(e => !e.is_read).length || 0);
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setEventsLoading(false);
    }
  };

  const markEventAsRead = async (eventId: string) => {
    const { error } = await supabase
      .from('employee_events')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', eventId);

    if (!error) {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, is_read: true, read_at: new Date().toISOString() } : e));
      setUnreadEventsCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllEventsAsRead = useCallback(async () => {
    if (!employee) return;

    setEvents(prev => {
      const unreadEvents = prev.filter(e => !e.is_read);
      if (unreadEvents.length === 0) return prev;

      const unreadEventIds = unreadEvents.map(e => e.id);

      supabase
        .from('employee_events')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', unreadEventIds)
        .then(() => {
          setUnreadEventsCount(0);
        });

      return prev.map(e =>
        unreadEventIds.includes(e.id)
          ? { ...e, is_read: true, read_at: new Date().toISOString() }
          : e
      );
    });
  }, [employee]);

  const handleEventAction = async (eventId: string, shiftId: string, action: 'approve' | 'reject') => {
    const event = events.find(e => e.id === eventId);
    if (!event || !employee) return;

    const now = new Date().toISOString();

    const shiftUpdate: Record<string, unknown> = action === 'approve'
      ? {
          no_show_reason_status: 'approved',
          no_show_approved_by: employee.id,
          no_show_approved_at: now,
        }
      : {
          no_show_reason_status: 'rejected',
          no_show_rejected_by: employee.id,
          no_show_rejected_at: now,
        };

    const { error: shiftError } = await supabase
      .from('schedule_shifts')
      .update(shiftUpdate)
      .eq('id', shiftId);

    if (shiftError) {
      console.error('Error updating shift:', shiftError);
      return;
    }

    const { error: eventError } = await supabase
      .from('employee_events')
      .update({
        action_status: action === 'approve' ? 'approved' : 'rejected',
        action_taken_at: now,
        is_read: true,
        read_at: now,
      })
      .eq('id', eventId);

    if (!eventError) {
      setEvents(prev => prev.map(e =>
        e.id === eventId
          ? { ...e, action_status: action === 'approve' ? 'approved' : 'rejected', action_taken_at: now, is_read: true, read_at: now }
          : e
      ));
      setUnreadEventsCount(prev => Math.max(0, prev - 1));
    }

    if (event.related_employee_id && event.no_show_reason_text) {
      const { data: noShowEmployee } = await supabase
        .from('employees')
        .select('id, telegram_user_id, first_name, last_name')
        .eq('id', event.related_employee_id)
        .maybeSingle();

      if (noShowEmployee) {
        const responsibleName = `${employee.first_name}${employee.last_name ? ' ' + employee.last_name : ''}`;
        const eventType = action === 'approve' ? 'no_show_approved' : 'no_show_rejected';
        const eventTitle = action === 'approve' ? 'Причина одобрена' : 'Причина отклонена';
        const eventMessage = action === 'approve'
          ? `Ваша причина не выхода на смену одобрена ответственным ${responsibleName}`
          : `Ваша причина не выхода на смену отклонена ответственным ${responsibleName}. Обратитесь к руководству для уточнения.`;

        await supabase.from('employee_events').insert({
          partner_id: employee.partner_id,
          employee_id: noShowEmployee.id,
          event_type: eventType,
          title: eventTitle,
          message: eventMessage,
          related_shift_id: shiftId,
          no_show_reason_text: event.no_show_reason_text,
        });

        if (shiftSettings.employeeBotToken && noShowEmployee.telegram_user_id) {
          const telegramMessage = action === 'approve'
            ? `<b>Причина одобрена</b>\n\n` +
              `Ваша причина не выхода на смену одобрена.\n\n` +
              `<b>Причина:</b> ${event.no_show_reason_text}\n` +
              `<b>Ответственный:</b> ${responsibleName}`
            : `<b>Причина отклонена</b>\n\n` +
              `Ваша причина не выхода на смену отклонена.\n\n` +
              `<b>Причина:</b> ${event.no_show_reason_text}\n` +
              `<b>Ответственный:</b> ${responsibleName}\n\n` +
              `<i>Обратитесь к руководству для уточнения.</i>`;

          try {
            await supabase.functions.invoke('send-telegram-message', {
              body: {
                bot_token: shiftSettings.employeeBotToken,
                chat_id: noShowEmployee.telegram_user_id,
                message: telegramMessage,
              }
            });
          } catch (err) {
            console.error('Error sending notification to employee:', err);
          }
        }
      }
    }
  };

  const handleChangeDecision = async (eventId: string) => {
    const { error } = await supabase
      .from('employee_events')
      .update({
        action_status: 'pending',
        action_taken_at: null,
      })
      .eq('id', eventId);

    if (!error) {
      setEvents(prev => prev.map(e =>
        e.id === eventId
          ? { ...e, action_status: 'pending', action_taken_at: null }
          : e
      ));
    }
  };

  const handleApproveLateDecline = async (event: EmployeeEvent) => {
    if (!event.related_shift_id || !event.related_employee_id || !employee) return;

    const now = new Date().toISOString();

    const { data: shiftData } = await supabase
      .from('schedule_shifts')
      .select('*, branch:branches(name)')
      .eq('id', event.related_shift_id)
      .maybeSingle();

    if (!shiftData) return;

    const { error: shiftError } = await supabase
      .from('schedule_shifts')
      .update({
        staff_member_id: null,
        confirmation_status: 'declined',
        decided_by_responsible_id: employee.id,
        decided_at: now,
        responsible_decision: 'approved_cancel',
      })
      .eq('id', event.related_shift_id);

    if (shiftError) {
      console.error('Error updating shift:', shiftError);
      alert('Ошибка при одобрении отказа: ' + shiftError.message);
      return;
    }

    await supabase
      .from('employee_events')
      .update({
        action_status: 'decline_approved',
        action_taken_at: now,
        is_read: true,
        read_at: now,
      })
      .eq('id', event.id);

    setEvents(prev => prev.map(e =>
      e.id === event.id
        ? { ...e, action_status: 'decline_approved', action_taken_at: now, is_read: true, read_at: now }
        : e
    ));

    // Reload shifts to update UI
    loadShifts();

    const { data: declinedEmployee } = await supabase
      .from('employees')
      .select('id, first_name, last_name, telegram_user_id, partner_id')
      .eq('id', event.related_employee_id)
      .maybeSingle();

    if (declinedEmployee) {
      const responsibleName = `${employee.first_name}${employee.last_name ? ' ' + employee.last_name : ''}`;
      const shiftDateFormatted = new Date(shiftData.date).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long'
      });
      const shiftTime = `${shiftData.start_time.slice(0, 5)} - ${shiftData.end_time.slice(0, 5)}`;

      await supabase.from('employee_events').insert({
        partner_id: declinedEmployee.partner_id,
        employee_id: declinedEmployee.id,
        event_type: 'late_decline_approved',
        title: 'Отказ от смены одобрен',
        message: `Ваш отказ от смены ${shiftDateFormatted}, ${shiftTime} одобрен ответственным ${responsibleName}`,
        related_shift_id: event.related_shift_id,
        related_branch_name: shiftData.branch?.name || null,
        related_shift_time: `${shiftDateFormatted}, ${shiftTime}`,
      });

      if (declinedEmployee.telegram_user_id && shiftSettings.employeeBotToken) {
        const telegramMessage =
          `<b>Отказ от смены одобрен</b>\n\n` +
          `Ваш отказ от смены <b>${shiftDateFormatted}, ${shiftTime}</b> одобрен.\n` +
          `Ответственный: ${responsibleName}`;

        try {
          await supabase.functions.invoke('send-telegram-message', {
            body: {
              bot_token: shiftSettings.employeeBotToken,
              chat_id: declinedEmployee.telegram_user_id,
              message: telegramMessage,
              parse_mode: 'HTML'
            }
          });
        } catch (err) {
          console.error('Error sending telegram notification:', err);
        }
      }
    }
  };

  const [showEtaModal, setShowEtaModal] = useState(false);
  const [selectedUrgentEvent, setSelectedUrgentEvent] = useState<EmployeeEvent | null>(null);
  const [acceptingShift, setAcceptingShift] = useState(false);

  const handleAcceptUrgentShift = (event: EmployeeEvent) => {
    setSelectedUrgentEvent(event);
    setShowEtaModal(true);
  };

  const handleSelectEta = async (etaMinutes: number) => {
    if (!selectedUrgentEvent || !selectedUrgentEvent.related_shift_id || !employee) return;

    setAcceptingShift(true);
    try {
      const { data: shift, error: shiftError } = await supabase
        .from('schedule_shifts')
        .select('id, replacement_status, replacement_employee_id, partner_id, branch_id, date, start_time, end_time, staff_member_id, position_id')
        .eq('id', selectedUrgentEvent.related_shift_id)
        .maybeSingle();

      if (shiftError) {
        console.error('Error fetching shift:', shiftError);
        alert('Ошибка при загрузке смены');
        return;
      }

      if (!shift) {
        alert('Смена не найдена');
        return;
      }

      if (shift.replacement_status === 'accepted' && shift.replacement_employee_id !== employee.id) {
        alert('Смена уже принята другим сотрудником');
        setEvents(prev => prev.map(e =>
          e.id === selectedUrgentEvent.id
            ? { ...e, action_status: 'cancelled', is_read: true, read_at: new Date().toISOString() }
            : e
        ));
        setShowEtaModal(false);
        setSelectedUrgentEvent(null);
        return;
      }

      const now = new Date().toISOString();

      const { error: updateError, count } = await supabase
        .from('schedule_shifts')
        .update({
          replacement_status: 'accepted',
          replacement_employee_id: employee.id,
          replacement_accepted_at: now,
          replacement_eta_minutes: etaMinutes,
        })
        .eq('id', shift.id)
        .eq('replacement_status', 'offered');

      if (updateError || count === 0) {
        alert('Смена уже принята другим сотрудником');
        return;
      }

      await supabase
        .from('employee_events')
        .update({
          action_status: 'accepted',
          action_taken_at: now,
          is_read: true,
          read_at: now,
        })
        .eq('id', selectedUrgentEvent.id);

      const noShowEmployeeId = shift.staff_member_id;
      let noShowEmployeePositionId = shift.position_id;

      if (noShowEmployeeId && !noShowEmployeePositionId) {
        const { data: noShowEmployee } = await supabase
          .from('employees')
          .select('position_id')
          .eq('id', noShowEmployeeId)
          .maybeSingle();
        noShowEmployeePositionId = noShowEmployee?.position_id;
      }

      const { data: existingRow } = await supabase
        .from('schedule_rows')
        .select('id')
        .eq('partner_id', shift.partner_id)
        .eq('branch_id', shift.branch_id)
        .eq('staff_member_id', employee.id)
        .maybeSingle();

      if (!existingRow) {
        await supabase
          .from('schedule_rows')
          .insert({
            partner_id: shift.partner_id,
            branch_id: shift.branch_id,
            staff_member_id: employee.id,
            position_id: noShowEmployeePositionId || employee.position_id,
          });
      }

      const timeToMinutes = (timeStr: string): number => {
        const [hours, mins] = timeStr.split(':').map(Number);
        return hours * 60 + mins;
      };

      const addMinutesToTime = (timeStr: string, minutes: number): string => {
        const totalMinutes = timeToMinutes(timeStr) + minutes;
        const newHours = Math.floor(totalMinutes / 60) % 24;
        const newMins = totalMinutes % 60;
        return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
      };

      const newStartTime = addMinutesToTime(shift.start_time, etaMinutes);

      const startMinutes = timeToMinutes(newStartTime);
      const endMinutes = timeToMinutes(shift.end_time);
      const totalShiftMinutes = endMinutes >= startMinutes
        ? endMinutes - startMinutes
        : (24 * 60 - startMinutes) + endMinutes;

      const { data: existingShift } = await supabase
        .from('schedule_shifts')
        .select('id')
        .eq('staff_member_id', employee.id)
        .eq('branch_id', shift.branch_id)
        .eq('date', shift.date)
        .maybeSingle();

      if (existingShift) {
        const { error: updateExistingError } = await supabase
          .from('schedule_shifts')
          .update({
            start_time: newStartTime,
            end_time: shift.end_time,
            total_minutes: totalShiftMinutes,
            status: 'scheduled',
            attendance_status: 'scheduled',
            is_replacement: true,
            original_shift_id: shift.id,
            position_id: noShowEmployeePositionId || employee.position_id,
          })
          .eq('id', existingShift.id);

        if (updateExistingError) {
          console.error('Error updating existing shift:', updateExistingError);
        }
      } else {
        const { error: insertError } = await supabase
          .from('schedule_shifts')
          .insert({
            partner_id: shift.partner_id,
            branch_id: shift.branch_id,
            staff_member_id: employee.id,
            position_id: noShowEmployeePositionId || employee.position_id,
            date: shift.date,
            start_time: newStartTime,
            end_time: shift.end_time,
            total_minutes: totalShiftMinutes,
            status: 'scheduled',
            attendance_status: 'scheduled',
            is_replacement: true,
            original_shift_id: shift.id,
          });

        if (insertError) {
          console.error('Error inserting replacement shift:', insertError);
          alert('Ошибка при создании смены');
          return;
        }
      }

      if (noShowEmployeeId) {
        await supabase
          .from('schedule_shifts')
          .update({
            staff_member_id: null,
            attendance_status: 'no_show',
          })
          .eq('id', shift.id);
      }

      setEvents(prev => prev.map(e =>
        e.id === selectedUrgentEvent.id
          ? { ...e, action_status: 'accepted', action_taken_at: now, is_read: true, read_at: now }
          : e
      ));
      setUnreadEventsCount(prev => Math.max(0, prev - 1));
      setShowEtaModal(false);
      setSelectedUrgentEvent(null);

      alert(`Вы приняли смену! Ожидаемое время прибытия: ${etaMinutes} минут`);
      loadShifts();
    } catch (err) {
      console.error('Error accepting urgent shift:', err);
      alert('Ошибка при принятии смены');
    } finally {
      setAcceptingShift(false);
    }
  };

  const saveNoShowReason = async () => {
    const reasonToSave = isCustomReasonMode ? customNoShowReason : selectedNoShowReason;
    if (!selectedNoShowShift || !reasonToSave || !employee) return;

    setSavingNoShowReason(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('schedule_shifts')
        .update({
          no_show_reason_text: reasonToSave,
          no_show_reason_selected_at: now,
          no_show_reason_status: 'pending',
        })
        .eq('id', selectedNoShowShift.id);

      if (error) throw error;

      const { data: responsibleEmployees, error: respError } = await supabase
        .from('partner_settings')
        .select('no_show_responsible_employee_ids')
        .eq('partner_id', employee.partner_id)
        .maybeSingle();

      if (!respError && responsibleEmployees?.no_show_responsible_employee_ids) {
        const employeeIds = responsibleEmployees.no_show_responsible_employee_ids;

        const shiftDate = new Date(selectedNoShowShift.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        const shiftTime = `${selectedNoShowShift.start_time?.slice(0, 5)} - ${selectedNoShowShift.end_time?.slice(0, 5)}`;
        const employeeName = `${employee.first_name}${employee.last_name ? ' ' + employee.last_name : ''}`;
        const branchName = selectedNoShowShift.branch?.name || 'Филиал';

        const { data: responsibleEmpData } = await supabase
          .from('employees')
          .select('id, telegram_user_id')
          .in('id', employeeIds)
          .eq('is_active', true);

        const eventsToInsert = employeeIds.map(responsibleId => ({
          partner_id: employee.partner_id,
          employee_id: responsibleId,
          event_type: 'no_show',
          title: 'Не выход на смену',
          message: `${employeeName} не вышел на смену`,
          related_shift_id: selectedNoShowShift.id,
          related_employee_id: employee.id,
          related_employee_name: employeeName,
          related_employee_photo_url: employee.photo_url,
          related_branch_name: branchName,
          related_shift_time: `${shiftDate}, ${shiftTime}`,
          no_show_reason_text: reasonToSave,
          action_type: 'approve_reject',
          action_status: 'pending',
        }));

        const { data: insertedEvents } = await supabase
          .from('employee_events')
          .insert(eventsToInsert)
          .select('id, employee_id');

        if (shiftSettings.employeeBotToken && insertedEvents && responsibleEmpData) {
          const messageText =
            `<b>Не выход на смену</b>\n\n` +
            `<b>${employeeName}</b>\n` +
            `Филиал: ${branchName}\n` +
            `Смена: ${shiftDate}, ${shiftTime}\n\n` +
            `<b>Причина:</b> ${reasonToSave}\n\n` +
            `<i>Принять или отклонить причину можно в личном кабинете во вкладке "События"</i>`;

          const sendPromises = responsibleEmpData
            .filter(emp => emp.telegram_user_id)
            .map(async (emp) => {
              const event = insertedEvents.find(e => e.employee_id === emp.id);
              if (!event) return;

              try {
                const response = await supabase.functions.invoke('send-telegram-message', {
                  body: {
                    bot_token: shiftSettings.employeeBotToken,
                    chat_id: emp.telegram_user_id,
                    message: messageText,
                  }
                });

                if (response.data?.telegram_response?.result?.message_id) {
                  await supabase
                    .from('employee_events')
                    .update({
                      telegram_message_id: response.data.telegram_response.result.message_id,
                      telegram_chat_id: emp.telegram_user_id,
                    })
                    .eq('id', event.id);
                }
              } catch (err) {
                console.error('Error sending notification:', err);
              }
            });

          await Promise.allSettled(sendPromises);
        }
      }

      setShifts(prev => prev.map(s =>
        s.id === selectedNoShowShift.id
          ? { ...s, no_show_reason_text: reasonToSave, no_show_reason_status: 'pending' }
          : s
      ));
      setShowNoShowReasonModal(false);
      setSelectedNoShowShift(null);
      setSelectedNoShowReason('');
      setIsCustomReasonMode(false);
      setCustomNoShowReason('');
      alert('Причина отправлена ответственным сотрудникам');
    } catch (err) {
      console.error('Error saving no-show reason:', err);
      alert('Ошибка при сохранении причины');
    } finally {
      setSavingNoShowReason(false);
    }
  };

  const loadAllEmployees = async (excludeEmployeeId?: string, shiftDate?: string) => {
    if (!employee) return;

    const dateToCheck = shiftDate || selectedReplacementShift?.date;

    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          id, first_name, last_name, phone, photo_url, position_id, branch_id, is_active,
          position:positions(id, name),
          branch:branches(id, name)
        `)
        .eq('partner_id', employee.partner_id)
        .eq('is_active', true)
        .neq('id', excludeEmployeeId || employee.id)
        .order('first_name');

      if (error) throw error;

      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const employeesWithStats = await Promise.all(
        (data || []).map(async (emp) => {
          const { data: weekShifts } = await supabase
            .from('schedule_shifts')
            .select('total_minutes')
            .eq('staff_member_id', emp.id)
            .gte('date', startOfWeek.toISOString().split('T')[0])
            .lte('date', endOfWeek.toISOString().split('T')[0]);

          const weeklyMinutes = weekShifts?.reduce((sum, shift) => sum + (shift.total_minutes || 0), 0) || 0;
          const weeklyHours = Math.round((weeklyMinutes / 60) * 10) / 10;

          let shiftOnSelectedDate = null;
          if (dateToCheck) {
            const { data: dayShift } = await supabase
              .from('schedule_shifts')
              .select('start_time, end_time, total_minutes, branch:branches(name)')
              .eq('staff_member_id', emp.id)
              .eq('date', dateToCheck)
              .maybeSingle();

            if (dayShift) {
              shiftOnSelectedDate = {
                start_time: dayShift.start_time,
                end_time: dayShift.end_time,
                branch_name: dayShift.branch?.name || 'Неизвестно',
                total_minutes: dayShift.total_minutes || 0,
              };
            }
          }

          return {
            ...emp,
            weeklyHours,
            shiftOnSelectedDate,
          };
        })
      );

      setAllEmployees(employeesWithStats);
    } catch (err) {
      console.error('Error loading employees:', err);
    }
  };

  const assignReplacement = async () => {
    if (!selectedReplacementShift || !selectedReplacementEmployee || !replacementStartTime || !employee) return;

    setAssigningReplacement(true);
    try {
      const { data: replacementEmp } = await supabase
        .from('employees')
        .select('id, first_name, last_name, telegram_user_id, position_id, position:positions(name)')
        .eq('id', selectedReplacementEmployee)
        .maybeSingle();

      if (!replacementEmp) {
        alert('Сотрудник не найден');
        return;
      }

      const startParts = replacementStartTime.split(':');
      const endParts = selectedReplacementShift.end_time.split(':');
      const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
      const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
      const totalMinutes = endMinutes - startMinutes;

      const newShift = {
        staff_member_id: selectedReplacementEmployee,
        date: selectedReplacementShift.date,
        start_time: replacementStartTime,
        end_time: selectedReplacementShift.end_time,
        total_minutes: totalMinutes,
        branch_id: selectedReplacementShift.branch_id,
        partner_id: employee.partner_id,
        position_id: replacementEmp.position_id,
        is_replacement: true,
        status: 'scheduled',
        original_shift_id: selectedReplacementShift.id,
      };

      const { error: insertError } = await supabase
        .from('schedule_shifts')
        .insert(newShift);

      if (insertError) {
        console.error('Insert error details:', insertError);
        throw insertError;
      }

      const shiftDate = new Date(selectedReplacementShift.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      const shiftTime = `${replacementStartTime.slice(0, 5)} - ${selectedReplacementShift.end_time.slice(0, 5)}`;
      const employeeName = `${employee.first_name}${employee.last_name ? ' ' + employee.last_name : ''}`;
      const branchName = selectedReplacementShift.branch?.name || 'Филиал';
      const replacementName = `${replacementEmp.first_name}${replacementEmp.last_name ? ' ' + replacementEmp.last_name : ''}`;

      const eventData = {
        partner_id: employee.partner_id,
        employee_id: selectedReplacementEmployee,
        event_type: 'replacement_assigned',
        title: 'Назначена подмена',
        message: `Вы назначены на подмену вместо ${employeeName}`,
        related_branch_name: branchName,
        related_shift_time: `${shiftDate}, ${shiftTime}`,
        related_employee_id: employee.id,
        related_employee_name: employeeName,
        related_employee_photo_url: employee.photo_url,
      };

      await supabase.from('employee_events').insert(eventData);

      if (shiftSettings.employeeBotToken && replacementEmp.telegram_user_id) {
        const telegramMessage =
          `<b>🔄 Назначена подмена</b>\n\n` +
          `Вы назначены на подмену вместо <b>${employeeName}</b>\n\n` +
          `<b>Филиал:</b> ${branchName}\n` +
          `<b>Дата:</b> ${shiftDate}\n` +
          `<b>Время:</b> ${shiftTime}\n` +
          `<b>Должность:</b> ${replacementEmp.position?.name || 'Не указана'}`;

        try {
          await supabase.functions.invoke('send-telegram-message', {
            body: {
              bot_token: shiftSettings.employeeBotToken,
              chat_id: replacementEmp.telegram_user_id,
              message: telegramMessage,
            }
          });
        } catch (telegramErr) {
          console.error('Error sending telegram message:', telegramErr);
        }
      }

      setShowReplacementModal(false);
      setSelectedReplacementShift(null);
      setSelectedReplacementEmployee(null);
      setReplacementStartTime('');
      alert(`Подмена назначена на ${replacementName}`);
      loadShifts();
    } catch (err) {
      console.error('Error assigning replacement:', err);
      alert('Ошибка при назначении подмены');
    } finally {
      setAssigningReplacement(false);
    }
  };

  const loadHomeKPI = async () => {
    if (!employee || !partner) return;

    setHomeKPILoading(true);
    try {
      const { data: templates } = await supabase
        .from('kpi_templates')
        .select(`
          id, branch_id, position_id, minimum_total_kpi_percent,
          kpi_template_sections (
            id, minimum_section_percent,
            kpi_template_indicators (
              id, indicator_key, is_enabled, minimum_indicator_percent,
              trigger_types, trigger_limit
            )
          )
        `)
        .eq('partner_id', partner.id);

      const template = templates?.find(t => {
        const positionMatch = t.position_id === employee.position_id;
        const branchMatch = t.branch_id === null || t.branch_id === employee.branch_id;
        return positionMatch && branchMatch;
      }) || templates?.find(t =>
        t.branch_id === employee.branch_id && t.position_id === employee.position_id
      );

      if (!template) {
        setHasKPITemplate(false);
        setHomeKPIPercent(null);
        return;
      }

      setHasKPITemplate(true);

      const { data: period } = await supabase
        .from('kpi_payroll_periods')
        .select('*')
        .eq('partner_id', partner.id)
        .eq('status', 'active')
        .single();

      if (!period) {
        setHomeKPIPercent(100);
        return;
      }

      const periodStartTime = period.period_start.includes('T')
        ? period.period_start
        : `${period.period_start}T00:00:00`;
      const periodEndTime = period.closed_at ||
        `${period.period_end.split('T')[0]}T23:59:59`;

      const { data: noShowShifts } = await supabase
        .from('schedule_shifts')
        .select('id, no_show_at, no_show_reason_status, confirmed_at')
        .eq('partner_id', partner.id)
        .eq('staff_member_id', employee.id)
        .not('no_show_at', 'is', null)
        .gte('no_show_at', periodStartTime)
        .lte('no_show_at', periodEndTime);

      const filteredNoShows = (noShowShifts || []).filter((s: any) =>
        s.no_show_reason_status !== 'approved'
      );

      const noShowsUnconfirmed = filteredNoShows.filter((s: any) => !s.confirmed_at);

      const { data: unconfirmedShifts } = await supabase
        .from('schedule_shifts')
        .select('id, confirmed_at, work_segments(id)')
        .eq('partner_id', partner.id)
        .eq('staff_member_id', employee.id)
        .in('confirmation_status', ['pending', 'partially_confirmed'])
        .gte('created_at', periodStartTime)
        .lte('created_at', periodEndTime);

      const unconfirmedClosed = (unconfirmedShifts || []).filter((s: any) =>
        !s.confirmed_at && s.work_segments && s.work_segments.length > 0
      );

      const triggerCounts: Record<string, number> = {
        'no_show': filteredNoShows.length,
        'unconfirmed_open_shift': noShowsUnconfirmed.length,
        'unconfirmed_closed_shift': unconfirmedClosed.length
      };

      let sectionPercentsRaw: number[] = [];

      template.kpi_template_sections?.forEach((section: any) => {
        let indicatorPercents: number[] = [];

        section.kpi_template_indicators?.forEach((indicator: any) => {
          if (!indicator.is_enabled) return;

          let triggerCount = 0;
          indicator.trigger_types?.forEach((tt: string) => {
            triggerCount += triggerCounts[tt] || 0;
          });

          let percentRaw = 100;
          if (indicator.trigger_limit > 0) {
            const step = 100 / indicator.trigger_limit;
            percentRaw = Math.max(0, Math.min(100, 100 - triggerCount * step));
          } else if (indicator.trigger_limit === 0 && triggerCount > 0) {
            percentRaw = 0;
          }

          const finalPercent = percentRaw < indicator.minimum_indicator_percent ? 0 : percentRaw;
          indicatorPercents.push(finalPercent);
        });

        if (indicatorPercents.length > 0) {
          const sectionPercentRaw = indicatorPercents.reduce((a, b) => a + b, 0) / indicatorPercents.length;
          const sectionPercent = sectionPercentRaw < section.minimum_section_percent ? 0 : sectionPercentRaw;
          sectionPercentsRaw.push(sectionPercent);
        }
      });

      const totalPercentRaw = sectionPercentsRaw.length > 0
        ? sectionPercentsRaw.reduce((a, b) => a + b, 0) / sectionPercentsRaw.length
        : 100;

      const overallKPI = totalPercentRaw < template.minimum_total_kpi_percent ? 0 : totalPercentRaw;
      setHomeKPIPercent(Math.round(overallKPI));
    } catch (error) {
      console.error('Error loading home KPI:', error);
      setHasKPITemplate(false);
      setHomeKPIPercent(null);
    } finally {
      setHomeKPILoading(false);
    }
  };

  const loadShifts = async () => {
    if (!employee) return;

    setShiftsLoading(true);
    try {
      let startDate: string;
      let endDate: string;

      if (scheduleViewMode === 'week') {
        const days = getWeekDays(scheduleAnchorDate);
        startDate = formatDateKey(days[0]);
        endDate = formatDateKey(days[6]);
      } else {
        const year = scheduleAnchorDate.getFullYear();
        const month = scheduleAnchorDate.getMonth();
        startDate = formatDateKey(new Date(year, month, 1));
        endDate = formatDateKey(new Date(year, month + 1, 0));
      }

      const { data, error } = await supabase
        .from('schedule_shifts')
        .select(`
          id, date, start_time, end_time, total_minutes, branch_id,
          status, attendance_status, actual_start_at, actual_end_at, late_minutes,
          no_show_at, no_show_reason_text, no_show_reason_status,
          close_reminder_message_id, close_reminder_chat_id,
          is_published, confirmation_status, confirmed_at, declined_at,
          decline_reason, decline_is_late, decided_by_responsible_id, decided_at, responsible_decision,
          branch:branches(id, name, address, latitude, longitude)
        `)
        .eq('staff_member_id', employee.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;

      let shiftsData = data || [];

      if (shiftsData.length > 0) {
        const shiftIds = shiftsData.map(s => s.id);

        const [segmentsRes, assignmentsRes] = await Promise.all([
          supabase
            .from('work_segments')
            .select('*')
            .in('shift_id', shiftIds)
            .order('segment_start_at', { ascending: true }),
          supabase
            .from('schedule_shift_assignments')
            .select('*')
            .in('shift_id', shiftIds)
            .eq('employee_id', employee.id)
        ]);

        const segmentsData = segmentsRes.data || [];
        const assignmentsData = assignmentsRes.data || [];

        const segmentsByShift = segmentsData.reduce((acc, segment) => {
          if (!acc[segment.shift_id]) acc[segment.shift_id] = [];
          acc[segment.shift_id].push(segment);
          return acc;
        }, {} as Record<string, WorkSegment[]>);

        const assignmentsByShift = assignmentsData.reduce((acc, assignment) => {
          acc[assignment.shift_id] = assignment;
          return acc;
        }, {} as Record<string, ShiftAssignment>);

        shiftsData = shiftsData.map(shift => ({
          ...shift,
          work_segments: segmentsByShift[shift.id] || [],
          assignment: assignmentsByShift[shift.id] || null
        })) as any;
      }

      setShifts(shiftsData);

      await loadStaffCounts(startDate, endDate);
    } catch (err) {
      console.error('Error loading shifts:', err);
    } finally {
      setShiftsLoading(false);
    }
  };

  const loadDeclineReasons = async () => {
    if (!employee) return;

    try {
      const { data, error } = await supabase
        .from('schedule_decline_reasons')
        .select('id, reason_text, is_active')
        .eq('partner_id', employee.partner_id)
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setDeclineReasons(data || []);
    } catch (err) {
      console.error('Error loading decline reasons:', err);
    }
  };

  const confirmShift = async (shift: Shift) => {
    if (!employee) return;

    setConfirmingShift(true);
    try {
      const existingAssignment = shift.assignment;

      if (existingAssignment) {
        const { error } = await supabase
          .from('schedule_shift_assignments')
          .update({
            assignment_status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            actor_id: employee.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAssignment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('schedule_shift_assignments')
          .insert({
            shift_id: shift.id,
            employee_id: employee.id,
            partner_id: employee.partner_id,
            assignment_status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            actor_id: employee.id
          });

        if (error) throw error;
      }

      await supabase
        .from('schedule_shifts')
        .update({
          confirmation_status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', shift.id);

      await supabase.from('schedule_action_logs').insert({
        partner_id: employee.partner_id,
        actor_type: 'employee',
        actor_id: employee.id,
        action_type: 'shift_confirmed',
        target_type: 'shift',
        target_id: shift.id,
        details: { shift_date: shift.date, branch_id: shift.branch_id }
      });

      setShowConfirmShiftModal(false);
      setSelectedShiftForConfirm(null);
      loadShifts();
    } catch (err) {
      console.error('Error confirming shift:', err);
      alert('Ошибка при подтверждении смены');
    } finally {
      setConfirmingShift(false);
    }
  };

  const declineShift = async (shift: Shift) => {
    if (!employee || !selectedDeclineReason) return;

    setConfirmingShift(true);
    try {
      const existingAssignment = shift.assignment;

      if (existingAssignment) {
        const { error } = await supabase
          .from('schedule_shift_assignments')
          .update({
            assignment_status: 'declined',
            declined_at: new Date().toISOString(),
            decline_reason_id: selectedDeclineReason,
            decline_comment: declineComment || null,
            actor_id: employee.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAssignment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('schedule_shift_assignments')
          .insert({
            shift_id: shift.id,
            employee_id: employee.id,
            partner_id: employee.partner_id,
            assignment_status: 'declined',
            declined_at: new Date().toISOString(),
            decline_reason_id: selectedDeclineReason,
            decline_comment: declineComment || null,
            actor_id: employee.id
          });

        if (error) throw error;
      }

      await supabase.from('schedule_action_logs').insert({
        partner_id: employee.partner_id,
        actor_type: 'employee',
        actor_id: employee.id,
        action_type: 'shift_declined',
        target_type: 'shift',
        target_id: shift.id,
        details: {
          shift_date: shift.date,
          branch_id: shift.branch_id,
          reason_id: selectedDeclineReason,
          comment: declineComment
        }
      });

      setShowDeclineModal(false);
      setShowConfirmShiftModal(false);
      setSelectedShiftForConfirm(null);
      setSelectedDeclineReason('');
      setDeclineComment('');
      loadShifts();
    } catch (err) {
      console.error('Error declining shift:', err);
      alert('Ошибка при отказе от смены');
    } finally {
      setConfirmingShift(false);
    }
  };

  const checkIfLateCancel = (shift: Shift): boolean => {
    const shiftStart = new Date(`${shift.date}T${shift.start_time}`);
    const now = new Date();
    const hoursUntilShift = (shiftStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilShift < confirmDeadlineHours;
  };

  const cancelShift = async (shift: Shift, reason: string) => {
    if (!employee || !reason.trim()) return;

    setConfirmingShift(true);
    try {
      const isLate = checkIfLateCancel(shift);

      if (isLate) {
        const { error } = await supabase
          .from('schedule_shifts')
          .update({
            confirmation_status: 'late_decline_pending',
            declined_at: new Date().toISOString(),
            decline_reason: reason,
            decline_is_late: true
          })
          .eq('id', shift.id);

        if (error) throw error;

        // Get responsible managers who have access to this shift's branch
        const { data: responsibleManagers } = await supabase
          .from('schedule_responsible_managers')
          .select(`
            id,
            employee_id,
            employee:employees(id, first_name, last_name, telegram_user_id),
            branches:schedule_responsible_branches!inner(branch_id)
          `)
          .eq('partner_id', employee.partner_id)
          .eq('is_active', true)
          .eq('branches.branch_id', shift.branch_id);

        if (responsibleManagers && responsibleManagers.length > 0) {
          const shiftDateFormatted = new Date(shift.date).toLocaleDateString('ru-RU', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          });
          const shiftTime = `${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}`;

          for (const manager of responsibleManagers) {
            const managerEmployee = manager.employee as any;

            await supabase.from('employee_events').insert({
              partner_id: employee.partner_id,
              employee_id: managerEmployee?.id,
              event_type: 'late_shift_cancel_request',
              title: 'Поздний отказ от смены',
              message: `Сотрудник ${employee.first_name}${employee.last_name ? ' ' + employee.last_name : ''} отказался от смены слишком поздно и требуется решение.`,
              related_shift_id: shift.id,
              related_employee_id: employee.id,
              related_employee_photo_url: employee.photo_url,
              related_employee_name: `${employee.first_name}${employee.last_name ? ' ' + employee.last_name : ''}`,
              related_branch_name: shift.branch?.name || null,
              related_shift_time: `${shiftDateFormatted}, ${shiftTime}`,
              no_show_reason_text: reason || null,
              action_type: 'approve_cancel',
              action_status: 'pending'
            });

            // Send Telegram notification to responsible manager
            if (managerEmployee?.telegram_user_id && shiftSettings.employeeBotToken) {
              try {
                const telegramMessage =
                  `<b>⚠️ Поздний отказ от смены</b>\n\n` +
                  `Сотрудник: <b>${employee.first_name}${employee.last_name ? ' ' + employee.last_name : ''}</b>\n` +
                  `Филиал: <b>${shift.branch?.name || 'Не указан'}</b>\n` +
                  `Дата: <b>${shiftDateFormatted}</b>\n` +
                  `Время: <b>${shiftTime}</b>\n` +
                  `Причина: <i>${reason}</i>\n\n` +
                  `Сотрудник отказался от смены слишком поздно. Требуется ваше решение.`;

                await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram-message`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    bot_token: shiftSettings.employeeBotToken,
                    chat_id: managerEmployee.telegram_user_id,
                    message: telegramMessage
                  })
                });
              } catch (telegramError) {
                console.error('Failed to send Telegram notification to manager:', telegramError);
              }
            }
          }
        }

        await supabase.from('schedule_action_logs').insert({
          partner_id: employee.partner_id,
          actor_type: 'employee',
          actor_id: employee.id,
          action_type: 'shift_late_cancel_requested',
          target_type: 'shift',
          target_id: shift.id,
          details: {
            shift_date: shift.date,
            branch_id: shift.branch_id,
            reason: reason
          }
        });
      } else {
        const { error } = await supabase
          .from('schedule_shifts')
          .update({
            confirmation_status: 'declined',
            declined_at: new Date().toISOString(),
            decline_reason: reason,
            decline_is_late: false,
            staff_member_id: null
          })
          .eq('id', shift.id);

        if (error) throw error;

        await supabase.from('schedule_action_logs').insert({
          partner_id: employee.partner_id,
          actor_type: 'employee',
          actor_id: employee.id,
          action_type: 'shift_cancelled',
          target_type: 'shift',
          target_id: shift.id,
          details: {
            shift_date: shift.date,
            branch_id: shift.branch_id,
            reason: reason
          }
        });
      }

      setShowCancelShiftModal(false);
      setShowConfirmShiftModal(false);
      setSelectedShiftForConfirm(null);
      setCancelReasonText('');
      setLateCancelWarning(false);
      loadShifts();

      if (isLate) {
        alert('Отмена слишком поздняя. Ваш запрос отправлен на рассмотрение ответственного.');
      }
    } catch (err) {
      console.error('Error cancelling shift:', err);
      alert('Ошибка при отмене смены');
    } finally {
      setConfirmingShift(false);
    }
  };

  const loadStaffCounts = async (startDate: string, endDate: string) => {
    if (!employee) return;

    try {
      // Сначала получаем смены текущего сотрудника, чтобы узнать филиалы
      const { data: employeeShifts, error: shiftsError } = await supabase
        .from('schedule_shifts')
        .select('date, branch_id')
        .eq('staff_member_id', employee.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (shiftsError) throw shiftsError;

      // Создаём карту date -> branch_id для смен сотрудника
      const dateToBranch: Record<string, string> = {};
      employeeShifts?.forEach(shift => {
        if (shift.branch_id) {
          dateToBranch[shift.date] = shift.branch_id;
        }
      });

      // Теперь загружаем все смены для этих дат и филиалов
      const counts: Record<string, number> = {};

      for (const [date, branchId] of Object.entries(dateToBranch)) {
        const { data, error } = await supabase
          .from('schedule_shifts')
          .select('staff_member_id', { count: 'exact', head: false })
          .eq('date', date)
          .eq('branch_id', branchId);

        if (!error && data) {
          counts[date] = data.length;
        }
      }

      setStaffCountByDate(counts);
    } catch (err) {
      console.error('Error loading staff counts:', err);
    }
  };

  const loadColleagues = async (date: string) => {
    if (!employee) return;

    setColleaguesLoading(true);
    try {
      // Сначала получаем смену текущего сотрудника на эту дату, чтобы узнать филиал
      const { data: employeeShift, error: shiftError } = await supabase
        .from('schedule_shifts')
        .select('branch_id, start_time, end_time, branch:branches(id, name, address)')
        .eq('staff_member_id', employee.id)
        .eq('date', date)
        .maybeSingle();

      if (shiftError) throw shiftError;

      // Определяем филиал для отображения
      let targetBranchId: string | null = null;
      let branchInfo: { id: string; name: string; address?: string | null } | null = null;

      if (employeeShift?.branch_id) {
        // У сотрудника есть смена на эту дату
        targetBranchId = employeeShift.branch_id;
        branchInfo = employeeShift.branch as any;
      } else if (employee.branch_id) {
        // Используем основной филиал сотрудника
        targetBranchId = employee.branch_id;
        // Загружаем информацию о филиале
        const { data: branchData } = await supabase
          .from('branches')
          .select('id, name, address')
          .eq('id', employee.branch_id)
          .maybeSingle();
        branchInfo = branchData;
      } else {
        // Если у сотрудника вообще нет филиала, ищем любой филиал партнера
        const { data: partnerBranches } = await supabase
          .from('branches')
          .select('id, name, address')
          .eq('partner_id', employee.partner_id)
          .limit(1)
          .maybeSingle();

        if (partnerBranches) {
          targetBranchId = partnerBranches.id;
          branchInfo = partnerBranches;
        }
      }

      setSelectedBranch(branchInfo);

      if (!targetBranchId) {
        setColleagues([]);
        setColleaguesLoading(false);
        return;
      }

      // Определяем, является ли выбранная дата прошлой
      const selectedDateObj = new Date(date + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isPastDate = selectedDateObj < today;

      // Загружаем всех сотрудников на этом филиале в эту дату
      const { data, error } = await supabase
        .from('schedule_shifts')
        .select(`
          id,
          staff_member_id,
          start_time,
          end_time,
          status,
          actual_start_at,
          actual_end_at,
          late_minutes,
          auto_closed,
          closed_by,
          staff_member:employees!schedule_shifts_employee_id_fkey(
            id, first_name, last_name, photo_url,
            position:positions(id, name)
          )
        `)
        .eq('branch_id', targetBranchId)
        .eq('date', date)
        .order('start_time', { ascending: true });

      if (error) throw error;

      // Для прошлых дат загружаем work_segments
      const shiftIds = data?.map((s: any) => s.id) || [];
      let segmentsByShift: Record<string, WorkSegment[]> = {};

      if (isPastDate && shiftIds.length > 0) {
        const { data: segments } = await supabase
          .from('work_segments')
          .select('*')
          .in('shift_id', shiftIds)
          .order('segment_start_at', { ascending: true });

        if (segments) {
          segmentsByShift = segments.reduce((acc: Record<string, WorkSegment[]>, seg: any) => {
            if (!acc[seg.shift_id]) acc[seg.shift_id] = [];
            acc[seg.shift_id].push(seg);
            return acc;
          }, {});
        }
      }

      // Вычисляем отработанное время
      const calculateWorkedMinutes = (shift: any, segments: WorkSegment[]): number => {
        if (segments && segments.length > 0) {
          // Суммируем все отрезки work_segments
          return segments.reduce((total, seg) => {
            if (seg.segment_end_at) {
              const start = new Date(seg.segment_start_at).getTime();
              const end = new Date(seg.segment_end_at).getTime();
              return total + Math.floor((end - start) / 60000);
            }
            return total;
          }, 0);
        } else if (shift.actual_start_at && shift.actual_end_at) {
          // Если нет сегментов, используем actual_end_at - actual_start_at
          const start = new Date(shift.actual_start_at).getTime();
          const end = new Date(shift.actual_end_at).getTime();
          return Math.floor((end - start) / 60000);
        }
        return 0;
      };

      let colleaguesList = data
        ?.map((shift: any) => {
          const segments = segmentsByShift[shift.id] || [];
          const workedMinutes = isPastDate && shift.status === 'closed'
            ? calculateWorkedMinutes(shift, segments)
            : 0;

          return {
            ...shift.staff_member,
            start_time: shift.start_time,
            end_time: shift.end_time,
            status: shift.status,
            actual_start_at: shift.actual_start_at,
            actual_end_at: shift.actual_end_at,
            late_minutes: shift.late_minutes || 0,
            shift_id: shift.id,
            work_segments: segments,
            worked_minutes: workedMinutes,
            auto_closed: shift.auto_closed,
            closed_by: shift.closed_by
          };
        })
        .filter((colleague: any) => colleague !== null && colleague.id) as ColleagueInfo[];

      // Убираем дубликаты по staff_member_id (оставляем только первую смену каждого сотрудника)
      const uniqueColleagues = new Map<string, ColleagueInfo>();
      colleaguesList?.forEach((colleague) => {
        if (!uniqueColleagues.has(colleague.id)) {
          uniqueColleagues.set(colleague.id, colleague);
        }
      });
      colleaguesList = Array.from(uniqueColleagues.values());

      // Если текущего сотрудника нет в списке, но у него есть смена в этот день (в другом филиале), добавляем его
      if (employeeShift && !colleaguesList.some(c => c.id === employee.id)) {
        // Загружаем полную информацию о смене текущего сотрудника
        const { data: fullEmployeeShift } = await supabase
          .from('schedule_shifts')
          .select('id, status, actual_start_at, actual_end_at, late_minutes, auto_closed, closed_by')
          .eq('staff_member_id', employee.id)
          .eq('date', date)
          .maybeSingle();

        // Для прошлых смен загружаем work_segments
        let employeeSegments: WorkSegment[] = [];
        let employeeWorkedMinutes = 0;

        if (isPastDate && fullEmployeeShift?.id && fullEmployeeShift.status === 'closed') {
          const { data: segments } = await supabase
            .from('work_segments')
            .select('*')
            .eq('shift_id', fullEmployeeShift.id)
            .order('segment_start_at', { ascending: true });

          employeeSegments = segments || [];

          if (employeeSegments.length > 0) {
            employeeWorkedMinutes = employeeSegments.reduce((total, seg) => {
              if (seg.segment_end_at) {
                const start = new Date(seg.segment_start_at).getTime();
                const end = new Date(seg.segment_end_at).getTime();
                return total + Math.floor((end - start) / 60000);
              }
              return total;
            }, 0);
          } else if (fullEmployeeShift.actual_start_at && fullEmployeeShift.actual_end_at) {
            const start = new Date(fullEmployeeShift.actual_start_at).getTime();
            const end = new Date(fullEmployeeShift.actual_end_at).getTime();
            employeeWorkedMinutes = Math.floor((end - start) / 60000);
          }
        }

        colleaguesList.push({
          id: employee.id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          photo_url: employee.photo_url,
          position: employee.position,
          start_time: employeeShift.start_time || '00:00:00',
          end_time: employeeShift.end_time || '00:00:00',
          status: fullEmployeeShift?.status || 'scheduled',
          actual_start_at: fullEmployeeShift?.actual_start_at || null,
          actual_end_at: fullEmployeeShift?.actual_end_at || null,
          late_minutes: fullEmployeeShift?.late_minutes || 0,
          shift_id: fullEmployeeShift?.id || '',
          work_segments: employeeSegments,
          worked_minutes: employeeWorkedMinutes,
          auto_closed: fullEmployeeShift?.auto_closed,
          closed_by: fullEmployeeShift?.closed_by
        } as ColleagueInfo);
        // Сортируем по времени начала смены
        colleaguesList.sort((a, b) => a.start_time.localeCompare(b.start_time));
      }

      setColleagues(colleaguesList || []);
    } catch (err) {
      console.error('Error loading colleagues:', err);
      setColleagues([]);
      setSelectedBranch(null);
    } finally {
      setColleaguesLoading(false);
    }
  };

  const handleDayClick = (date: Date) => {
    const dateKey = formatDateKey(date);
    setSelectedDate(dateKey);
    loadColleagues(dateKey);
    setBottomSheetOpen(true);
  };

  const shiftsByDate = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    shifts.forEach(shift => {
      if (!map[shift.date]) {
        map[shift.date] = [];
      }
      map[shift.date].push(shift);
    });
    return map;
  }, [shifts]);

  const navigateSchedule = (direction: 'prev' | 'next') => {
    const newDate = new Date(scheduleAnchorDate);
    if (scheduleViewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
    }
    setScheduleAnchorDate(newDate);
  };

  const goToToday = () => {
    setScheduleAnchorDate(new Date());
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const getLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      setLocationStatus('Получение геолокации...');

      const tg = (window as any).Telegram?.WebApp;
      if (tg?.requestLocation) {
        try {
          tg.requestLocation((result: any) => {
            if (result && result.latitude && result.longitude) {
              setLocationStatus(null);
              resolve({ lat: result.latitude, lng: result.longitude });
            } else {
              fallbackToNavigator();
            }
          });
          return;
        } catch {
          fallbackToNavigator();
          return;
        }
      }

      fallbackToNavigator();

      function fallbackToNavigator() {
        if (!navigator.geolocation) {
          setLocationStatus(null);
          reject(new Error('Геолокация не поддерживается вашим устройством'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocationStatus(null);
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (error) => {
            setLocationStatus(null);
            let message = 'Не удалось получить геолокацию';
            if (error.code === error.PERMISSION_DENIED) {
              message = 'Доступ к геолокации запрещён. Разрешите доступ в настройках браузера.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              message = 'Информация о местоположении недоступна';
            } else if (error.code === error.TIMEOUT) {
              message = 'Превышено время ожидания получения геолокации';
            }
            reject(new Error(message));
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      }
    });
  };

  const getTodayShift = (): Shift | null => {
    const today = formatDateKey(new Date());
    return shifts.find(s => s.date === today) || null;
  };

  const calculateLateMinutes = (plannedStartTime: string, actualStartTime: Date, graceMinutes: number): number => {
    const [hours, minutes] = plannedStartTime.split(':').map(Number);
    const plannedStart = new Date(actualStartTime);
    plannedStart.setHours(hours, minutes, 0, 0);

    const diffMs = actualStartTime.getTime() - plannedStart.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    return Math.max(0, diffMinutes - graceMinutes);
  };

  const handleStartShift = async () => {
    const todayShift = getTodayShift();
    if (!todayShift || !employee) return;

    const openSegments = todayShift.work_segments?.filter(s => !s.segment_end_at) || [];
    if (openSegments.length > 0) {
      setShiftError('Нельзя открыть новый отрезок пока предыдущий не закрыт');
      return;
    }

    setShiftError(null);
    setShiftActionLoading(true);

    try {
      let userLat: number | null = null;
      let userLng: number | null = null;
      let openedWithLocation = false;

      if (shiftSettings.shiftRequireLocation) {
        const branchLat = todayShift.branch?.latitude;
        const branchLng = todayShift.branch?.longitude;

        if (!branchLat || !branchLng) {
          throw new Error('Координаты филиала не настроены. Обратитесь к администратору.');
        }

        const userLocation = await getLocation();
        userLat = userLocation.lat;
        userLng = userLocation.lng;

        const distance = calculateDistance(userLat, userLng, branchLat, branchLng);

        if (distance > shiftSettings.shiftLocationRadius) {
          throw new Error(`Вы находитесь на расстоянии ${distance} м от филиала. Для открытия смены нужно быть в радиусе ${shiftSettings.shiftLocationRadius} м.`);
        }
        openedWithLocation = true;
      }

      const now = new Date();
      const lateMinutes = calculateLateMinutes(todayShift.start_time, now, shiftSettings.shiftGraceMinutes);

      const { error: segmentError } = await supabase
        .from('work_segments')
        .insert({
          shift_id: todayShift.id,
          segment_start_at: now.toISOString(),
          start_lat: userLat,
          start_lng: userLng,
          opened_with_location: openedWithLocation
        });

      if (segmentError) throw segmentError;

      const { error: updateError } = await supabase
        .from('schedule_shifts')
        .update({
          status: 'opened',
          actual_start_at: todayShift.actual_start_at || now.toISOString(),
          late_minutes: todayShift.late_minutes || lateMinutes,
          start_lat: userLat,
          start_lng: userLng
        })
        .eq('id', todayShift.id);

      if (updateError) throw updateError;

      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-shift-reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ shift_id: todayShift.id })
      }).catch(err => console.error('Error deleting shift reminders:', err));

      await loadShifts();
    } catch (err) {
      console.error('Error starting shift:', err);
      setShiftError(err instanceof Error ? err.message : 'Ошибка при открытии смены');
    } finally {
      setShiftActionLoading(false);
    }
  };

  const handleEndShift = async () => {
    const todayShift = getTodayShift();
    if (!todayShift || !employee) return;

    const openSegments = todayShift.work_segments?.filter(s => !s.segment_end_at) || [];
    if (openSegments.length === 0) {
      setShiftError('Нет открытого отрезка работы для закрытия');
      return;
    }

    setShiftError(null);
    setShiftActionLoading(true);

    try {
      let userLat: number | null = null;
      let userLng: number | null = null;
      let closedWithLocation = false;

      if (shiftSettings.shiftRequireLocationOnClose) {
        const branchLat = todayShift.branch?.latitude;
        const branchLng = todayShift.branch?.longitude;

        if (!branchLat || !branchLng) {
          throw new Error('Координаты филиала не настроены. Обратитесь к администратору.');
        }

        const userLocation = await getLocation();
        userLat = userLocation.lat;
        userLng = userLocation.lng;

        const distance = calculateDistance(userLat, userLng, branchLat, branchLng);

        if (distance > shiftSettings.shiftLocationRadius) {
          throw new Error(`Вы находитесь на расстоянии ${distance} м от филиала. Для закрытия смены нужно быть в радиусе ${shiftSettings.shiftLocationRadius} м.`);
        }
        closedWithLocation = true;
      }

      const now = new Date();
      const currentSegment = openSegments[0];

      const { error: segmentError } = await supabase
        .from('work_segments')
        .update({
          segment_end_at: now.toISOString(),
          end_lat: userLat,
          end_lng: userLng,
          closed_with_location: closedWithLocation
        })
        .eq('id', currentSegment.id);

      if (segmentError) throw segmentError;

      const { error: updateError } = await supabase
        .from('schedule_shifts')
        .update({
          status: 'closed',
          actual_end_at: now.toISOString(),
          closed_by: 'employee'
        })
        .eq('id', todayShift.id);

      if (updateError) throw updateError;

      if (todayShift.close_reminder_message_id && todayShift.close_reminder_chat_id && shiftSettings.employeeBotToken) {
        fetch(`https://api.telegram.org/bot${shiftSettings.employeeBotToken}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: todayShift.close_reminder_chat_id,
            message_id: todayShift.close_reminder_message_id
          })
        }).catch(err => console.error('Error deleting close reminder message:', err));
      }

      await loadShifts();
    } catch (err) {
      console.error('Error ending shift:', err);
      setShiftError(err instanceof Error ? err.message : 'Ошибка при закрытии смены');
    } finally {
      setShiftActionLoading(false);
    }
  };

  const formatActualTime = (isoString: string | null): string => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const calculateWorkedMinutes = (shift: Shift): number | null => {
    if (!shift.work_segments || shift.work_segments.length === 0) return null;

    let totalMinutes = 0;
    shift.work_segments.forEach(segment => {
      if (segment.segment_end_at) {
        const start = new Date(segment.segment_start_at);
        const end = new Date(segment.segment_end_at);
        totalMinutes += Math.floor((end.getTime() - start.getTime()) / 60000);
      }
    });

    return totalMinutes > 0 ? totalMinutes : null;
  };

  const canReopenShift = (shift: Shift): boolean => {
    if (!shift || shift.status !== 'closed') return false;

    const openSegments = shift.work_segments?.filter(s => !s.segment_end_at) || [];
    if (openSegments.length > 0) return false;

    const now = new Date();
    const shiftDate = new Date(shift.date);
    const [endHours, endMinutes] = shift.end_time.split(':').map(Number);
    const plannedEnd = new Date(shiftDate);
    plannedEnd.setHours(endHours, endMinutes, 0, 0);

    return now < plannedEnd;
  };

  const handleReopenShift = async () => {
    const todayShift = getTodayShift();
    if (!todayShift || !employee) return;

    if (!canReopenShift(todayShift)) {
      setShiftError('Невозможно открыть смену повторно: плановое время истекло');
      return;
    }

    await handleStartShift();
  };

  const formatWorkedTime = (minutes: number | null): string => {
    if (minutes === null || minutes === 0) return '0ч 0м';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}ч ${mins}м`;
  };

  const formatSegmentTime = (segment: WorkSegment): string => {
    const start = new Date(segment.segment_start_at);
    const startStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;

    if (!segment.segment_end_at) {
      return `${startStr} – В работе...`;
    }

    const end = new Date(segment.segment_end_at);
    const endStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
    return `${startStr} – ${endStr}`;
  };

  const formatPeriodLabel = (): string => {
    if (scheduleViewMode === 'week') {
      const days = getWeekDays(scheduleAnchorDate);
      const first = days[0];
      const last = days[6];
      const formatDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
      return `${formatDate(first)} - ${formatDate(last)}.${last.getFullYear()}`;
    } else {
      return `${MONTH_NAMES[scheduleAnchorDate.getMonth()]} ${scheduleAnchorDate.getFullYear()}`;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusBadge = () => {
    switch (employee?.current_status) {
      case 'working':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            Работает
          </span>
        );
      case 'on_vacation':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-full font-medium">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
            В отпуске
          </span>
        );
      case 'pending_dismissal':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
            Увольнение
          </span>
        );
      default:
        return null;
    }
  };

  const handleLogout = () => {
    if (slug) {
      localStorage.removeItem(`employee_auth_${slug}`);
    }
    setEmployee(null);
    setIsAuthenticated(false);
    setLoginForm({ login: '', password: '' });
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {error === 'not_found' && 'Кабинет не найден'}
            {error === 'not_active' && 'Кабинет неактивен'}
            {error === 'no_credentials' && 'Авторизация не настроена'}
          </h1>
          <p className="text-gray-600 mb-6">
            {error === 'not_found' && 'Сотрудник с таким идентификатором не найден в системе.'}
            {error === 'not_active' && 'Ваш аккаунт сотрудника деактивирован.'}
            {error === 'no_credentials' && 'Для входа в кабинет необходимо настроить логин и пароль. Обратитесь к администратору.'}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && slug) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            {partner?.logo_url ? (
              <img
                src={partner.logo_url}
                alt={partner.name}
                className="h-16 mx-auto mb-4 object-contain"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-white" />
              </div>
            )}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Кабинет сотрудника</h1>
            {partner?.name && (
              <p className="text-gray-500 text-sm mb-2">{partner.name}</p>
            )}
            <p className="text-gray-600">Введите логин и пароль для входа</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Логин</label>
              <input
                type="text"
                value={loginForm.login}
                onChange={(e) => setLoginForm({ ...loginForm, login: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Введите логин"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Введите пароль"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loginLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Вход...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Войти</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!employee) {
    return null;
  }

  const renderHomeTab = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(today.getDate() + shiftVisibilityDays);

    const todayShift = getTodayShift();

    const upcomingShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      shiftDate.setHours(0, 0, 0, 0);

      if (shiftDate >= today && shiftDate <= endDate) {
        if (shift.date === formatDateKey(today) && todayShift && todayShift.status !== 'scheduled') {
          return false;
        }
        return true;
      }
      return false;
    });

    return (
      <div className="space-y-4 pb-24">
        {hasKPITemplate && (
          <button
            onClick={() => setShowKPIView(true)}
            className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all active:scale-[0.99]"
          >
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Итоговый KPI
              </h3>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="text-sm text-gray-500">Текущий период</div>
              {homeKPILoading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-emerald-600 rounded-full animate-spin"></div>
              ) : homeKPIPercent !== null ? (
                <div className={`text-2xl font-bold ${
                  homeKPIPercent >= 80 ? 'text-green-600' :
                  homeKPIPercent >= 50 ? 'text-amber-600' :
                  'text-red-600'
                }`}>
                  {homeKPIPercent}%
                </div>
              ) : (
                <div className="text-2xl font-bold text-gray-400">--</div>
              )}
            </div>
          </button>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Сегодняшняя смена
            </h3>
          </div>
          <div className="p-4">
            {todayShift ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">Плановое время</div>
                    <div className="font-semibold text-gray-900 text-lg">
                      {formatTime(todayShift.start_time)} - {formatTime(todayShift.end_time)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">{todayShift.branch?.name}</div>
                    <div className="text-sm text-gray-400">{formatMinutesToDuration(todayShift.total_minutes)}</div>
                  </div>
                </div>

                {todayShift.status !== 'scheduled' && (
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <LogIn className="w-4 h-4" />
                        Начало
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatActualTime(todayShift.actual_start_at)}
                      </span>
                    </div>
                    {todayShift.status === 'closed' && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-1.5">
                          <LogOut className="w-4 h-4" />
                          Конец
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatActualTime(todayShift.actual_end_at)}
                        </span>
                      </div>
                    )}
                    {todayShift.late_minutes > 0 && todayShift.status !== 'opened' && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-red-600 flex items-center gap-1.5">
                          <Timer className="w-4 h-4" />
                          Опоздание
                        </span>
                        <span className="font-medium text-red-600">
                          -{todayShift.late_minutes} мин
                        </span>
                      </div>
                    )}
                    {todayShift.status === 'closed' && (
                      <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                        <span className="text-gray-700 font-medium">Отработано</span>
                        <span className="font-semibold text-blue-600">
                          {calculateWorkedMinutes(todayShift) !== null
                            ? formatMinutesToDuration(calculateWorkedMinutes(todayShift)!)
                            : '--'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {shiftError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    {shiftError}
                  </div>
                )}

                {locationStatus && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {locationStatus}
                  </div>
                )}

                {todayShift.status === 'scheduled' && (
                  <>
                    {todayShift.attendance_status === 'no_show' ? (
                      <>
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                          <div className="flex items-center gap-2 text-red-700 mb-3">
                            <AlertCircle className="w-5 h-5" />
                            <span className="font-semibold">Не выход на смену</span>
                          </div>
                          {todayShift.no_show_reason_text ? (
                            <div className="text-sm text-red-600">
                              <span className="font-medium">Причина: </span>
                              <span>{todayShift.no_show_reason_text}</span>
                              {todayShift.no_show_reason_status === 'pending' && (
                                <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">
                                  На рассмотрении
                                </span>
                              )}
                              {todayShift.no_show_reason_status === 'approved' && (
                                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                                  Принята
                                </span>
                              )}
                              {todayShift.no_show_reason_status === 'rejected' && (
                                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">
                                  Отклонена
                                </span>
                              )}
                            </div>
                          ) : (
                            noShowReasonsEnabled && (
                              <button
                                onClick={() => {
                                  setSelectedNoShowShift(todayShift);
                                  setShowNoShowReasonModal(true);
                                }}
                                className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-red-700 transition-all"
                              >
                                <AlertCircle className="w-5 h-5" />
                                Выбрать причину
                              </button>
                            )
                          )}
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                          <div className="flex items-start gap-2 text-sm text-blue-700 mb-3">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p className="text-xs">Если вы найдете подмену, вам не будет начислен не выход</p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedReplacementShift(todayShift);
                              setShowReplacementModal(true);
                              loadAllEmployees(undefined, todayShift.date);
                            }}
                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
                          >
                            <RefreshCw className="w-5 h-5" />
                            Назначить подмену
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleStartShift}
                          disabled={shiftActionLoading}
                          className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-3 hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-green-500/25"
                        >
                          {shiftActionLoading ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            <Play className="w-6 h-6" />
                          )}
                          Начать смену
                        </button>
                        <LateTimer
                          plannedStartTime={todayShift.start_time}
                          graceMinutes={shiftSettings.shiftGraceMinutes}
                          actualStartAt={null}
                          lateMinutes={0}
                          shiftDate={todayShift.date}
                        />
                      </>
                    )}
                  </>
                )}

                {todayShift.status === 'opened' && (
                  <>
                    {todayShift.work_segments && todayShift.work_segments.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-gray-700">Текущая сессия:</span>
                          <span className="font-bold text-lg text-blue-600 flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            В работе
                          </span>
                        </div>
                        {todayShift.work_segments.length > 1 && (
                          <div className="space-y-2 mb-3 pb-3 border-b border-blue-300">
                            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Предыдущие отрезки:</div>
                            {todayShift.work_segments
                              .filter(s => s.segment_end_at)
                              .sort((a, b) => new Date(a.segment_start_at).getTime() - new Date(b.segment_start_at).getTime())
                              .map((segment) => (
                                <div key={segment.id} className="flex items-center gap-2 text-sm">
                                  <Clock className="w-4 h-4 text-gray-600" />
                                  <span className="text-gray-700">
                                    {formatSegmentTime(segment)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Всего отработано:</span>
                          <span className="font-semibold text-blue-600">
                            {formatWorkedTime(calculateWorkedMinutes(todayShift))}
                          </span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleEndShift}
                      disabled={shiftActionLoading}
                      className="w-full py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-3 hover:from-red-600 hover:to-rose-700 transition-all disabled:opacity-50 shadow-lg shadow-red-500/25"
                    >
                      {shiftActionLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Square className="w-6 h-6" />
                      )}
                      Закрыть смену
                    </button>
                    <LateTimer
                      plannedStartTime={todayShift.start_time}
                      graceMinutes={shiftSettings.shiftGraceMinutes}
                      actualStartAt={todayShift.actual_start_at}
                      lateMinutes={todayShift.late_minutes}
                      shiftDate={todayShift.date}
                    />
                  </>
                )}

                {todayShift.status === 'closed' && (
                  <div className="space-y-3">
                    {todayShift.work_segments && todayShift.work_segments.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-gray-700">Фактически отработано:</span>
                          <span className="font-bold text-lg text-blue-600">
                            {formatWorkedTime(calculateWorkedMinutes(todayShift))}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Отрезки работы:</div>
                          {todayShift.work_segments
                            .sort((a, b) => new Date(a.segment_start_at).getTime() - new Date(b.segment_start_at).getTime())
                            .map((segment) => (
                              <div key={segment.id} className="flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4 text-blue-600" />
                                <span className={segment.segment_end_at ? 'text-gray-700' : 'text-blue-600 font-semibold'}>
                                  {formatSegmentTime(segment)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {canReopenShift(todayShift) ? (
                      <button
                        onClick={handleReopenShift}
                        disabled={shiftActionLoading}
                        className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-3 hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/25"
                      >
                        {shiftActionLoading ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <Play className="w-6 h-6" />
                        )}
                        Открыть смену повторно
                      </button>
                    ) : (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                        <div className="text-green-700 font-semibold">Смена завершена</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Сегодня смена не назначена</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Ближайшие смены</h3>
          {upcomingShifts.length > 0 ? (
            <div className="space-y-2">
              {upcomingShifts.map(shift => (
                <div key={shift.id} className={`flex items-center justify-between p-3 rounded-xl ${
                  shift.date === formatDateKey(new Date()) ? 'bg-blue-100 border border-blue-200' : 'bg-blue-50'
                }`}>
                  <div>
                    <div className="font-medium text-gray-900">
                      {new Date(shift.date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                    <div className="text-sm text-gray-500">{shift.branch?.name || 'Филиал'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-blue-600">
                      {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                    </div>
                    <div className="text-sm text-gray-500">{formatMinutesToDuration(shift.total_minutes)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Нет запланированных смен</p>
          )}
        </div>
      </div>
    );
  };

  const renderScheduleTab = () => {
    const weekDays = getWeekDays(scheduleAnchorDate);
    const monthWeeks = getMonthWeeks(scheduleAnchorDate);

    return (
      <div className="space-y-4 pb-24">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScheduleViewMode('week')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  scheduleViewMode === 'week'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Неделя
              </button>
              <button
                onClick={() => setScheduleViewMode('month')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  scheduleViewMode === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Месяц
              </button>
            </div>
            <button
              onClick={goToToday}
              className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Сегодня
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateSchedule('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-gray-900">{formatPeriodLabel()}</span>
            <button
              onClick={() => navigateSchedule('next')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {shiftsLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Загрузка графика...</p>
          </div>
        ) : scheduleViewMode === 'week' ? (
          <div className="space-y-3">
            {weekDays.map((day, index) => {
              const dateKey = formatDateKey(day);
              const dayShifts = shiftsByDate[dateKey] || [];
              const hasShift = dayShifts.length > 0;
              const todayClass = isToday(day);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const staffCount = staffCountByDate[dateKey] || 0;
              const isListPastDate = new Date(day.setHours(0, 0, 0, 0)) < new Date(new Date().setHours(0, 0, 0, 0));

              return (
                <div
                  key={index}
                  onClick={() => handleDayClick(day)}
                  className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all cursor-pointer hover:shadow-md active:scale-98 ${
                    todayClass
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : hasShift
                      ? 'border-blue-200'
                      : 'border-gray-200'
                  }`}
                >
                  <div className={`px-4 py-3 relative ${
                    hasShift
                      ? 'bg-blue-50'
                      : employee.current_status === 'on_vacation'
                      ? 'bg-emerald-50'
                      : 'bg-gray-50'
                  }`}>
                    {staffCount > 0 && (
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-gray-600/80 text-white text-[9px] font-medium rounded">
                        {staffCount} чел
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center">
                          <div className="text-[10px] text-gray-400 font-medium mb-0.5">
                            {WEEKDAY_NAMES[day.getDay()]}
                          </div>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                            todayClass
                              ? 'bg-blue-600 text-white'
                              : isWeekend
                              ? 'bg-gray-300 text-gray-700'
                              : 'bg-white text-gray-900 border border-gray-200'
                          }`}>
                            {day.getDate()}
                          </div>
                        </div>
                        <div>
                          <div className={`font-semibold ${todayClass ? 'text-blue-600' : 'text-gray-900'}`}>
                            {WEEKDAY_FULL[day.getDay()]}
                          </div>
                          <div className="text-sm text-gray-500">
                            {day.toLocaleDateString('ru-RU', { month: 'long' })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {todayClass && (
                          <span className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                            Сегодня
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    {hasShift ? (
                      <div className="space-y-3">
                        {dayShifts.map(shift => (
                          <div key={shift.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 text-blue-500" />
                                <div>
                                  <div className="font-semibold text-gray-900">
                                    {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {formatMinutesToDuration(shift.total_minutes)}
                                  </div>
                                </div>
                              </div>
                              {shift.branch && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <MapPin className="w-4 h-4" />
                                  <span>{shift.branch.name}</span>
                                </div>
                              )}
                            </div>
                            {shift.confirmation_status === 'confirmed' && (
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-700">
                                <Check className="w-4 h-4" />
                                Подтверждено
                              </div>
                            )}
                            {shift.confirmation_status === 'late_decline_pending' && (
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-100 text-amber-700">
                                <Clock className="w-4 h-4" />
                                Отмена на решении
                              </div>
                            )}
                            {shift.confirmation_status === 'declined' && (
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-700">
                                <X className="w-4 h-4" />
                                Отказ
                              </div>
                            )}
                            {(shift.confirmation_status === 'pending' || shift.confirmation_status === 'not_required' || !shift.confirmation_status) && shift.status === 'scheduled' && !isListPastDate && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedShiftForConfirm(shift);
                                  setShowConfirmShiftModal(true);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
                              >
                                <Clock className="w-4 h-4" />
                                Не подтверждено
                              </button>
                            )}
                            {(shift.actual_start_at || shift.actual_end_at) && (
                              <div className="flex items-center gap-3 text-sm bg-teal-50 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-1.5 text-teal-700">
                                  <LogIn className="w-3.5 h-3.5" />
                                  <span>{formatActualTime(shift.actual_start_at)}</span>
                                </div>
                                {shift.actual_end_at && (
                                  <>
                                    <span className="text-teal-400">-</span>
                                    <div className="flex items-center gap-1.5 text-teal-700">
                                      <LogOut className="w-3.5 h-3.5" />
                                      <span>{formatActualTime(shift.actual_end_at)}</span>
                                    </div>
                                  </>
                                )}
                                {shift.late_minutes > 0 && (
                                  <div className="flex items-center gap-1 text-red-600 ml-auto">
                                    <Timer className="w-3.5 h-3.5" />
                                    <span className="font-medium">-{shift.late_minutes}м</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        {employee.current_status === 'on_vacation' ? (
                          <span className="text-emerald-600 font-medium">Отпуск</span>
                        ) : (
                          <span className="text-gray-400">Не работаю</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {monthWeeks.map((week, weekIndex) => (
              <div key={weekIndex} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-7 divide-x divide-gray-100">
                  {week.map((day, dayIndex) => {
                    const dateKey = formatDateKey(day);
                    const dayShifts = shiftsByDate[dateKey] || [];
                    const hasShift = dayShifts.length > 0;
                    const todayClass = isToday(day);
                    const isCurrentMonth = day.getMonth() === scheduleAnchorDate.getMonth();
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const staffCount = staffCountByDate[dateKey] || 0;
                    const isMonthPastDate = new Date(new Date(day).setHours(0, 0, 0, 0)) < new Date(new Date().setHours(0, 0, 0, 0));

                    const shiftConfirmationStatus = dayShifts[0]?.confirmation_status;
                    const isPending = shiftConfirmationStatus === 'pending' || shiftConfirmationStatus === 'not_required' || !shiftConfirmationStatus;
                    const isLateDecline = shiftConfirmationStatus === 'late_decline_pending';
                    const isConfirmed = shiftConfirmationStatus === 'confirmed';
                    const needsAction = hasShift && isPending && dayShifts[0]?.status === 'scheduled' && !isMonthPastDate;

                    return (
                      <div
                        key={dayIndex}
                        onClick={() => isCurrentMonth && handleDayClick(day)}
                        className={`h-[110px] p-1.5 flex flex-col relative ${
                          !isCurrentMonth ? 'bg-gray-50 opacity-50' : 'cursor-pointer hover:bg-blue-50/50 transition-colors active:bg-blue-100/50'
                        } ${
                          hasShift
                            ? needsAction
                              ? 'bg-amber-50'
                              : isLateDecline
                                ? 'bg-red-50'
                                : 'bg-blue-50'
                            : employee.current_status === 'on_vacation' ? 'bg-emerald-50' : ''
                        }`}
                      >
                        {needsAction && isCurrentMonth && (
                          <div className="absolute top-1 right-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                          </div>
                        )}
                        {hasShift && isLateDecline && isCurrentMonth && (
                          <div className="absolute top-1 right-1">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                          </div>
                        )}
                        <div className="text-center mb-0.5 text-[9px] text-gray-400 font-medium uppercase">
                          {WEEKDAY_NAMES[day.getDay()]}
                        </div>
                        <div className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center text-xs font-semibold mb-0.5 ${
                          todayClass
                            ? 'bg-blue-600 text-white'
                            : isWeekend && isCurrentMonth
                            ? 'text-gray-500'
                            : isCurrentMonth
                            ? 'text-gray-900'
                            : 'text-gray-300'
                        }`}>
                          {day.getDate()}
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-start gap-0.5 overflow-hidden">
                          {hasShift && isCurrentMonth && (
                            <div className="text-center w-full px-0.5">
                              <div className={`text-[9px] leading-tight font-semibold truncate ${
                                needsAction ? 'text-amber-700' : isLateDecline ? 'text-red-700' : 'text-blue-700'
                              }`}>
                                {formatTime(dayShifts[0].start_time)}
                              </div>
                              <div className={`text-[9px] leading-tight font-semibold truncate ${
                                needsAction ? 'text-amber-700' : isLateDecline ? 'text-red-700' : 'text-blue-700'
                              }`}>
                                {formatTime(dayShifts[0].end_time)}
                              </div>
                              {dayShifts[0].branch && (
                                <div className="text-[7px] leading-tight text-gray-500 truncate mt-0.5">
                                  {dayShifts[0].branch.name}
                                </div>
                              )}
                              {dayShifts.length > 1 && (
                                <div className="text-[7px] text-blue-500 mt-0.5">
                                  +{dayShifts.length - 1}
                                </div>
                              )}
                              {staffCount > 0 && (
                                <div className="flex items-center justify-center gap-0.5 mt-0.5">
                                  <Users className="w-2.5 h-2.5 text-gray-600" />
                                  <span className="text-[8px] font-semibold text-gray-600">{staffCount}</span>
                                </div>
                              )}
                              {dayShifts[0].late_minutes > 0 && (
                                <div className="text-[7px] text-red-600 font-medium mt-0.5 truncate">
                                  -{formatMinutesToDuration(dayShifts[0].late_minutes)}
                                </div>
                              )}
                            </div>
                          )}
                          {!hasShift && isCurrentMonth && employee.current_status === 'on_vacation' && (
                            <div className="text-center">
                              <span className="text-[8px] text-emerald-600 font-medium">Отпуск</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderFinancesTab = () => (
    <div className="space-y-4 pb-24">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Раздел в разработке</h2>
        <p className="text-gray-500">Финансовая информация будет доступна в ближайшее время</p>
      </div>
    </div>
  );

  const renderProfileTab = () => (
    <div className="space-y-4 pb-24">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-6 text-white">
          <div className="flex items-center gap-4">
            {employee.photo_url ? (
              <img
                src={employee.photo_url}
                alt={employee.first_name}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-white/30"
              />
            ) : (
              <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-bold">
                {employee.first_name.charAt(0)}{employee.last_name?.charAt(0) || ''}
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold">{employee.first_name} {employee.last_name || ''}</h2>
              {getStatusBadge()}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {employee.position?.name && (
            <div className="flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Должность</div>
                <div className="font-medium text-gray-900">{employee.position.name}</div>
              </div>
            </div>
          )}

          {employee.branch?.name && (
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Филиал</div>
                <div className="font-medium text-gray-900">{employee.branch.name}</div>
                {employee.branch.address && (
                  <div className="text-sm text-gray-500">{employee.branch.address}</div>
                )}
              </div>
            </div>
          )}

          {employee.phone && (
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Телефон</div>
                <a href={`tel:${employee.phone}`} className="font-medium text-blue-600 hover:underline">
                  {employee.phone}
                </a>
              </div>
            </div>
          )}

          {employee.email && (
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Email</div>
                <a href={`mailto:${employee.email}`} className="font-medium text-blue-600 hover:underline">
                  {employee.email}
                </a>
              </div>
            </div>
          )}

          {employee.telegram_username && (
            <div className="flex items-center gap-3">
              <AtSign className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Telegram</div>
                <a
                  href={`https://t.me/${employee.telegram_username.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
                  {employee.telegram_username}
                </a>
              </div>
            </div>
          )}

          {employee.bank_card_number && (
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Банковская карта</div>
                <div className="font-medium text-gray-900 font-mono">
                  **** **** **** {employee.bank_card_number.slice(-4)}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-500">Дата приёма на работу</div>
              <div className="font-medium text-gray-900">{formatDate(employee.hire_date)}</div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-all"
      >
        Выйти из аккаунта
      </button>
    </div>
  );

  const renderEventsTab = () => (
    <div className="space-y-4 pb-24">
      {eventsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Нет событий</h2>
          <p className="text-gray-500">Здесь будут отображаться важные уведомления</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(event => {
            const isNoShowEvent = event.event_type === 'no_show';
            const isNoShowAlertEvent = event.event_type === 'no_show_alert';
            const isUrgentShiftEvent = event.event_type === 'urgent_shift';
            const isShiftAcceptedEvent = event.event_type === 'shift_accepted';
            const isLateDeclineEvent = event.event_type === 'late_shift_cancel_request';
            const needsNoShowAction = isNoShowEvent && event.action_type === 'approve_reject' && event.action_status === 'pending';
            const needsUrgentAction = isUrgentShiftEvent && event.action_type === 'accept_shift' && event.action_status === 'pending';
            const needsLateDeclineAction = isLateDeclineEvent && event.action_type === 'approve_cancel' && event.action_status === 'pending';

            return (
              <div
                key={event.id}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
                  !event.is_read ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'
                } ${isUrgentShiftEvent && event.action_status === 'pending' ? 'border-orange-300 bg-orange-50/30' : ''}${needsLateDeclineAction ? ' border-red-300 bg-red-50/30' : ''}`}
                onClick={() => !event.is_read && markEventAsRead(event.id)}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {event.related_employee_photo_url ? (
                      <img
                        src={event.related_employee_photo_url}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        event.event_type === 'no_show' ? 'bg-red-100' :
                        event.event_type === 'no_show_alert' ? 'bg-red-100' :
                        event.event_type === 'no_show_approved' ? 'bg-green-100' :
                        event.event_type === 'no_show_rejected' ? 'bg-red-100' :
                        event.event_type === 'urgent_shift' ? 'bg-orange-100' :
                        event.event_type === 'shift_accepted' ? 'bg-green-100' :
                        event.event_type === 'late_shift_cancel_request' ? 'bg-red-100' :
                        'bg-blue-100'
                      }`}>
                        {event.event_type === 'no_show' ? (
                          <AlertCircle className="w-6 h-6 text-red-600" />
                        ) : event.event_type === 'no_show_alert' ? (
                          <AlertCircle className="w-6 h-6 text-red-600" />
                        ) : event.event_type === 'no_show_approved' ? (
                          <CheckSquare className="w-6 h-6 text-green-600" />
                        ) : event.event_type === 'urgent_shift' ? (
                          <RefreshCw className="w-6 h-6 text-orange-600" />
                        ) : event.event_type === 'shift_accepted' ? (
                          <Check className="w-6 h-6 text-green-600" />
                        ) : event.event_type === 'late_shift_cancel_request' ? (
                          <AlertTriangle className="w-6 h-6 text-red-600" />
                        ) : (
                          <Bell className="w-6 h-6 text-blue-600" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold text-gray-900">{event.title}</h4>
                        {!event.is_read && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></span>
                        )}
                      </div>
                      {event.related_employee_name && (
                        <p className="text-sm font-medium text-gray-700 mt-1">{event.related_employee_name}</p>
                      )}
                      {event.related_branch_name && (
                        <p className="text-sm text-gray-500">Филиал: {event.related_branch_name}</p>
                      )}
                      {event.related_shift_time && (
                        <p className="text-sm text-gray-500">Смена: {event.related_shift_time}</p>
                      )}
                      {isNoShowEvent && event.no_show_reason_text && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm text-amber-900">
                            <span className="font-semibold">Причина: </span>
                            {event.no_show_reason_text}
                          </p>
                        </div>
                      )}
                      {isLateDeclineEvent && event.no_show_reason_text && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-900">
                            <span className="font-semibold">Причина отказа: </span>
                            {event.no_show_reason_text}
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(event.created_at).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  {event.action_status && event.action_status !== 'pending' && (
                    <div className="mt-3">
                      <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
                        event.action_status === 'approved' ? 'bg-green-100 text-green-700' :
                        event.action_status === 'accepted' ? 'bg-green-100 text-green-700' :
                        event.action_status === 'cancelled' ? 'bg-gray-100 text-gray-700' :
                        event.action_status === 'decline_approved' ? 'bg-green-100 text-green-700' :
                        event.action_status === 'replacement_assigned' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {event.action_status === 'approved' ? 'Причина одобрена' :
                         event.action_status === 'accepted' ? 'Смена принята' :
                         event.action_status === 'cancelled' ? 'Смена принята другим сотрудником' :
                         event.action_status === 'decline_approved' ? 'Отказ одобрен' :
                         event.action_status === 'replacement_assigned' ? 'Назначена замена' :
                         'Причина отклонена'}
                      </div>
                      {isLateDeclineEvent && event.action_status === 'replacement_assigned' && event.replacement_employee_name && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-blue-800">
                                <span className="font-medium">Назначен: </span>
                                {event.replacement_employee_name}
                              </p>
                            </div>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!event.related_shift_id) return;

                                const { data: shiftData } = await supabase
                                  .from('schedule_shifts')
                                  .select('*, branch:branches(id, name, address, latitude, longitude)')
                                  .eq('id', event.related_shift_id)
                                  .maybeSingle();

                                if (shiftData) {
                                  setLateDeclineEventId(event.id);
                                  setAssignReplacementData({
                                    shiftId: shiftData.id,
                                    noShowEmployeeId: event.related_employee_id || '',
                                    shiftDate: shiftData.date,
                                    shiftStartTime: shiftData.start_time,
                                    shiftEndTime: shiftData.end_time,
                                    branchId: shiftData.branch_id,
                                    previousReplacementEmployeeId: event.replacement_employee_id || undefined,
                                  });
                                  setShowAssignReplacementModal(true);
                                }
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Изменить назначение"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                      {isNoShowEvent && event.action_type === 'approve_reject' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleChangeDecision(event.id);
                          }}
                          className="w-full mt-2 py-2 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                        >
                          Изменить решение
                        </button>
                      )}
                    </div>
                  )}

                  {needsNoShowAction && event.related_shift_id && (
                    <>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEventAction(event.id, event.related_shift_id!, 'approve');
                          }}
                          className="flex-1 py-2 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
                        >
                          Принять
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEventAction(event.id, event.related_shift_id!, 'reject');
                          }}
                          className="flex-1 py-2 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                        >
                          Отклонить
                        </button>
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!event.related_shift_id) return;

                          const { data: shiftData } = await supabase
                            .from('schedule_shifts')
                            .select('*, branch:branches(id)')
                            .eq('id', event.related_shift_id)
                            .maybeSingle();

                          if (shiftData) {
                            const shiftTime = event.related_shift_time || '';
                            const [shiftDate] = shiftTime.split(', ');

                            setAssignReplacementData({
                              shiftId: shiftData.id,
                              noShowEmployeeId: event.related_employee_id || '',
                              shiftDate: shiftData.date,
                              shiftStartTime: shiftData.start_time,
                              shiftEndTime: shiftData.end_time,
                              branchId: shiftData.branch_id,
                            });
                            setShowAssignReplacementModal(true);
                          }
                        }}
                        className="w-full mt-2 py-2 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Назначить замену
                      </button>
                    </>
                  )}

                  {needsUrgentAction && event.related_shift_id && (
                    <div className="mt-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcceptUrgentShift(event);
                        }}
                        className="w-full py-3 px-4 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-5 h-5" />
                        Принять смену
                      </button>
                    </div>
                  )}

                  {isNoShowAlertEvent && event.replacement_employee_name && event.replacement_employee_id && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-800">
                            <span className="font-medium">Назначен: </span>
                            {event.replacement_employee_name}
                          </p>
                        </div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!event.related_shift_id) return;

                            const { data: shiftData } = await supabase
                              .from('schedule_shifts')
                              .select('*, branch:branches(id, name, address, latitude, longitude)')
                              .eq('id', event.related_shift_id)
                              .maybeSingle();

                            if (shiftData) {
                              setNoShowAlertEventId(event.id);
                              setAssignReplacementData({
                                shiftId: shiftData.id,
                                noShowEmployeeId: event.related_employee_id || '',
                                shiftDate: shiftData.date,
                                shiftStartTime: shiftData.start_time,
                                shiftEndTime: shiftData.end_time,
                                branchId: shiftData.branch_id,
                                previousReplacementEmployeeId: event.replacement_employee_id || undefined,
                              });
                              setShowAssignReplacementModal(true);
                            }
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Изменить назначение"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {isNoShowAlertEvent && event.related_shift_id && !event.replacement_employee_name && (
                    <div className="mt-3">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!event.related_shift_id) return;

                          const { data: shiftData } = await supabase
                            .from('schedule_shifts')
                            .select('*, branch:branches(id, name, address, latitude, longitude)')
                            .eq('id', event.related_shift_id)
                            .maybeSingle();

                          if (shiftData) {
                            setNoShowAlertEventId(event.id);
                            setAssignReplacementData({
                              shiftId: shiftData.id,
                              noShowEmployeeId: event.related_employee_id || '',
                              shiftDate: shiftData.date,
                              shiftStartTime: shiftData.start_time,
                              shiftEndTime: shiftData.end_time,
                              branchId: shiftData.branch_id,
                            });
                            setShowAssignReplacementModal(true);
                          }
                        }}
                        className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Users className="w-5 h-5" />
                        Назначить
                      </button>
                    </div>
                  )}

                  {needsLateDeclineAction && event.related_shift_id && (
                    <div className="mt-3 space-y-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApproveLateDecline(event);
                        }}
                        className="w-full py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Check className="w-5 h-5" />
                        Принять отказ
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!event.related_shift_id) return;

                          const { data: shiftData } = await supabase
                            .from('schedule_shifts')
                            .select('*, branch:branches(id, name, address, latitude, longitude)')
                            .eq('id', event.related_shift_id)
                            .maybeSingle();

                          if (shiftData) {
                            setLateDeclineEventId(event.id);
                            setAssignReplacementData({
                              shiftId: shiftData.id,
                              noShowEmployeeId: event.related_employee_id || '',
                              shiftDate: shiftData.date,
                              shiftStartTime: shiftData.start_time,
                              shiftEndTime: shiftData.end_time,
                              branchId: shiftData.branch_id,
                            });
                            setShowAssignReplacementModal(true);
                          }
                        }}
                        className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-5 h-5" />
                        Назначить замену
                      </button>
                    </div>
                  )}

                  {isLateDeclineEvent && event.action_status === 'decline_approved' && event.action_status !== 'replacement_assigned' && event.related_shift_id && (
                    <div className="mt-3">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!event.related_shift_id) return;

                          const { data: shiftData } = await supabase
                            .from('schedule_shifts')
                            .select('*, branch:branches(id, name, address, latitude, longitude)')
                            .eq('id', event.related_shift_id)
                            .maybeSingle();

                          if (shiftData) {
                            setLateDeclineEventId(event.id);
                            setAssignReplacementData({
                              shiftId: shiftData.id,
                              noShowEmployeeId: event.related_employee_id || '',
                              shiftDate: shiftData.date,
                              shiftStartTime: shiftData.start_time,
                              shiftEndTime: shiftData.end_time,
                              branchId: shiftData.branch_id,
                            });
                            setShowAssignReplacementModal(true);
                          }
                        }}
                        className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Users className="w-5 h-5" />
                        Назначить замену
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderTasksTab = () => (
    <div className="space-y-4 pb-24">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <CheckSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Нет задач</h2>
        <p className="text-gray-500">Активные задачи будут отображаться здесь</p>
      </div>
    </div>
  );

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Главная', icon: <Home className="w-5 h-5" /> },
    { id: 'schedule', label: 'График', icon: <Calendar className="w-5 h-5" /> },
    { id: 'finances', label: 'Финансы', icon: <DollarSign className="w-5 h-5" /> },
    { id: 'profile', label: 'Данные', icon: <User className="w-5 h-5" /> },
    { id: 'events', label: 'События', icon: <Bell className="w-5 h-5" /> },
    { id: 'tasks', label: 'Задачи', icon: <CheckSquare className="w-5 h-5" /> },
  ];

  if (showKPIView && partner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="max-w-lg mx-auto">
          <EmployeeKPIView
            partnerId={partner.id}
            employeeId={employee.id}
            branchId={employee.branch_id}
            positionId={employee.position_id}
            onBack={() => setShowKPIView(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {partner?.logo_url ? (
                <img
                  src={partner.logo_url}
                  alt={partner.name}
                  className="h-8 object-contain"
                />
              ) : partner?.name ? (
                <span className="font-semibold text-gray-900">{partner.name}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {employee.photo_url ? (
                <img
                  src={employee.photo_url}
                  alt={employee.first_name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {employee.first_name.charAt(0)}
                </div>
              )}
              <span className="text-sm font-medium text-gray-700">
                {employee.first_name}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {activeTab === 'home' && renderHomeTab()}
        {activeTab === 'schedule' && renderScheduleTab()}
        {activeTab === 'finances' && renderFinancesTab()}
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'events' && renderEventsTab()}
        {activeTab === 'tasks' && renderTasksTab()}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="max-w-lg mx-auto">
          <div className="grid grid-cols-6 gap-1 px-2 py-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {tab.icon}
                <span className="text-[10px] font-medium truncate w-full text-center">{tab.label}</span>
                {tab.id === 'events' && unreadEventsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadEventsCount > 9 ? '9+' : unreadEventsCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {bottomSheetOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={() => setBottomSheetOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[75vh] overflow-hidden animate-slide-up">
            <div className="max-w-lg mx-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">Сотрудники на смене</h3>
                    {selectedDate && (
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(selectedDate).toLocaleDateString('ru-RU', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    )}
                    {selectedBranch && (
                      <div className="flex items-center gap-2 mt-2 text-sm">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        <div>
                          <span className="font-semibold text-gray-900">{selectedBranch.name}</span>
                          {selectedBranch.address && (
                            <span className="text-gray-500 ml-1">• {selectedBranch.address}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setBottomSheetOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto max-h-[calc(75vh-96px)] px-6 py-4">
                {colleaguesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : colleagues.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Нет назначенных сотрудников</p>
                    <p className="text-sm text-gray-400 mt-2">В этот день смены не запланированы</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedDate && !shiftsByDate[selectedDate]?.length && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-sm font-medium text-amber-900">У вас нет смены в этот день</p>
                        <p className="text-xs text-amber-700 mt-1">Ниже показан состав дня</p>
                      </div>
                    )}
                    <div className="space-y-6">
                      {Object.entries(
                        colleagues.reduce((acc, colleague) => {
                          const positionName = colleague.position?.name || 'Без должности';
                          if (!acc[positionName]) {
                            acc[positionName] = [];
                          }
                          acc[positionName].push(colleague);
                          return acc;
                        }, {} as Record<string, ColleagueInfo[]>)
                      ).map(([positionName, groupedColleagues]) => (
                        <div key={positionName}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                              {positionName}
                            </h4>
                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                              {groupedColleagues.length}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {groupedColleagues.map(colleague => {
                              const isPastClosedShift = selectedDate &&
                                new Date(selectedDate + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0)) &&
                                colleague.status === 'closed';

                              const isPastDate = selectedDate &&
                                new Date(selectedDate + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0));

                              const isCurrentEmployee = colleague.id === employee.id;
                              const currentEmployeeShift = isCurrentEmployee && selectedDate ? shiftsByDate[selectedDate]?.[0] : null;
                              const confirmStatus = currentEmployeeShift?.confirmation_status;
                              const showConfirmationButtons = isCurrentEmployee && currentEmployeeShift && currentEmployeeShift.status === 'scheduled' && !isPastDate;

                              return (
                                <div key={colleague.shift_id || colleague.id}>
                                  <div
                                    onClick={() => {
                                      if (isPastClosedShift) {
                                        setSelectedColleagueShift(colleague);
                                        setShiftDetailsModalOpen(true);
                                      }
                                    }}
                                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                                      colleague.id === employee.id
                                        ? 'bg-blue-100 border-2 border-blue-300'
                                        : 'bg-gray-50 hover:bg-gray-100'
                                    } ${isPastClosedShift ? 'cursor-pointer active:scale-98' : ''}`}
                                  >
                                  {colleague.photo_url ? (
                                    <img
                                      src={colleague.photo_url}
                                      alt={colleague.first_name}
                                      className="w-12 h-12 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center text-white font-bold">
                                      {colleague.first_name.charAt(0)}{colleague.last_name?.charAt(0) || ''}
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <div className="font-medium text-gray-900">
                                        {colleague.first_name} {colleague.last_name || ''}
                                      </div>
                                      {colleague.id === employee.id && (
                                        <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                          Вы
                                        </span>
                                      )}
                                      {colleague.status === 'opened' && (
                                        <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                          Смена открыта
                                        </span>
                                      )}
                                      {colleague.status === 'closed' && (
                                        <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                                          Смена закрыта
                                        </span>
                                      )}
                                      {colleague.status === 'scheduled' && (
                                        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                          Не открыта
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-gray-600 mt-1 flex-wrap">
                                      <div className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="font-medium">
                                          {colleague.start_time.slice(0, 5)} - {colleague.end_time.slice(0, 5)}
                                        </span>
                                      </div>
                                      {colleague.late_minutes > 0 && (
                                        <div className="flex items-center gap-1 text-red-600">
                                          <Timer className="w-3.5 h-3.5" />
                                          <span className="font-semibold">
                                            -{formatMinutesToDuration(colleague.late_minutes)}
                                          </span>
                                        </div>
                                      )}
                                      {isPastClosedShift && colleague.worked_minutes !== undefined && colleague.worked_minutes > 0 && (
                                        <div className="flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
                                          <CheckSquare className="w-3.5 h-3.5" />
                                          <span className="font-semibold text-xs">
                                            Отработано: {formatMinutesToDuration(colleague.worked_minutes)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {showConfirmationButtons && currentEmployeeShift && (
                                  <div className="mt-2 space-y-2">
                                    {confirmStatus === 'late_decline_pending' && (
                                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                                          <Clock className="w-4 h-4" />
                                          <span>Отмена на рассмотрении</span>
                                        </div>
                                        <p className="text-xs text-amber-600 mt-1">
                                          Ваш запрос на отмену отправлен ответственному
                                        </p>
                                      </div>
                                    )}

                                    {(confirmStatus === 'pending' || confirmStatus === 'not_required' || !confirmStatus) && (
                                      <div className="flex gap-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedShiftForConfirm(currentEmployeeShift);
                                            setShowConfirmShiftModal(true);
                                          }}
                                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                                        >
                                          <Check className="w-4 h-4" />
                                          Подтвердить
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedShiftForConfirm(currentEmployeeShift);
                                            const isLate = checkIfLateCancel(currentEmployeeShift);
                                            setLateCancelWarning(isLate);
                                            setShowCancelShiftModal(true);
                                          }}
                                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                                        >
                                          <X className="w-4 h-4" />
                                          Отменить
                                        </button>
                                      </div>
                                    )}

                                    {confirmStatus === 'confirmed' && !isPastDate && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedShiftForConfirm(currentEmployeeShift);
                                          const isLate = checkIfLateCancel(currentEmployeeShift);
                                          setLateCancelWarning(isLate);
                                          setShowCancelShiftModal(true);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                                      >
                                        <X className="w-4 h-4" />
                                        Отменить смену
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Модальное окно деталей прошлой смены */}
      {shiftDetailsModalOpen && selectedColleagueShift && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 transition-opacity"
            onClick={() => {
              setShiftDetailsModalOpen(false);
              setSelectedColleagueShift(null);
            }}
          />
          <div className="fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 bg-white sm:rounded-3xl shadow-2xl z-50 overflow-hidden sm:max-w-2xl sm:w-[calc(100vw-2rem)] animate-scale-up max-h-screen sm:max-h-[85vh]">
            <div className="h-full flex flex-col">
              <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Детали смены</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 truncate">
                      {selectedDate && new Date(selectedDate).toLocaleDateString('ru-RU', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShiftDetailsModalOpen(false);
                      setSelectedColleagueShift(null);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4">
                <div className="space-y-3 sm:space-y-4">
                  {/* Информация о сотруднике */}
                  <div className="flex items-center gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl">
                    {selectedColleagueShift.photo_url ? (
                      <img
                        src={selectedColleagueShift.photo_url}
                        alt={selectedColleagueShift.first_name}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl flex-shrink-0">
                        {selectedColleagueShift.first_name.charAt(0)}{selectedColleagueShift.last_name?.charAt(0) || ''}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-base sm:text-lg truncate">
                        {selectedColleagueShift.first_name} {selectedColleagueShift.last_name || ''}
                      </div>
                      {selectedColleagueShift.position && (
                        <div className="text-sm text-gray-600 truncate">{selectedColleagueShift.position.name}</div>
                      )}
                    </div>
                  </div>

                  {/* Филиал */}
                  {selectedBranch && (
                    <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl">
                      <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 break-words">{selectedBranch.name}</div>
                        {selectedBranch.address && (
                          <div className="text-sm text-gray-500 break-words">{selectedBranch.address}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Плановое время */}
                  <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-gray-500 mb-1 sm:mb-2">Плановое время</div>
                    <div className="font-semibold text-gray-900 text-base sm:text-lg">
                      {formatTime(selectedColleagueShift.start_time)} - {formatTime(selectedColleagueShift.end_time)}
                    </div>
                  </div>

                  {/* Фактические времена */}
                  {selectedColleagueShift.actual_start_at && (
                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 space-y-2 sm:space-y-3">
                      <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                        <span className="text-gray-500 flex items-center gap-1.5 flex-shrink-0">
                          <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Фактическое начало</span>
                          <span className="sm:hidden">Начало</span>
                        </span>
                        <span className="font-medium text-gray-900 text-right">
                          {new Date(selectedColleagueShift.actual_start_at).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {selectedColleagueShift.actual_end_at && (
                        <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                          <span className="text-gray-500 flex items-center gap-1.5 flex-shrink-0">
                            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">Фактическое окончание</span>
                            <span className="sm:hidden">Окончание</span>
                          </span>
                          <span className="font-medium text-gray-900 text-right">
                            {new Date(selectedColleagueShift.actual_end_at).toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                      {selectedColleagueShift.late_minutes > 0 && (
                        <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-gray-200 gap-2">
                          <span className="text-red-600 flex items-center gap-1.5 flex-shrink-0">
                            <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Опоздание
                          </span>
                          <span className="font-medium text-red-600 text-right">
                            -{selectedColleagueShift.late_minutes} мин
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Отрезки работы и итоговое время */}
                  {selectedColleagueShift.work_segments && selectedColleagueShift.work_segments.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-gray-700">Фактически отработано:</span>
                        <span className="font-bold text-base sm:text-lg text-blue-600 flex-shrink-0">
                          {selectedColleagueShift.worked_minutes !== undefined
                            ? formatMinutesToDuration(selectedColleagueShift.worked_minutes)
                            : '--'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="text-[10px] sm:text-xs font-semibold text-gray-600 uppercase tracking-wide">Отрезки работы:</div>
                        {selectedColleagueShift.work_segments
                          .sort((a, b) => new Date(a.segment_start_at).getTime() - new Date(b.segment_start_at).getTime())
                          .map((segment) => (
                            <div key={segment.id} className="flex items-center gap-2 text-xs sm:text-sm">
                              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                              <span className="text-gray-700">
                                {new Date(segment.segment_start_at).toLocaleTimeString('ru-RU', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                                {' - '}
                                {segment.segment_end_at
                                  ? new Date(segment.segment_end_at).toLocaleTimeString('ru-RU', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : 'в работе'}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Информация о закрытии */}
                  {selectedColleagueShift.auto_closed && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex items-start gap-2 text-amber-900">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span className="text-xs sm:text-sm font-medium break-words">
                          Смена закрыта автоматически
                          {selectedColleagueShift.closed_by && ` (${selectedColleagueShift.closed_by})`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showNoShowReasonModal && selectedNoShowShift && noShowReasonsEnabled && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 transition-opacity"
            onClick={() => {
              setShowNoShowReasonModal(false);
              setSelectedNoShowShift(null);
              setSelectedNoShowReason('');
              setIsCustomReasonMode(false);
              setCustomNoShowReason('');
            }}
          />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 max-w-lg mx-auto overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Причина не выхода</h3>
                <button
                  onClick={() => {
                    setShowNoShowReasonModal(false);
                    setSelectedNoShowShift(null);
                    setSelectedNoShowReason('');
                    setIsCustomReasonMode(false);
                    setCustomNoShowReason('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Выберите причину вашего отсутствия на смене
              </p>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {noShowReasons.map((reason, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSelectedNoShowReason(reason);
                      setIsCustomReasonMode(false);
                      setCustomNoShowReason('');
                    }}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      selectedNoShowReason === reason && !isCustomReasonMode
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className={`font-medium ${
                      selectedNoShowReason === reason && !isCustomReasonMode ? 'text-blue-700' : 'text-gray-700'
                    }`}>
                      {reason}
                    </span>
                  </button>
                ))}

                <button
                  onClick={() => {
                    setIsCustomReasonMode(true);
                    setSelectedNoShowReason('');
                  }}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    isCustomReasonMode
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className={`font-medium ${
                    isCustomReasonMode ? 'text-blue-700' : 'text-gray-700'
                  }`}>
                    Свой вариант
                  </span>
                </button>

                {isCustomReasonMode && (
                  <div className="mt-3">
                    <textarea
                      value={customNoShowReason}
                      onChange={(e) => setCustomNoShowReason(e.target.value)}
                      placeholder="Введите причину отсутствия..."
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:outline-none resize-none"
                      rows={4}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowNoShowReasonModal(false);
                  setSelectedNoShowShift(null);
                  setSelectedNoShowReason('');
                  setIsCustomReasonMode(false);
                  setCustomNoShowReason('');
                }}
                className="flex-1 py-2.5 px-4 text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={saveNoShowReason}
                disabled={(!isCustomReasonMode && !selectedNoShowReason) || (isCustomReasonMode && !customNoShowReason.trim()) || savingNoShowReason}
                className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingNoShowReason ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </>
      )}

      {showReplacementModal && selectedReplacementShift && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 transition-opacity"
            onClick={() => {
              setShowReplacementModal(false);
              setSelectedReplacementShift(null);
              setSelectedReplacementEmployee(null);
              setReplacementStartTime('');
            }}
          />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 max-w-2xl mx-auto overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Назначить подмену</h3>
                <button
                  onClick={() => {
                    setShowReplacementModal(false);
                    setSelectedReplacementShift(null);
                    setSelectedReplacementEmployee(null);
                    setReplacementStartTime('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Выберите сотрудника для подмены и укажите время начала
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-3 text-sm">
                  <div className="font-medium text-gray-700">Информация о смене</div>
                  <div className="text-gray-600 mt-1">
                    {new Date(selectedReplacementShift.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                    {' '}
                    {formatTime(selectedReplacementShift.start_time)} - {formatTime(selectedReplacementShift.end_time)}
                  </div>
                  <div className="text-gray-500 text-xs mt-1">{selectedReplacementShift.branch?.name}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Время начала смены для подменяющего
                  </label>
                  <input
                    type="time"
                    value={replacementStartTime}
                    onChange={(e) => setReplacementStartTime(e.target.value)}
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Выберите сотрудника
                  </label>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {Object.entries(
                      allEmployees.reduce((acc, emp) => {
                        const positionName = emp.position?.name || 'Без должности';
                        if (!acc[positionName]) acc[positionName] = [];
                        acc[positionName].push(emp);
                        return acc;
                      }, {} as Record<string, Employee[]>)
                    ).map(([positionName, employees]) => (
                      <div key={positionName}>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">
                          {positionName}
                        </div>
                        <div className="space-y-2">
                          {employees.map((emp) => {
                            const hasConflict = !!emp.shiftOnSelectedDate;
                            const totalHours = emp.shiftOnSelectedDate?.total_minutes
                              ? Math.round((emp.shiftOnSelectedDate.total_minutes / 60) * 10) / 10
                              : 0;

                            return (
                              <button
                                key={emp.id}
                                onClick={() => !hasConflict && setSelectedReplacementEmployee(emp.id)}
                                disabled={hasConflict}
                                className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                                  hasConflict
                                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-75'
                                    : selectedReplacementEmployee === emp.id
                                      ? 'border-blue-600 bg-blue-50'
                                      : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                {emp.photo_url ? (
                                  <img
                                    src={emp.photo_url}
                                    alt={emp.first_name}
                                    className={`w-10 h-10 rounded-full object-cover ${hasConflict ? 'grayscale opacity-60' : ''}`}
                                  />
                                ) : (
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                                    hasConflict
                                      ? 'bg-gray-400'
                                      : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                                  }`}>
                                    {emp.first_name.charAt(0)}
                                  </div>
                                )}
                                <div className="flex-1">
                                  <div className={`font-medium ${
                                    hasConflict
                                      ? 'text-gray-500'
                                      : selectedReplacementEmployee === emp.id ? 'text-blue-700' : 'text-gray-700'
                                  }`}>
                                    {emp.first_name} {emp.last_name || ''}
                                  </div>
                                  {emp.branch?.name && (
                                    <div className={`text-xs ${hasConflict ? 'text-gray-400' : 'text-gray-500'}`}>
                                      {emp.branch.name}
                                    </div>
                                  )}
                                  {!hasConflict && emp.weeklyHours !== undefined && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      📊 {emp.weeklyHours} ч/нед
                                    </div>
                                  )}
                                  {emp.shiftOnSelectedDate && (
                                    <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg">
                                      <div className="flex items-center gap-1 text-amber-700 font-medium text-xs mb-1">
                                        ⚠️ Уже в графике
                                      </div>
                                      <div className="text-xs text-amber-600 space-y-0.5">
                                        <div>Филиал: {emp.shiftOnSelectedDate.branch_name}</div>
                                        <div>Время: {emp.shiftOnSelectedDate.start_time.slice(0, 5)} - {emp.shiftOnSelectedDate.end_time.slice(0, 5)}</div>
                                        {totalHours > 0 && <div>Часов: {totalHours} ч</div>}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {selectedReplacementEmployee === emp.id && !hasConflict && (
                                  <Check className="w-5 h-5 text-blue-600" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
              <button
                onClick={() => {
                  setShowReplacementModal(false);
                  setSelectedReplacementShift(null);
                  setSelectedReplacementEmployee(null);
                  setReplacementStartTime('');
                }}
                className="flex-1 py-2.5 px-4 text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={assignReplacement}
                disabled={!selectedReplacementEmployee || !replacementStartTime || assigningReplacement}
                className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigningReplacement ? 'Назначение...' : 'Назначить'}
              </button>
            </div>
          </div>
        </>
      )}

      {showEtaModal && selectedUrgentEvent && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 transition-opacity"
            onClick={() => {
              setShowEtaModal(false);
              setSelectedUrgentEvent(null);
            }}
          />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 max-w-lg mx-auto overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Время прибытия</h3>
                <button
                  onClick={() => {
                    setShowEtaModal(false);
                    setSelectedUrgentEvent(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Через сколько вы сможете быть на смене?
              </p>
              {selectedUrgentEvent.related_branch_name && (
                <p className="text-sm text-gray-600 mt-2">
                  Филиал: {selectedUrgentEvent.related_branch_name}
                </p>
              )}
              {selectedUrgentEvent.related_shift_time && (
                <p className="text-sm text-gray-600">
                  Смена: {selectedUrgentEvent.related_shift_time}
                </p>
              )}
            </div>

            <div className="p-4">
              <div className="grid grid-cols-3 gap-3">
                {[10, 20, 30, 40, 60, 90, 120].map(minutes => (
                  <button
                    key={minutes}
                    onClick={() => handleSelectEta(minutes)}
                    disabled={acceptingShift}
                    className="py-3 px-4 bg-orange-100 text-orange-700 rounded-xl font-medium hover:bg-orange-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {minutes} мин
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowEtaModal(false);
                  setSelectedUrgentEvent(null);
                }}
                disabled={acceptingShift}
                className="w-full py-2.5 px-4 text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
            </div>
          </div>
        </>
      )}

      {showConfirmShiftModal && selectedShiftForConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 transition-opacity"
            onClick={() => {
              setShowConfirmShiftModal(false);
              setSelectedShiftForConfirm(null);
            }}
          />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 max-w-lg mx-auto overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Подтверждение смены</h3>
                <button
                  onClick={() => {
                    setShowConfirmShiftModal(false);
                    setSelectedShiftForConfirm(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="bg-blue-50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-900">
                    {new Date(selectedShiftForConfirm.date).toLocaleDateString('ru-RU', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-700">
                    {formatTime(selectedShiftForConfirm.start_time)} - {formatTime(selectedShiftForConfirm.end_time)}
                  </span>
                </div>
                {selectedShiftForConfirm.branch && (
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700">{selectedShiftForConfirm.branch.name}</span>
                  </div>
                )}
              </div>

              {(selectedShiftForConfirm.assignment?.assignment_status === 'confirmed' || selectedShiftForConfirm.confirmation_status === 'confirmed') && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 text-green-700 font-medium">
                    <Check className="w-5 h-5" />
                    Смена подтверждена
                  </div>
                  {(selectedShiftForConfirm.assignment?.confirmed_at || selectedShiftForConfirm.confirmed_at) && (
                    <p className="text-sm text-green-600 mt-1">
                      {new Date(selectedShiftForConfirm.assignment?.confirmed_at || selectedShiftForConfirm.confirmed_at || '').toLocaleString('ru-RU')}
                    </p>
                  )}
                </div>
              )}

              {selectedShiftForConfirm.confirmation_status === 'late_decline_pending' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 text-amber-700 font-medium">
                    <Clock className="w-5 h-5" />
                    Отмена на рассмотрении
                  </div>
                  <p className="text-sm text-amber-600 mt-1">
                    Ваш запрос на отмену отправлен ответственному. Ожидайте решения.
                  </p>
                  {selectedShiftForConfirm.decline_reason && (
                    <p className="text-sm text-gray-600 mt-2">
                      Причина: {selectedShiftForConfirm.decline_reason}
                    </p>
                  )}
                </div>
              )}

              {selectedShiftForConfirm.assignment?.assignment_status === 'declined' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 text-red-700 font-medium">
                    <X className="w-5 h-5" />
                    Отказ от смены
                  </div>
                  {selectedShiftForConfirm.assignment.declined_at && (
                    <p className="text-sm text-red-600 mt-1">
                      {new Date(selectedShiftForConfirm.assignment.declined_at).toLocaleString('ru-RU')}
                    </p>
                  )}
                </div>
              )}

              {(selectedShiftForConfirm.confirmation_status === 'pending' || (!selectedShiftForConfirm.assignment || selectedShiftForConfirm.assignment.assignment_status === 'pending_confirm')) && selectedShiftForConfirm.confirmation_status !== 'confirmed' && selectedShiftForConfirm.confirmation_status !== 'late_decline_pending' && (() => {
                const modalShiftDate = new Date(selectedShiftForConfirm.date + 'T00:00:00');
                const todayDate = new Date(new Date().setHours(0, 0, 0, 0));
                const isModalPastDate = modalShiftDate < todayDate;
                return !isModalPastDate;
              })() && (
                <p className="text-sm text-gray-600 mb-4">
                  Подтвердите вашу готовность выйти на эту смену или откажитесь, если не можете.
                </p>
              )}
            </div>

            {(selectedShiftForConfirm.confirmation_status === 'pending' || (!selectedShiftForConfirm.assignment || selectedShiftForConfirm.assignment.assignment_status === 'pending_confirm')) && selectedShiftForConfirm.confirmation_status !== 'confirmed' && selectedShiftForConfirm.confirmation_status !== 'late_decline_pending' && (() => {
              const modalShiftDate = new Date(selectedShiftForConfirm.date + 'T00:00:00');
              const todayDate = new Date(new Date().setHours(0, 0, 0, 0));
              const isModalPastDate = modalShiftDate < todayDate;
              return !isModalPastDate;
            })() && (
              <div className="p-4 border-t border-gray-200 space-y-3">
                <button
                  onClick={() => confirmShift(selectedShiftForConfirm)}
                  disabled={confirmingShift}
                  className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {confirmingShift ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Подтвердить смену
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    const isLate = checkIfLateCancel(selectedShiftForConfirm);
                    setLateCancelWarning(isLate);
                    setShowCancelShiftModal(true);
                  }}
                  disabled={confirmingShift}
                  className="w-full py-3 bg-red-100 text-red-700 rounded-xl font-semibold hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Отказаться от смены
                </button>
              </div>
            )}

            {(selectedShiftForConfirm.assignment?.assignment_status === 'confirmed' || selectedShiftForConfirm.confirmation_status === 'confirmed') && !selectedShiftForConfirm.confirmation_status?.includes('decline') && (() => {
              const modalShiftDate = new Date(selectedShiftForConfirm.date + 'T00:00:00');
              const todayDate = new Date(new Date().setHours(0, 0, 0, 0));
              const isModalPastDate = modalShiftDate < todayDate;
              return !isModalPastDate;
            })() && (
              <div className="p-4 border-t border-gray-200 space-y-3">
                <button
                  onClick={() => {
                    const isLate = checkIfLateCancel(selectedShiftForConfirm);
                    setLateCancelWarning(isLate);
                    setShowCancelShiftModal(true);
                  }}
                  className="w-full py-3 bg-red-100 text-red-700 rounded-xl font-semibold hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Отменить смену
                </button>
                <button
                  onClick={() => {
                    setShowConfirmShiftModal(false);
                    setSelectedShiftForConfirm(null);
                  }}
                  className="w-full py-3 text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Закрыть
                </button>
              </div>
            )}

            {(selectedShiftForConfirm.assignment?.assignment_status === 'declined' || selectedShiftForConfirm.confirmation_status === 'late_decline_pending') && (
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowConfirmShiftModal(false);
                    setSelectedShiftForConfirm(null);
                  }}
                  className="w-full py-3 text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Закрыть
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {showDeclineModal && selectedShiftForConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[60] transition-opacity"
            onClick={() => {
              setShowDeclineModal(false);
              setSelectedDeclineReason('');
              setDeclineComment('');
            }}
          />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[60] max-w-lg mx-auto overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Причина отказа</h3>
                <button
                  onClick={() => {
                    setShowDeclineModal(false);
                    setSelectedDeclineReason('');
                    setDeclineComment('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Укажите причину, по которой вы не можете выйти на смену
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {declineReasons.map(reason => (
                  <button
                    key={reason.id}
                    onClick={() => setSelectedDeclineReason(reason.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                      selectedDeclineReason === reason.id
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {reason.reason_text}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Комментарий (необязательно)
                </label>
                <textarea
                  value={declineComment}
                  onChange={(e) => setDeclineComment(e.target.value)}
                  placeholder="Дополнительная информация..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowDeclineModal(false);
                  setSelectedDeclineReason('');
                  setDeclineComment('');
                }}
                className="flex-1 py-2.5 text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Назад
              </button>
              <button
                onClick={() => declineShift(selectedShiftForConfirm)}
                disabled={!selectedDeclineReason || confirmingShift}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirmingShift ? 'Отправка...' : 'Отказаться'}
              </button>
            </div>
          </div>
        </>
      )}

      {showCancelShiftModal && selectedShiftForConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[60] transition-opacity"
            onClick={() => {
              setShowCancelShiftModal(false);
              setCancelReasonText('');
              setLateCancelWarning(false);
            }}
          />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[60] max-w-lg mx-auto overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Отмена смены</h3>
                <button
                  onClick={() => {
                    setShowCancelShiftModal(false);
                    setCancelReasonText('');
                    setLateCancelWarning(false);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Укажите причину отмены смены
              </p>
            </div>

            {lateCancelWarning && (
              <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 text-amber-700 font-medium mb-1">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Поздняя отмена</span>
                </div>
                <p className="text-sm text-amber-600">
                  До начала смены осталось менее {confirmDeadlineHours} часов. Ваш запрос будет отправлен на рассмотрение ответственному.
                </p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2 mb-4">
                {declineReasons.map(reason => (
                  <button
                    key={reason.id}
                    onClick={() => setCancelReasonText(reason.reason_text)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                      cancelReasonText === reason.reason_text
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {reason.reason_text}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Своя причина
                </label>
                <textarea
                  value={cancelReasonText}
                  onChange={(e) => setCancelReasonText(e.target.value)}
                  placeholder="Введите причину отмены..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowCancelShiftModal(false);
                  setCancelReasonText('');
                  setLateCancelWarning(false);
                }}
                className="flex-1 py-2.5 text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Назад
              </button>
              <button
                onClick={() => cancelShift(selectedShiftForConfirm, cancelReasonText)}
                disabled={!cancelReasonText.trim() || confirmingShift}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirmingShift ? 'Отправка...' : lateCancelWarning ? 'Отправить на решение' : 'Отменить смену'}
              </button>
            </div>
          </div>
        </>
      )}

      {showAssignReplacementModal && assignReplacementData && employee && partner && (
        <AssignReplacementModal
          isOpen={showAssignReplacementModal}
          onClose={() => {
            setShowAssignReplacementModal(false);
            setAssignReplacementData(null);
            setLateDeclineEventId(null);
            setNoShowAlertEventId(null);
          }}
          shiftId={assignReplacementData.shiftId}
          noShowEmployeeId={assignReplacementData.noShowEmployeeId}
          shiftDate={assignReplacementData.shiftDate}
          shiftStartTime={assignReplacementData.shiftStartTime}
          shiftEndTime={assignReplacementData.shiftEndTime}
          branchId={assignReplacementData.branchId}
          partnerId={partner.id}
          previousReplacementEmployeeId={assignReplacementData.previousReplacementEmployeeId}
          replacementType={noShowAlertEventId ? 'without_reason' : 'with_reason'}
          onSuccess={async (replacementInfo) => {
            if (lateDeclineEventId) {
              const now = new Date().toISOString();
              await supabase
                .from('employee_events')
                .update({
                  action_status: 'replacement_assigned',
                  action_taken_at: now,
                  is_read: true,
                  read_at: now,
                  replacement_employee_id: replacementInfo.employeeId,
                  replacement_employee_name: replacementInfo.employeeName,
                })
                .eq('id', lateDeclineEventId);

              setEvents(prev => prev.map(e =>
                e.id === lateDeclineEventId
                  ? {
                      ...e,
                      action_status: 'replacement_assigned',
                      action_taken_at: now,
                      is_read: true,
                      read_at: now,
                      replacement_employee_id: replacementInfo.employeeId,
                      replacement_employee_name: replacementInfo.employeeName,
                    }
                  : e
              ));
              setLateDeclineEventId(null);
            }
            if (noShowAlertEventId) {
              const now = new Date().toISOString();
              const updateData: any = {
                is_read: true,
                read_at: now,
                replacement_employee_id: replacementInfo.employeeId,
                replacement_employee_name: replacementInfo.employeeName,
              };

              // Для no_show без причины - обновляем related_shift_id на новую смену
              if (replacementInfo.newShiftId) {
                updateData.related_shift_id = replacementInfo.newShiftId;
              }

              await supabase
                .from('employee_events')
                .update(updateData)
                .eq('id', noShowAlertEventId);

              setEvents(prev => prev.map(e =>
                e.id === noShowAlertEventId
                  ? {
                      ...e,
                      ...updateData,
                    }
                  : e
              ));
              setNoShowAlertEventId(null);
            }
            loadEvents();
            loadShifts();
          }}
        />
      )}
    </div>
  );
}
