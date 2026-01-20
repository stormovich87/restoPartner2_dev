import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Menu, X, LayoutDashboard, ShoppingCart, History, Settings, FileText, Lock, BarChart3, LogOut, AlertCircle, ArrowLeft, Building2, Truck, CreditCard, Clock, Users, Tag, Package, MapPin, Briefcase, UserCheck, StopCircle, MoreVertical, Phone, UserCircle, Printer, CalendarDays, Users2, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDevMode } from '../../contexts/DevModeContext';
import { BinotelProvider, useBinotel } from '../../contexts/BinotelContext';
import { supabase } from '../../lib/supabase';
import { Partner as PartnerType, StaffUser } from '../../types';
import Orders from './Orders';
import Branches from './Branches';
import Couriers from './Couriers';
import CourierZones from './CourierZones';
import PaymentMethods from './PaymentMethods';
import GeneralSettings from './GeneralSettings';
import Executors from './Executors';
import LogViewer from '../../components/LogViewer';
import ShiftManagement from '../../components/ShiftManagement';
import ShiftManagementModal from '../../components/ShiftManagementModal';
import PosterSettings from './PosterSettings';
import MenuCategories from './MenuCategories';
import MenuProducts from './MenuProducts';
import Positions from './Positions';
import Staff from './Staff';
import OrderHistory from './OrderHistory';
import CreateOrderModal from '../../components/CreateOrderModal';
import EditOrderModal from '../../components/EditOrderModal';
import Clients from './Clients';
import PrintSettings from './PrintSettings';
import WorkSchedule from './WorkSchedule';
import ScheduleSettings from './ScheduleSettings';
import Employees from './Employees';
import KPISettings from './KPISettings';
import BinotelWaitStats from './BinotelWaitStats';
import IncomingCallsWidget from '../../components/IncomingCallsWidget';
import ClientDrawer from '../../components/ClientDrawer';
import ExternalCouriersStatusModal from '../../components/ExternalCouriersStatusModal';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  sections?: string[];
}

const allMenuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard, path: 'dashboard', sections: ['dashboard'] },
  { id: 'orders', label: 'Заказы', icon: ShoppingCart, path: 'orders', sections: ['orders'] },
  { id: 'clients', label: 'Клиенты', icon: UserCircle, path: 'clients', sections: ['clients'] },
  { id: 'menu', label: 'Меню', icon: Package, path: 'menu', sections: ['menu_categories', 'menu_products'] },
  { id: 'history', label: 'История', icon: History, path: 'history', sections: ['history'] },
  { id: 'work-schedule', label: 'График работы', icon: CalendarDays, path: 'work-schedule', sections: ['work_schedule'] },
  { id: 'employees', label: 'Сотрудники', icon: Users2, path: 'employees', sections: ['employees'] },
  { id: 'kpi', label: 'KPI', icon: TrendingUp, path: 'kpi', sections: ['kpi'] },
  { id: 'settings', label: 'Настройки', icon: Settings, path: 'settings', sections: ['general_settings', 'poster_settings', 'branches', 'couriers', 'courier_zones', 'executors', 'payment_methods', 'print_settings'] },
  { id: 'logs', label: 'Логи', icon: FileText, path: 'logs', sections: ['logs'] },
  { id: 'access', label: 'Доступы', icon: Lock, path: 'access', sections: ['positions', 'staff'] },
  { id: 'reports', label: 'Телефония', icon: Phone, path: 'reports', sections: ['reports'] },
];

export default function PartnerDashboard() {
  const { partnerPrefix } = useParams();
  const navigate = useNavigate();
  const { partner: authPartner, user, logout, role, login } = useAuth();
  const { devViewPartnerPrefix, setDevViewPartnerPrefix } = useDevMode();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');
  const [settingsTab, setSettingsTab] = useState('general');
  const [menuTab, setMenuTab] = useState('categories');
  const [accessTab, setAccessTab] = useState('positions');
  const [workScheduleTab, setWorkScheduleTab] = useState('schedule');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partner, setPartner] = useState<PartnerType | null>(authPartner);
  const [orderStats, setOrderStats] = useState({ total: 0, completedOnTime: 0, completedDelayed: 0, inProgress: 0, overdue: 0, avgDelay: 0, avgCompletionTime: 0, totalRevenue: 0, inProgressAvgWaitTime: 0, inProgressAvgDelay: 0 });
  const [activeExternalCouriers, setActiveExternalCouriers] = useState(0);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [openShifts, setOpenShifts] = useState<any[]>([]);
  const [closedShifts, setClosedShifts] = useState<any[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
  const [showCurrentShift, setShowCurrentShift] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showIncomingCallModal, setShowIncomingCallModal] = useState(false);
  const [incomingCallPhone, setIncomingCallPhone] = useState('');
  const [incomingCallBranchId, setIncomingCallBranchId] = useState<string | null>(null);
  const [initialSourceCallId, setInitialSourceCallId] = useState<string | null>(null);
  const [initialOrderItems, setInitialOrderItems] = useState<Array<{
    product_poster_id: number;
    product_name: string;
    base_price: number;
    quantity: number;
    modifiers: Array<{
      modifier_poster_id: number;
      modifier_name: string;
      price: number;
    }>;
  }> | undefined>(undefined);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [showExternalCouriersModal, setShowExternalCouriersModal] = useState(false);
  const isFounder = role?.name === 'founder';
  const isDevMode = devViewPartnerPrefix === partnerPrefix;

  const isStaffUser = (u: typeof user): u is StaffUser => {
    return u !== null && 'is_staff' in u && u.is_staff === true;
  };

  const staffUser = isStaffUser(user) ? user : null;
  const staffPermissions = staffUser?.position?.position_permissions?.map(p => p.section) || [];
  const staffBranchIds = staffUser?.position?.position_branches?.map(pb => pb.branch_id) || [];

  const menuItems = useMemo(() => {
    if (!staffUser) {
      return allMenuItems;
    }

    return allMenuItems.filter(item => {
      if (item.sections && item.sections.length > 0) {
        return item.sections.some(section => staffPermissions.includes(section));
      }
      return true;
    });
  }, [staffUser, staffPermissions]);

  const hasPermission = (section: string): boolean => {
    if (!staffUser) return true;
    return staffPermissions.includes(section);
  };

  const filteredClosedShifts = useMemo(() => {
    let filtered = closedShifts.filter(s => selectedBranchIds.includes(s.branch_id));

    if (dateFrom || dateTo) {
      filtered = filtered.filter(shift => {
        const shiftDate = new Date(shift.closed_at);

        if (dateFrom && dateTo) {
          const from = new Date(dateFrom);
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          return shiftDate >= from && shiftDate <= to;
        } else if (dateFrom) {
          const from = new Date(dateFrom);
          return shiftDate >= from;
        } else if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          return shiftDate <= to;
        }

        return true;
      });
    }

    return filtered;
  }, [closedShifts, selectedBranchIds, dateFrom, dateTo]);

  const getUserDisplayName = () => {
    if (!user) return '';
    if (isStaffUser(user)) {
      return user.name;
    }
    if ('name' in user) {
      return `${user.name}${user.lastName ? ' ' + user.lastName : ''}`;
    }
    return '';
  };

  const getUserInitials = () => {
    if (!user) return '';
    if (isStaffUser(user)) {
      const parts = user.name.split(' ');
      return parts.map(p => p.charAt(0)).join('').toUpperCase().substring(0, 2);
    }
    if ('name' in user) {
      const firstName = user.name?.charAt(0) || '';
      const lastName = user.lastName?.charAt(0) || '';
      return (firstName + lastName).toUpperCase();
    }
    return '';
  };

  const settingsTabs = useMemo(() => {
    const tabs = [
      { id: 'general', label: 'Общие', icon: null, section: 'general_settings' },
      { id: 'branches', label: 'Филиалы', icon: Building2, section: 'branches' },
      { id: 'couriers', label: 'Курьеры', icon: Truck, section: 'couriers' },
      { id: 'courier-zones', label: 'Зоны курьеров', icon: MapPin, section: 'courier_zones' },
      { id: 'payment-methods', label: 'Типы оплаты', icon: CreditCard, section: 'payment_methods' },
      { id: 'executors', label: 'Исполнители', icon: Users, section: 'executors' },
      { id: 'print', label: 'Печать', icon: Printer, section: 'print_settings' },
      { id: 'poster', label: 'Poster', icon: Package, section: 'poster_settings' }
    ];

    if (!staffUser) return tabs;
    return tabs.filter(tab => hasPermission(tab.section));
  }, [staffUser, staffPermissions]);

  const menuTabs = useMemo(() => {
    const tabs = [
      { id: 'categories', label: 'Категории', icon: Tag, section: 'menu_categories' },
      { id: 'products', label: 'Товары', icon: Package, section: 'menu_products' }
    ];

    if (!staffUser) return tabs;
    return tabs.filter(tab => hasPermission(tab.section));
  }, [staffUser, staffPermissions]);

  const accessTabs = useMemo(() => {
    const tabs = [
      { id: 'positions', label: 'Должности', icon: Briefcase, section: 'positions' },
      { id: 'staff', label: 'Работники', icon: UserCheck, section: 'staff' }
    ];

    if (!staffUser) return tabs;
    return tabs.filter(tab => hasPermission(tab.section));
  }, [staffUser, staffPermissions]);

  useEffect(() => {
    verifyPartnerAccess();
  }, [partnerPrefix]);

  useEffect(() => {
    if (partner) {
      loadShiftSettings();

      const settingsChannel = supabase
        .channel(`partner-settings:${partner.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'partner_settings',
            filter: `partner_id=eq.${partner.id}`
          },
          () => {
            loadShiftSettings();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'shifts',
            filter: `partner_id=eq.${partner.id}`
          },
          () => {
            loadShiftSettings();
          }
        )
        .subscribe();

      return () => {
        settingsChannel.unsubscribe();
      };
    }
  }, [partner, staffBranchIds]);


  useEffect(() => {
    if (partner && staffUser && staffUser.position?.id) {
      console.log('Setting up realtime subscription for staff user:', staffUser.id, 'position:', staffUser.position.id);
      console.log('Current permissions:', {
        can_delete_orders: staffUser.position.can_delete_orders,
        can_revert_order_status: staffUser.position.can_revert_order_status,
        can_skip_order_status: staffUser.position.can_skip_order_status
      });

      const staffChannel = supabase
        .channel(`staff-updates:${staffUser.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'staff_members',
            filter: `id=eq.${staffUser.id}`
          },
          async () => {
            console.log('Staff member updated, reloading data...');
            const { data } = await supabase
              .from('staff_members')
              .select(`
                *,
                position:positions(
                  id,
                  name,
                  can_delete_orders,
                  can_revert_order_status,
                  can_skip_order_status,
                  position_permissions(section),
                  position_branches(branch_id)
                )
              `)
              .eq('id', staffUser.id)
              .maybeSingle();

            if (data) {
              console.log('Updated staff data received:', data);
              const updatedUser = { ...data, is_staff: true };
              login(updatedUser, partner, role, null);
              window.location.reload();
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'positions',
            filter: `id=eq.${staffUser.position.id}`
          },
          async () => {
            console.log('Position updated, reloading data...');
            const { data } = await supabase
              .from('staff_members')
              .select(`
                *,
                position:positions(
                  id,
                  name,
                  can_delete_orders,
                  can_revert_order_status,
                  can_skip_order_status,
                  position_permissions(section),
                  position_branches(branch_id)
                )
              `)
              .eq('id', staffUser.id)
              .maybeSingle();

            if (data) {
              console.log('Updated staff data after position change:', data);
              const updatedUser = { ...data, is_staff: true };
              login(updatedUser, partner, role, null);
              window.location.reload();
            }
          }
        )
        .subscribe();

      return () => {
        console.log('Unsubscribing from staff updates');
        staffChannel.unsubscribe();
      };
    }
  }, [partner, staffUser]);

  useEffect(() => {
    if (activePage === 'settings' && settingsTabs.length > 0) {
      const currentTabExists = settingsTabs.some(tab => tab.id === settingsTab);
      if (!currentTabExists) {
        setSettingsTab(settingsTabs[0].id);
      }
    }
  }, [activePage, settingsTabs, settingsTab]);

  useEffect(() => {
    if (activePage === 'menu' && menuTabs.length > 0) {
      const currentTabExists = menuTabs.some(tab => tab.id === menuTab);
      if (!currentTabExists) {
        setMenuTab(menuTabs[0].id);
      }
    }
  }, [activePage, menuTabs, menuTab]);

  useEffect(() => {
    if (activePage === 'access' && accessTabs.length > 0) {
      const currentTabExists = accessTabs.some(tab => tab.id === accessTab);
      if (!currentTabExists) {
        setAccessTab(accessTabs[0].id);
      }
    }
  }, [activePage, accessTabs, accessTab]);

  useEffect(() => {
    if (staffUser && menuItems.length > 0) {
      const currentPageHasAccess = menuItems.some(item => item.path === activePage);
      if (!currentPageHasAccess) {
        setActivePage(menuItems[0].path);
      }
    }
  }, [staffUser, menuItems, activePage]);

  useEffect(() => {
    if (partner && activePage === 'dashboard' && selectedShiftIds.length > 0) {
      loadOrderStats();
      loadActiveExternalCouriers();

      const shiftsChannel = supabase
        .channel(`shifts:${partner.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'shifts',
            filter: `partner_id=eq.${partner.id}`
          },
          () => {
            loadOrderStats();
          }
        )
        .subscribe();

      const ordersChannel = supabase
        .channel(`orders-dashboard:${partner.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `partner_id=eq.${partner.id}`
          },
          () => {
            loadOrderStats();
          }
        )
        .subscribe();

      const pollingChannel = supabase
        .channel(`polling-responses:${partner.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'external_courier_polling_responses',
            filter: `partner_id=eq.${partner.id}`
          },
          () => {
            loadActiveExternalCouriers();
          }
        )
        .subscribe();

      return () => {
        shiftsChannel.unsubscribe();
        ordersChannel.unsubscribe();
        pollingChannel.unsubscribe();
      };
    }
  }, [partner, activePage, selectedShiftIds]);

  const loadActiveExternalCouriers = async () => {
    if (!partner) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: responses, error } = await supabase
        .from('external_courier_polling_responses')
        .select('courier_id, is_active, created_at')
        .eq('partner_id', partner.id)
        .eq('response_date', today)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const latestResponsePerCourier = new Map<string, boolean>();
      responses?.forEach(r => {
        if (!latestResponsePerCourier.has(r.courier_id)) {
          latestResponsePerCourier.set(r.courier_id, r.is_active);
        }
      });

      let activeCount = 0;
      latestResponsePerCourier.forEach(isActive => {
        if (isActive) activeCount++;
      });

      setActiveExternalCouriers(activeCount);
    } catch (error) {
      console.error('Error loading active external couriers:', error);
    }
  };

  const loadShiftSettings = async () => {
    if (!partner) return;

    try {
      const [branchesRes, openShiftsRes, closedShiftsRes] = await Promise.all([
        supabase
          .from('branches')
          .select('id, name')
          .eq('partner_id', partner.id)
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('shifts')
          .select('id, branch_id, opened_at, branches!inner(name)')
          .eq('partner_id', partner.id)
          .eq('status', 'open')
          .order('opened_at', { ascending: false }),
        supabase
          .from('shifts')
          .select('id, branch_id, opened_at, closed_at, branches!inner(name)')
          .eq('partner_id', partner.id)
          .eq('status', 'closed')
          .order('closed_at', { ascending: false })
          .limit(50)
      ]);

      if (branchesRes.data) {
        const filteredBranches = staffBranchIds && staffBranchIds.length > 0
          ? branchesRes.data.filter(b => staffBranchIds.includes(b.id))
          : branchesRes.data;
        setBranches(filteredBranches);

        if (selectedBranchIds.length === 0) {
          setSelectedBranchIds(filteredBranches.map(b => b.id));
        }
      }

      if (openShiftsRes.data) {
        const filteredOpenShifts = staffBranchIds && staffBranchIds.length > 0
          ? openShiftsRes.data.filter(s => staffBranchIds.includes(s.branch_id))
          : openShiftsRes.data;
        setOpenShifts(filteredOpenShifts);

        if (showCurrentShift && selectedShiftIds.length === 0) {
          setSelectedShiftIds(filteredOpenShifts.map(s => s.id));
        }
      }

      if (closedShiftsRes.data) {
        const filteredClosedShifts = staffBranchIds && staffBranchIds.length > 0
          ? closedShiftsRes.data.filter(s => staffBranchIds.includes(s.branch_id))
          : closedShiftsRes.data;
        setClosedShifts(filteredClosedShifts);
      }
    } catch (error) {
      console.error('Error loading shift settings:', error);
    }
  };

  const loadOrderStats = async () => {
    if (!partner || selectedShiftIds.length === 0) return;

    try {
      const [shiftsRes, inProgressOrdersRes, completedOrdersRes, archivedOrdersRes, settingsRes] = await Promise.all([
        supabase
          .from('shifts')
          .select('total_orders_count, completed_orders_count')
          .eq('partner_id', partner.id)
          .in('id', selectedShiftIds),
        supabase
          .from('orders')
          .select('id, status, accepted_at, scheduled_at, accumulated_time_minutes, extra_time_minutes, delay_started_at, total_amount')
          .eq('partner_id', partner.id)
          .eq('status', 'in_progress')
          .in('shift_id', selectedShiftIds),
        supabase
          .from('orders')
          .select('id, delay_started_at, accepted_at, completed_at, accumulated_time_minutes, total_amount')
          .eq('partner_id', partner.id)
          .eq('status', 'completed')
          .in('shift_id', selectedShiftIds),
        supabase
          .from('archived_orders')
          .select('id, accepted_at, completed_at, accumulated_time_minutes, accumulated_delay_minutes, total_amount')
          .eq('partner_id', partner.id)
          .in('shift_id', selectedShiftIds),
        supabase
          .from('partner_settings')
          .select('order_completion_norm_minutes')
          .eq('partner_id', partner.id)
          .maybeSingle()
      ]);

      let total = 0;
      let totalCompleted = 0;

      if (shiftsRes.data && shiftsRes.data.length > 0) {
        total = shiftsRes.data.reduce((sum, s) => sum + s.total_orders_count, 0);
        totalCompleted = shiftsRes.data.reduce((sum, s) => sum + s.completed_orders_count, 0);
      }

      const orderCompletionNorm = settingsRes.data?.order_completion_norm_minutes || 60;
      const now = Date.now();
      let overdueCount = 0;
      let totalDelayMinutes = 0;
      let totalInProgressWaitMinutes = 0;
      let totalInProgressDelayMinutes = 0;

      if (inProgressOrdersRes.data && inProgressOrdersRes.data.length > 0) {
        inProgressOrdersRes.data.forEach(order => {
          const acceptedTime = new Date(order.accepted_at).getTime();
          const runningMinutes = Math.floor((now - acceptedTime) / 60000);
          const totalElapsedMinutes = (order.accumulated_time_minutes || 0) + runningMinutes;
          totalInProgressWaitMinutes += totalElapsedMinutes;

          const scheduledTime = order.scheduled_at ? new Date(order.scheduled_at).getTime() : null;

          if (scheduledTime) {
            if (now > scheduledTime) {
              overdueCount++;
              const delayMs = now - scheduledTime;
              totalDelayMinutes += Math.floor(delayMs / 60000);
            }
          } else {
            const totalAllowedMinutes = orderCompletionNorm + (order.extra_time_minutes || 0);

            if (totalElapsedMinutes > totalAllowedMinutes) {
              overdueCount++;
              totalDelayMinutes += (totalElapsedMinutes - totalAllowedMinutes);
            }
          }

          if (order.delay_started_at) {
            const delayStartTime = new Date(order.delay_started_at).getTime();
            const delayMinutes = Math.floor((now - delayStartTime) / 60000);
            totalInProgressDelayMinutes += delayMinutes;
          }
        });
      }

      let completedOnTime = 0;
      let completedDelayed = 0;
      let totalCompletionMinutes = 0;
      let totalCompletedDelayMinutes = 0;
      let totalRevenue = 0;

      const allCompletedOrders = [
        ...(completedOrdersRes.data || []),
        ...(archivedOrdersRes.data || [])
      ];

      if (allCompletedOrders.length > 0) {
        allCompletedOrders.forEach(order => {
          totalRevenue += order.total_amount || 0;

          const hasDelay = order.delay_started_at || (order.accumulated_delay_minutes && order.accumulated_delay_minutes > 0);

          if (hasDelay) {
            completedDelayed++;
            if (order.accumulated_delay_minutes && order.accumulated_delay_minutes > 0) {
              totalCompletedDelayMinutes += order.accumulated_delay_minutes;
            } else if (order.completed_at && order.delay_started_at) {
              const delayStartTime = new Date(order.delay_started_at).getTime();
              const completedTime = new Date(order.completed_at).getTime();
              const delayMinutes = Math.floor((completedTime - delayStartTime) / 60000);
              totalCompletedDelayMinutes += delayMinutes;
            }
          } else {
            completedOnTime++;
          }

          if (order.completed_at && order.accepted_at) {
            const acceptedTime = new Date(order.accepted_at).getTime();
            const completedTime = new Date(order.completed_at).getTime();
            const elapsedMinutes = Math.floor((completedTime - acceptedTime) / 60000);
            totalCompletionMinutes += (order.accumulated_time_minutes || 0) + elapsedMinutes;
          }
        });
      }

      if (inProgressOrdersRes.data && inProgressOrdersRes.data.length > 0) {
        inProgressOrdersRes.data.forEach(order => {
          totalRevenue += order.total_amount || 0;
        });
      }

      const totalAllOrders = (inProgressOrdersRes.data?.length || 0) + allCompletedOrders.length;
      const totalAllDelayMinutes = totalDelayMinutes + totalCompletedDelayMinutes;
      const avgDelay = totalAllOrders > 0 ? Math.round(totalAllDelayMinutes / totalAllOrders) : 0;
      const avgCompletionTime = allCompletedOrders.length > 0
        ? Math.round(totalCompletionMinutes / allCompletedOrders.length)
        : 0;
      const inProgressAvgWaitTime = inProgressOrdersRes.data && inProgressOrdersRes.data.length > 0
        ? Math.round(totalInProgressWaitMinutes / inProgressOrdersRes.data.length)
        : 0;
      const inProgressAvgDelay = inProgressOrdersRes.data && inProgressOrdersRes.data.length > 0
        ? Math.round(totalInProgressDelayMinutes / inProgressOrdersRes.data.length)
        : 0;

      setOrderStats({
        total,
        completedOnTime,
        completedDelayed,
        inProgress: total - totalCompleted,
        overdue: overdueCount,
        avgDelay,
        avgCompletionTime,
        totalRevenue,
        inProgressAvgWaitTime,
        inProgressAvgDelay
      });
    } catch (error) {
      console.error('Error loading order stats:', error);
    }
  };

  const verifyPartnerAccess = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('partners')
        .select('*')
        .eq('url_suffix', partnerPrefix)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError('Партнёр не найден');
        setLoading(false);
        return;
      }

      if (data.status === 'deleted') {
        setError('Партнёр был удалён');
        setLoading(false);
        return;
      }

      if (data.status === 'paused') {
        setError(data.pause_message || 'Сервис временно приостановлен');
        setLoading(false);
        return;
      }

      if (!isDevMode) {
        if (!authPartner) {
          navigate(`/${partnerPrefix}/login`, { replace: true });
          return;
        }

        if (role?.name !== 'founder' && authPartner.id !== data.id) {
          navigate(`/${partnerPrefix}/login`, { replace: true });
          return;
        }
      }

      setPartner(data);
      setLoading(false);
    } catch (err) {
      console.error('Error verifying partner access:', err);
      setError('Ошибка загрузки данных');
      setLoading(false);
    }
  };

  const handleMenuClick = (item: MenuItem) => {
    setActivePage(item.id);
  };

  const handleLogout = () => {
    logout();
    navigate(`/${partnerPrefix}/login`);
  };


  const renderPageContent = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[300px]">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Филиалы</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {branches.map(branch => (
                      <label key={branch.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedBranchIds.includes(branch.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const newBranchIds = [...selectedBranchIds, branch.id];
                              setSelectedBranchIds(newBranchIds);

                              const relevantShifts = showCurrentShift
                                ? openShifts.filter(s => newBranchIds.includes(s.branch_id))
                                : closedShifts.filter(s => newBranchIds.includes(s.branch_id));
                              setSelectedShiftIds(relevantShifts.map(s => s.id));
                            } else {
                              const newBranchIds = selectedBranchIds.filter(id => id !== branch.id);
                              setSelectedBranchIds(newBranchIds);

                              const relevantShifts = showCurrentShift
                                ? openShifts.filter(s => newBranchIds.includes(s.branch_id))
                                : closedShifts.filter(s => newBranchIds.includes(s.branch_id));
                              setSelectedShiftIds(relevantShifts.map(s => s.id));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">{branch.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex-1 min-w-[300px]">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Смены</label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={showCurrentShift}
                        onChange={() => {
                          setShowCurrentShift(true);
                          setDateFrom('');
                          setDateTo('');
                          const relevantShifts = openShifts.filter(s => selectedBranchIds.includes(s.branch_id));
                          setSelectedShiftIds(relevantShifts.map(s => s.id));
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">Текущие смены</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={!showCurrentShift}
                        onChange={() => {
                          setShowCurrentShift(false);
                          setSelectedShiftIds([]);
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">Прошлые смены</span>
                    </label>

                    {!showCurrentShift && (
                      <div className="space-y-3 pt-2">
                        <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                          <div className="text-xs font-semibold text-gray-600 mb-2">Период</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">С</label>
                              <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">По</label>
                              <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
                          <div className="text-xs font-semibold text-gray-600 mb-2 sticky top-0 bg-gray-50 pb-1">
                            Выберите смены ({filteredClosedShifts.length})
                          </div>
                          {filteredClosedShifts.length === 0 ? (
                            <div className="text-xs text-gray-500 text-center py-4">
                              {dateFrom || dateTo ? 'Нет смен за выбранный период' : 'Выберите период для отображения смен'}
                            </div>
                          ) : (
                            filteredClosedShifts.map(shift => (
                              <label key={shift.id} className="flex items-start gap-2 cursor-pointer hover:bg-white p-2 rounded transition-colors">
                                <input
                                  type="checkbox"
                                  checked={selectedShiftIds.includes(shift.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedShiftIds([...selectedShiftIds, shift.id]);
                                    } else {
                                      setSelectedShiftIds(selectedShiftIds.filter(id => id !== shift.id));
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded mt-0.5 flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-gray-700 truncate">
                                    {shift.branches?.name}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    <div>Открыта: {new Date(shift.opened_at).toLocaleString('ru-RU', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}</div>
                                    <div>Закрыта: {new Date(shift.closed_at).toLocaleString('ru-RU', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}</div>
                                  </div>
                                </div>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50 hover:shadow-xl transition-shadow">
              <div className="text-sm font-semibold text-gray-600 mb-3">Всего заказов</div>
              <div className="flex items-center justify-around gap-6">
                <div className="flex-1 text-center">
                  <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{orderStats.total}</div>
                  <div className="text-xs text-gray-500 mt-2">За выбранный период</div>
                </div>
                <div className="w-px h-16 bg-gray-300"></div>
                <div className="flex-1 text-center">
                  <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{orderStats.totalRevenue.toLocaleString('ru-RU')}</div>
                  <div className="text-xs text-gray-500 mt-2">Выручка (₽)</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-green-200/50 hover:shadow-xl transition-shadow">
                <div className="text-sm font-semibold text-gray-600 mb-3">Выполнено</div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      {orderStats.completedOnTime}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Вовремя</div>
                  </div>
                  <div className="w-px h-12 bg-gray-300"></div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-orange-500 bg-clip-text text-transparent">
                      {orderStats.completedDelayed}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">С опозданием</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-blue-200/50 hover:shadow-xl transition-shadow">
                <div className="text-sm font-semibold text-gray-600 mb-3">В работе</div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                      {orderStats.inProgress - orderStats.overdue}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Вовремя</div>
                  </div>
                  <div className="w-px h-12 bg-gray-300"></div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                      {orderStats.overdue}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Просроченные</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-orange-200/50 hover:shadow-xl transition-shadow">
                <div className="text-sm font-semibold text-gray-600 mb-3">Среднее время выполненных заказов</div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                      {orderStats.avgCompletionTime > 0 ? `${orderStats.avgCompletionTime}м` : '—'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Выполнение</div>
                  </div>
                  <div className="w-px h-12 bg-gray-300"></div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                      {orderStats.avgDelay > 0 ? `${orderStats.avgDelay}м` : '—'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Опоздание</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-purple-200/50 hover:shadow-xl transition-shadow">
                <div className="text-sm font-semibold text-gray-600 mb-3">Статистика заказов в работе</div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      {orderStats.inProgressAvgWaitTime > 0 ? `${orderStats.inProgressAvgWaitTime}м` : '—'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Среднее время ожидания</div>
                  </div>
                  <div className="w-px h-12 bg-gray-300"></div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                      {orderStats.inProgressAvgDelay > 0 ? `${orderStats.inProgressAvgDelay}м` : '—'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Среднее время задержки</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-teal-200/50 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-gray-600">Сторонние курьеры</div>
                  <button
                    onClick={() => setShowExternalCouriersModal(true)}
                    className="p-1.5 hover:bg-teal-100 rounded-lg transition-colors group"
                    title="Подробности"
                  >
                    <MoreVertical className="w-5 h-5 text-gray-400 group-hover:text-teal-600" />
                  </button>
                </div>
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                      {activeExternalCouriers}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">Активных сегодня</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'orders':
        return partner ? <Orders partnerId={partner.id} staffBranchIds={staffBranchIds.length > 0 ? staffBranchIds : undefined} canDeleteOrders={staffUser ? staffUser.position?.can_delete_orders ?? false : true} canRevertOrderStatus={staffUser ? staffUser.position?.can_revert_order_status ?? false : true} canSkipOrderStatus={staffUser ? staffUser.position?.can_skip_order_status ?? false : true} isSuperAdmin={!staffUser} /> : null;

      case 'clients':
        return <Clients />;

      case 'menu':
        return (
          <div>
            <div className="flex gap-4 mb-6 overflow-x-auto">
              {menuTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setMenuTab(tab.id)}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                      menuTab === tab.id
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                        : 'bg-white/80 border border-gray-300 text-gray-700 hover:border-blue-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {menuTab === 'categories' && hasPermission('menu_categories') && partner && (
              <MenuCategories partnerId={partner.id} onBack={() => setActivePage('dashboard')} />
            )}

            {menuTab === 'products' && hasPermission('menu_products') && partner && (
              <MenuProducts partnerId={partner.id} onBack={() => setActivePage('dashboard')} />
            )}
          </div>
        );

      case 'history':
        return partner ? <OrderHistory partnerId={partner.id} staffBranchIds={staffBranchIds.length > 0 ? staffBranchIds : undefined} /> : null;

      case 'work-schedule':
        return (
          <div>
            <div className="flex gap-4 mb-6 overflow-x-auto">
              <button
                onClick={() => setWorkScheduleTab('schedule')}
                className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                  workScheduleTab === 'schedule'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                    : 'bg-white/80 border border-gray-300 text-gray-700 hover:border-blue-400'
                }`}
              >
                <CalendarDays className="w-5 h-5" />
                График
              </button>
              <button
                onClick={() => setWorkScheduleTab('settings')}
                className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                  workScheduleTab === 'settings'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                    : 'bg-white/80 border border-gray-300 text-gray-700 hover:border-blue-400'
                }`}
              >
                <Settings className="w-5 h-5" />
                Настройки графика
              </button>
            </div>
            {workScheduleTab === 'schedule' && partner && <WorkSchedule partnerId={partner.id} />}
            {workScheduleTab === 'settings' && partner && <ScheduleSettings partnerId={partner.id} />}
          </div>
        );

      case 'employees':
        return partner ? <Employees partnerId={partner.id} /> : null;

      case 'kpi':
        return partner ? <KPISettings partnerId={partner.id} /> : null;

      case 'settings':
        return (
          <div>
            <div className="flex gap-4 mb-6 overflow-x-auto">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSettingsTab(tab.id)}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                      settingsTab === tab.id
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                        : 'bg-white/80 border border-gray-300 text-gray-700 hover:border-blue-400'
                    }`}
                  >
                    {Icon && <Icon className="w-5 h-5" />}
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {settingsTab === 'general' && hasPermission('general_settings') && partner && (
              <GeneralSettings partnerId={partner.id} />
            )}

            {settingsTab === 'branches' && hasPermission('branches') && partner && (
              <Branches partnerId={partner.id} />
            )}

            {settingsTab === 'couriers' && hasPermission('couriers') && partner && (
              <Couriers partnerId={partner.id} />
            )}

            {settingsTab === 'courier-zones' && hasPermission('courier_zones') && partner && (
              <CourierZones />
            )}

            {settingsTab === 'payment-methods' && hasPermission('payment_methods') && partner && (
              <PaymentMethods partnerId={partner.id} />
            )}

            {settingsTab === 'executors' && hasPermission('executors') && partner && (
              <Executors partnerId={partner.id} />
            )}

            {settingsTab === 'print' && hasPermission('print_settings') && partner && (
              <PrintSettings partnerId={partner.id} />
            )}

            {settingsTab === 'poster' && hasPermission('poster_settings') && partner && (
              <PosterSettings partnerId={partner.id} onBack={() => setSettingsTab('general')} />
            )}
          </div>
        );

      case 'logs':
        return partner ? <LogViewer partnerId={partner.id} /> : null;

      case 'access':
        return (
          <div>
            <div className="flex gap-4 mb-6 overflow-x-auto">
              {accessTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setAccessTab(tab.id)}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                      accessTab === tab.id
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                        : 'bg-white/80 border border-gray-300 text-gray-700 hover:border-blue-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {accessTab === 'positions' && hasPermission('positions') && partner && (
              <Positions partnerId={partner.id} />
            )}

            {accessTab === 'staff' && hasPermission('staff') && partner && (
              <Staff partnerId={partner.id} />
            )}
          </div>
        );

      case 'reports':
        return partner ? <BinotelWaitStats partnerId={partner.id} /> : null;

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-slate-600">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          {partner?.logo_url ? (
            <img src={partner.logo_url} alt={partner.name} className="w-16 h-16 object-contain mx-auto mb-4" />
          ) : (
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          )}
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{error}</h1>
        </div>
      </div>
    );
  }

  const handleCreateOrderFromCall = (
    phone: string,
    branchId: string | null,
    sourceCallId: string | null,
    orderItems?: Array<{
      product_poster_id: number;
      product_name: string;
      base_price: number;
      quantity: number;
      modifiers: Array<{
        modifier_poster_id: number;
        modifier_name: string;
        price: number;
      }>;
    }>
  ) => {
    setIncomingCallPhone(phone);
    setIncomingCallBranchId(branchId);
    setInitialSourceCallId(sourceCallId);
    setInitialOrderItems(orderItems);
    setShowIncomingCallModal(true);
  };

  return (
    <BinotelProvider
      partnerId={partner?.id || null}
      userBranchIds={staffBranchIds}
    >
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex">
      <IncomingCallsWidget />

      {showIncomingCallModal && partner && (
        <CreateOrderModal
          partnerId={partner.id}
          onClose={() => {
            setShowIncomingCallModal(false);
            setIncomingCallPhone('');
            setIncomingCallBranchId(null);
            setInitialSourceCallId(null);
            setInitialOrderItems(undefined);
          }}
          onOrderCreated={() => {
            setShowIncomingCallModal(false);
            setIncomingCallPhone('');
            setIncomingCallBranchId(null);
            setInitialSourceCallId(null);
            setInitialOrderItems(undefined);
          }}
          initialPhone={incomingCallPhone}
          initialBranchId={incomingCallBranchId}
          initialSourceCallId={initialSourceCallId}
          initialOrderItems={initialOrderItems}
        />
      )}

      {partner && (
        <ExternalCouriersStatusModal
          isOpen={showExternalCouriersModal}
          onClose={() => setShowExternalCouriersModal(false)}
          partnerId={partner.id}
        />
      )}

      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } bg-white/80 backdrop-blur-xl border-r border-gray-200/50 transition-all duration-300 overflow-hidden flex flex-col shadow-lg h-screen`}
      >
        <div className="p-6 border-b border-gray-200/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            {partner?.logo_url ? (
              <img src={partner.logo_url} alt={partner.name} className="w-12 h-12 object-contain" />
            ) : (
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center text-white font-bold">
                {partner?.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900 truncate">{partner?.name}</div>
              <div className="text-xs text-gray-500 truncate font-mono">/{partnerPrefix}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                  activePage === item.id
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-blue-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {hasPermission('open_shifts') && (
          <div className="border-t border-gray-200/50 p-4 flex-shrink-0">
            <div className="space-y-3">
              {branches.length > 0 && (() => {
                const openShiftBranchIds = openShifts.map(s => s.branch_id);
                const openBranchesWithShifts = branches
                  .filter(b => openShiftBranchIds.includes(b.id))
                  .map(b => ({
                    branch: b,
                    shift: openShifts.find(s => s.branch_id === b.id)
                  }));
                const closedBranches = branches.filter(b => !openShiftBranchIds.includes(b.id));

                return (
                  <>
                    {openBranchesWithShifts.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Открытые смены</h3>
                        {openBranchesWithShifts.map(({ branch, shift }) => {
                          const openedDate = new Date(shift.opened_at);
                          const formattedDate = openedDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
                          const formattedTime = openedDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

                          return (
                            <button
                              key={branch.id}
                              onClick={() => setShowShiftModal(true)}
                              className="w-full px-3 py-2 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border border-green-200 rounded-xl transition-all text-left"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Building2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                <span className="font-semibold text-gray-900 text-sm truncate">{branch.name}</span>
                              </div>
                              <div className="text-xs text-gray-600 ml-6">
                                {formattedDate} в {formattedTime}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {closedBranches.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase">Закрытые смены</h3>
                        {closedBranches.map(branch => (
                          <button
                            key={branch.id}
                            onClick={() => setShowShiftModal(true)}
                            className="w-full flex items-center gap-2 px-3 py-2 bg-white text-gray-700 hover:bg-blue-50 border border-gray-200 rounded-xl transition-all font-semibold text-sm"
                          >
                            <Building2 className="w-4 h-4" />
                            <span>{branch.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

              <button
                onClick={() => setShowShiftModal(true)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 rounded-xl transition-all font-semibold text-sm"
              >
                <Clock className="w-4 h-4" />
                <span>Управление сменами</span>
              </button>
            </div>
          </div>
        )}
      </aside>

      {showShiftModal && partner && (
        <ShiftManagementModal
          partnerId={partner.id}
          onClose={() => setShowShiftModal(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2.5 hover:bg-blue-50 rounded-xl transition-colors"
              >
                {sidebarOpen ? <X className="w-6 h-6 text-gray-700" /> : <Menu className="w-6 h-6 text-gray-700" />}
              </button>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                {menuItems.find(item => item.id === activePage)?.label}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {getUserInitials()}
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold text-gray-900">
                      {getUserDisplayName()}
                    </div>
                    <div className="text-xs text-gray-500">{user.login}</div>
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-all font-semibold"
              >
                <LogOut className="w-5 h-5" />
                <span>Выйти</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {renderPageContent()}
        </main>
      </div>
    </div>

    <ClientDrawerWrapper
      partnerId={partner?.id || ''}
      onCreateOrder={handleCreateOrderFromCall}
      onEditOrder={(orderId) => {
        setActivePage('orders');
        setTimeout(() => {
          setEditingOrderId(orderId);
        }, 50);
      }}
    />

    {editingOrderId && partner && (
      <EditOrderModal
        partnerId={partner.id}
        orderId={editingOrderId}
        onClose={() => setEditingOrderId(null)}
        onSuccess={() => setEditingOrderId(null)}
      />
    )}
    </BinotelProvider>
  );
}

function ClientDrawerWrapper({
  partnerId,
  onCreateOrder,
  onEditOrder
}: {
  partnerId: string;
  onCreateOrder: (
    phone: string,
    branchId: string | null,
    sourceCallId: string | null,
    orderItems?: Array<{
      product_poster_id: number;
      product_name: string;
      base_price: number;
      quantity: number;
      modifiers: Array<{
        modifier_poster_id: number;
        modifier_name: string;
        price: number;
      }>;
    }>
  ) => void;
  onEditOrder?: (orderId: string) => void;
}) {
  const { clientDrawer, closeClientDrawer } = useBinotel();

  const handleRepeatOrder = (
    phone: string,
    branchId: string | null,
    items: Array<{
      product_poster_id: number;
      product_name: string;
      base_price: number;
      quantity: number;
      modifiers: Array<{
        modifier_poster_id: number;
        modifier_name: string;
        price: number;
      }>;
    }>
  ) => {
    onCreateOrder(phone, branchId, null, items);
  };

  const handleEditOrder = (orderId: string) => {
    if (onEditOrder) {
      onEditOrder(orderId);
    }
    setTimeout(() => {
      closeClientDrawer();
    }, 100);
  };

  return (
    <ClientDrawer
      isOpen={clientDrawer.isOpen}
      phone={clientDrawer.phone}
      clientId={clientDrawer.clientId}
      clientName={clientDrawer.clientName}
      branchId={clientDrawer.branchId}
      generalCallId={clientDrawer.generalCallId}
      partnerId={partnerId}
      onClose={closeClientDrawer}
      onCreateOrder={onCreateOrder}
      onRepeatOrder={handleRepeatOrder}
      onEditOrder={handleEditOrder}
    />
  );
}
