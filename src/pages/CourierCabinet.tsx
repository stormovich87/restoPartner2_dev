import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Package, History, User, Calendar, Truck, MapPin, Clock, DollarSign, CheckCircle, AlertCircle, Phone, Bike, Car, Lock, LogIn, Navigation, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
      };
    };
  }
}

interface Courier {
  id: string;
  name: string;
  lastname: string | null;
  phone: string | null;
  vehicle_type: string | null;
  telegram_username: string | null;
  is_active: boolean;
  partner_id: string;
  telegram_user_id?: string | null;
}

interface OrderItem {
  product_name: string;
  quantity: number;
  base_price: number;
  total_price: number;
  modifiers?: any;
}

interface ActiveOrder {
  id: string;
  order_number: string;
  client_name: string | null;
  phone: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  total_amount: number | null;
  delivery_price: number | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
  accumulated_time_minutes: number | null;
  distance_km: number | null;
  payment_method_id: string | null;
  branch?: {
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  shift_order_number?: string | null;
  client?: { first_name: string | null; last_name: string | null } | null;
  payment_method?: { name: string } | null;
  zone?: { courier_payment: number | null; name: string } | null;
  distance_price_uah?: number | null;
  items?: OrderItem[];
}

interface CompletedOrder {
  id: string;
  order_number: string;
  phone: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  total_amount: number | null;
  completed_at: string | null;
  accumulated_time_minutes: number | null;
  distance_km: number | null;
  payment_method_id: string | null;
  courier_zone_id: string | null;
  executor_zone_id: string | null;
  courier_zone?: { courier_payment: number | null; name: string } | null;
  executor_zone?: { courier_payment: number | null; name: string } | null;
  client?: { first_name: string | null; last_name: string | null } | null;
  branch?: {
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  payment_method?: { name: string } | null;
  items?: OrderItem[];
}

interface OrderExecutor {
  id: string;
  order_id: string;
  zone_id: string | null;
  distance_price_uah: number | null;
  total_delivery_price_uah: number | null;
  rounded_distance_km: number | null;
  zone?: { courier_payment: number | null; name: string } | null;
}

type QuickPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type TabType = 'active' | 'history' | 'profile';
type StatusFilter = 'assigned' | 'en_route';

export default function CourierCabinet() {
  const { token, cabinetSlug, partnerPrefix, cabinet_slug } = useParams<{ token?: string; cabinetSlug?: string; partnerPrefix?: string; cabinet_slug?: string }>();
  const slug = cabinet_slug;
  const [courier, setCourier] = useState<Courier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('assigned');

  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [completedOrders, setCompletedOrders] = useState<CompletedOrder[]>([]);
  const [orderExecutors, setOrderExecutors] = useState<Record<string, OrderExecutor>>({});
  const [historyLoading, setHistoryLoading] = useState(false);

  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>('today');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currency, setCurrency] = useState('UAH');

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);
  const [courierSlug, setCourierSlug] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const setQuickPeriodDates = (period: QuickPeriod) => {
    setQuickPeriod(period);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (period) {
      case 'today':
        setDateFrom(formatDateForInput(today));
        setDateTo(formatDateForInput(today));
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setDateFrom(formatDateForInput(yesterday));
        setDateTo(formatDateForInput(yesterday));
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        setDateFrom(formatDateForInput(weekAgo));
        setDateTo(formatDateForInput(today));
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        setDateFrom(formatDateForInput(monthAgo));
        setDateTo(formatDateForInput(today));
        break;
      case 'custom':
        break;
    }
  };

  useEffect(() => {
    if (slug) {
      setCourierSlug(slug);
      checkAuthentication(slug);
    } else if (token || (cabinetSlug && partnerPrefix)) {
      loadCourierLegacy();
    }
  }, [token, cabinetSlug, partnerPrefix, slug]);

  useEffect(() => {
    if (courier && isAuthenticated) {
      loadActiveOrders();
      loadPartnerSettings();
    }
  }, [courier, isAuthenticated]);

  useEffect(() => {
    if (!courier || !isAuthenticated) return;

    const channel = supabase
      .channel('courier_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_executors',
          filter: `courier_id=eq.${courier.id}`
        },
        (payload) => {
          console.log('Order executors changed:', payload);
          loadActiveOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Orders changed (all):', payload);
          if (payload.new) {
            const updatedOrder = payload.new as any;

            setActiveOrders(prevOrders => {
              const existingOrder = prevOrders.find(o => o.id === updatedOrder.id);

              if (!existingOrder) {
                return prevOrders;
              }

              if (updatedOrder.status === 'completed' || updatedOrder.status === 'cancelled') {
                return prevOrders.filter(o => o.id !== updatedOrder.id);
              }

              if (!['in_progress', 'en_route'].includes(updatedOrder.status)) {
                return prevOrders.filter(o => o.id !== updatedOrder.id);
              }

              const updated = [...prevOrders];
              const existingIndex = updated.findIndex(o => o.id === updatedOrder.id);

              if (existingIndex >= 0) {
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  status: updatedOrder.status,
                  accumulated_time_minutes: updatedOrder.accumulated_time_minutes
                };
              }

              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courier, isAuthenticated]);

  useEffect(() => {
    if (courier && isAuthenticated && dateFrom && dateTo && activeTab === 'history') {
      loadCompletedOrders();
    }
  }, [courier, isAuthenticated, dateFrom, dateTo, activeTab]);

  useEffect(() => {
    setQuickPeriodDates('today');
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const checkAuthentication = async (courierSlugParam: string) => {
    setAuthLoading(true);

    const tgWebApp = window.Telegram?.WebApp;
    if (tgWebApp && tgWebApp.initDataUnsafe?.user?.id) {
      setIsTelegramWebApp(true);
      tgWebApp.ready();
      tgWebApp.expand();

      const telegramUserId = tgWebApp.initDataUnsafe.user.id.toString();

      const { data: courierData, error: courierError } = await supabase
        .from('couriers')
        .select('id, name, lastname, phone, vehicle_type, telegram_username, is_active, partner_id, telegram_user_id')
        .eq('cabinet_slug', courierSlugParam)
        .eq('telegram_user_id', telegramUserId)
        .maybeSingle();

      if (courierError) {
        setError('Ошибка проверки авторизации');
        setAuthLoading(false);
        setLoading(false);
        return;
      }

      if (courierData) {
        if (!courierData.is_active) {
          setError('not_active');
          setAuthLoading(false);
          setLoading(false);
          return;
        }
        setCourier(courierData);
        setIsAuthenticated(true);
        setAuthLoading(false);
        setLoading(false);
        return;
      }

      setError('telegram_mismatch');
      setAuthLoading(false);
      setLoading(false);
      return;
    }

    const savedAuth = localStorage.getItem(`courier_auth_${courierSlugParam}`);
    if (savedAuth) {
      try {
        const { courierId, expiry } = JSON.parse(savedAuth);
        if (expiry > Date.now()) {
          const { data: courierData } = await supabase
            .from('couriers')
            .select('id, name, lastname, phone, vehicle_type, telegram_username, is_active, partner_id, telegram_user_id')
            .eq('id', courierId)
            .eq('cabinet_slug', courierSlugParam)
            .maybeSingle();

          if (courierData && courierData.is_active) {
            setCourier(courierData);
            setIsAuthenticated(true);
            setAuthLoading(false);
            setLoading(false);
            return;
          }
        }
        localStorage.removeItem(`courier_auth_${courierSlugParam}`);
      } catch {
        localStorage.removeItem(`courier_auth_${courierSlugParam}`);
      }
    }

    const { data: courierExists } = await supabase
      .from('couriers')
      .select('id, is_active, cabinet_login')
      .eq('cabinet_slug', courierSlugParam)
      .maybeSingle();

    if (!courierExists) {
      setError('not_found');
      setAuthLoading(false);
      setLoading(false);
      return;
    }

    if (!courierExists.is_active) {
      setError('not_active');
      setAuthLoading(false);
      setLoading(false);
      return;
    }

    if (!courierExists.cabinet_login) {
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
    if (!courierSlug) return;

    setLoginError('');
    setLoginLoading(true);

    const { data: courierData, error: loginErr } = await supabase
      .from('couriers')
      .select('id, name, lastname, phone, vehicle_type, telegram_username, is_active, partner_id, telegram_user_id')
      .eq('cabinet_slug', courierSlug)
      .eq('cabinet_login', loginForm.login)
      .eq('cabinet_password', loginForm.password)
      .maybeSingle();

    if (loginErr || !courierData) {
      setLoginError('Неверный логин или пароль');
      setLoginLoading(false);
      return;
    }

    if (!courierData.is_active) {
      setLoginError('Ваш аккаунт деактивирован');
      setLoginLoading(false);
      return;
    }

    const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(`courier_auth_${courierSlug}`, JSON.stringify({
      courierId: courierData.id,
      expiry
    }));

    setCourier(courierData);
    setIsAuthenticated(true);
    setLoginLoading(false);
  };

  const loadCourierLegacy = async () => {
    try {
      let data, fetchError;

      if (cabinetSlug && partnerPrefix) {
        const { data: partnerData, error: partnerError } = await supabase
          .from('partners')
          .select('id')
          .eq('url_suffix', partnerPrefix)
          .maybeSingle();

        if (partnerError) throw partnerError;

        if (!partnerData) {
          setError('Партнер не найден');
          return;
        }

        const courierResult = await supabase
          .from('couriers')
          .select('id, name, lastname, phone, vehicle_type, telegram_username, is_active, partner_id, telegram_user_id')
          .eq('cabinet_slug', cabinetSlug)
          .eq('partner_id', partnerData.id)
          .eq('is_external', true)
          .maybeSingle();

        data = courierResult.data;
        fetchError = courierResult.error;

        if (fetchError) throw fetchError;

        if (!data) {
          setError('not_found');
          return;
        }

        if (!data.is_active) {
          setError('not_active');
          return;
        }
      } else if (token) {
        const courierResult = await supabase
          .from('couriers')
          .select('id, name, lastname, phone, vehicle_type, telegram_username, is_active, partner_id, telegram_user_id')
          .eq('cabinet_token', token)
          .eq('is_external', true)
          .maybeSingle();

        data = courierResult.data;
        fetchError = courierResult.error;

        if (fetchError) throw fetchError;

        if (!data) {
          setError('not_found');
          return;
        }

        if (!data.is_active) {
          setError('not_active');
          return;
        }
      }

      setCourier(data || null);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Error loading courier:', err);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
      setAuthLoading(false);
    }
  };

  const loadPartnerSettings = async () => {
    if (!courier) return;

    const { data, error } = await supabase
      .from('partner_settings')
      .select('currency_symbol')
      .eq('partner_id', courier.partner_id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load currency settings:', error);
    }

    if (data?.currency_symbol) {
      setCurrency(data.currency_symbol);
    }
  };

  const loadActiveOrders = async () => {
    if (!courier) return;

    try {
      console.log('loadActiveOrders: courier.id =', courier.id);

      const { data: orderExecutors, error: executorError } = await supabase
        .from('order_executors')
        .select(`
          id,
          order_id,
          courier_id,
          created_at,
          zone_id,
          distance_price_uah,
          rounded_distance_km,
          zone:performer_delivery_zones!order_executors_zone_id_fkey(courier_payment, name),
          orders!order_executors_order_id_fkey(
            id,
            order_number,
            shift_order_number,
            phone,
            address,
            address_line,
            delivery_lat,
            delivery_lng,
            total_amount,
            delivery_price_uah,
            status,
            created_at,
            accumulated_time_minutes,
            distance_km,
            payment_method_id,
            branch:branches!orders_branch_id_fkey(name, address, latitude, longitude),
            client:clients!orders_client_id_fkey(first_name, last_name),
            payment_method:payment_methods!orders_payment_method_id_fkey(name)
          )
        `)
        .eq('courier_id', courier.id)
        .in('orders.status', ['in_progress', 'en_route'])
        .order('created_at', { ascending: false });

      console.log('loadActiveOrders: orderExecutors =', orderExecutors, 'error =', executorError);

      const formattedOrders: ActiveOrder[] = [];
      if (orderExecutors) {
        for (const executor of orderExecutors) {
          if (executor.orders) {
            const order = executor.orders as any;

            const { data: items } = await supabase
              .from('order_items')
              .select('product_name, quantity, base_price, total_price, modifiers')
              .eq('order_id', order.id);

            formattedOrders.push({
              id: order.id,
              order_number: order.shift_order_number || order.order_number,
              shift_order_number: order.shift_order_number,
              client_name: order.client ? [order.client.first_name, order.client.last_name].filter(Boolean).join(' ') || null : null,
              phone: order.phone,
              delivery_address: order.address_line,
              delivery_lat: order.delivery_lat,
              delivery_lng: order.delivery_lng,
              total_amount: order.total_amount,
              delivery_price: order.delivery_price_uah,
              status: order.status,
              created_at: order.created_at,
              accepted_at: executor.created_at,
              accumulated_time_minutes: order.accumulated_time_minutes,
              distance_km: order.distance_km,
              payment_method_id: order.payment_method_id,
              branch: order.branch,
              client: order.client,
              payment_method: order.payment_method,
              zone: executor.zone,
              distance_price_uah: executor.distance_price_uah,
              items: items || []
            });
          }
        }
      }

      setActiveOrders(formattedOrders);
    } catch (error) {
      console.error('Error loading active orders:', error);
    }
  };

  const loadCompletedOrders = async () => {
    if (!courier || !dateFrom || !dateTo) return;

    setHistoryLoading(true);
    try {
      const { data: orderExecutors, error: executorError } = await supabase
        .from('order_executors')
        .select(`
          id,
          order_id,
          courier_id,
          created_at,
          zone_id,
          distance_price_uah,
          total_delivery_price_uah,
          rounded_distance_km,
          zone:performer_delivery_zones!order_executors_zone_id_fkey(courier_payment, name),
          orders!order_executors_order_id_fkey(
            id,
            order_number,
            shift_order_number,
            phone,
            address,
            address_line,
            delivery_lat,
            delivery_lng,
            total_amount,
            delivery_price_uah,
            status,
            created_at,
            completed_at,
            accumulated_time_minutes,
            distance_km,
            payment_method_id,
            courier_zone_id,
            executor_zone_id,
            branch:branches!orders_branch_id_fkey(name, address, latitude, longitude),
            client:clients!orders_client_id_fkey(first_name, last_name),
            payment_method:payment_methods!orders_payment_method_id_fkey(name),
            courier_zone:courier_delivery_zones!orders_courier_zone_id_fkey(courier_payment, name),
            executor_zone:performer_delivery_zones!orders_executor_zone_id_fkey(courier_payment, name)
          )
        `)
        .eq('courier_id', courier.id)
        .eq('orders.status', 'completed')
        .order('created_at', { ascending: false });

      if (executorError) {
        console.error('Error loading completed orders:', executorError);
        setHistoryLoading(false);
        return;
      }

      const formattedOrders: CompletedOrder[] = [];
      if (orderExecutors) {
        for (const executor of orderExecutors) {
          if (executor.orders) {
            const order = executor.orders as any;

            if (order.status !== 'completed') continue;

            const completedDate = order.completed_at ? new Date(order.completed_at) : null;
            if (!completedDate) continue;

            const fromDate = new Date(`${dateFrom}T00:00:00`);
            const toDate = new Date(`${dateTo}T23:59:59`);

            if (completedDate >= fromDate && completedDate <= toDate) {
              const { data: items } = await supabase
                .from('order_items')
                .select('product_name, quantity, base_price, total_price, modifiers')
                .eq('order_id', order.id);

              formattedOrders.push({
                id: order.id,
                order_number: order.shift_order_number || order.order_number,
                delivery_address: order.address_line,
                delivery_lat: order.delivery_lat,
                delivery_lng: order.delivery_lng,
                total_amount: order.total_amount,
                completed_at: order.completed_at,
                accumulated_time_minutes: order.accumulated_time_minutes,
                distance_km: order.distance_km,
                payment_method_id: order.payment_method_id,
                courier_zone_id: order.courier_zone_id,
                executor_zone_id: order.executor_zone_id,
                courier_zone: order.courier_zone,
                executor_zone: order.executor_zone,
                client: order.client,
                branch: order.branch,
                payment_method: order.payment_method,
                phone: order.phone,
                items: items || []
              });
            }
          }
        }
      }

      formattedOrders.sort((a, b) =>
        new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()
      );

      setCompletedOrders(formattedOrders);

      if (orderExecutors && orderExecutors.length > 0) {
        const executorsMap: Record<string, OrderExecutor> = {};
        orderExecutors.forEach(e => {
          if (e.orders) {
            executorsMap[e.order_id] = {
              id: e.id,
              order_id: e.order_id,
              zone_id: e.zone_id,
              distance_price_uah: e.distance_price_uah,
              total_delivery_price_uah: e.total_delivery_price_uah,
              rounded_distance_km: e.rounded_distance_km,
              zone: e.zone
            };
          }
        });
        setOrderExecutors(executorsMap);
      }
    } catch (err) {
      console.error('Error loading completed orders:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getCourierPayment = (order: CompletedOrder): { zonePayment: number; distancePayment: number; total: number; zoneName: string | null } => {
    const executor = orderExecutors[order.id];

    let zonePayment = 0;
    let distancePayment = 0;
    let zoneName: string | null = null;

    if (executor) {
      if (executor.zone?.courier_payment) {
        zonePayment = Number(executor.zone.courier_payment);
        zoneName = executor.zone.name || null;
      }
      if (executor.distance_price_uah) {
        distancePayment = Number(executor.distance_price_uah);
      }
      if (executor.total_delivery_price_uah) {
        return {
          zonePayment,
          distancePayment,
          total: Number(executor.total_delivery_price_uah),
          zoneName
        };
      }
    }

    if (order.executor_zone?.courier_payment) {
      zonePayment = Number(order.executor_zone.courier_payment);
      zoneName = order.executor_zone.name || null;
    } else if (order.courier_zone?.courier_payment) {
      zonePayment = Number(order.courier_zone.courier_payment);
      zoneName = order.courier_zone.name || null;
    }

    return {
      zonePayment,
      distancePayment,
      total: zonePayment + distancePayment,
      zoneName
    };
  };

  const totals = useMemo(() => {
    let totalZone = 0;
    let totalDistance = 0;
    let grandTotal = 0;
    let orderCount = 0;

    completedOrders.forEach(order => {
      const payment = getCourierPayment(order);
      totalZone += payment.zonePayment;
      totalDistance += payment.distancePayment;
      grandTotal += payment.total;
      orderCount++;
    });

    return { totalZone, totalDistance, grandTotal, orderCount };
  }, [completedOrders, orderExecutors]);

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (minutes: number | null) => {
    if (!minutes) return '0:00:00';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes * 60) % 60);
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getActualOrderTime = (order: ActiveOrder): number => {
    if (!order.accepted_at) return 0;

    const acceptedTime = new Date(order.accepted_at);
    const diffMs = currentTime.getTime() - acceptedTime.getTime();
    const diffMinutes = diffMs / (1000 * 60);

    return Math.max(0, diffMinutes);
  };

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleHistoryExpansion = (orderId: string) => {
    setExpandedHistory(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const openNavigation = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(orderId);
    try {
      const updateData: any = { status: newStatus };

      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else if (newStatus === 'en_route') {
        updateData.en_route_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      if (newStatus === 'completed') {
        setActiveOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        await loadActiveOrders();
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Ошибка при обновлении статуса заказа');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getVehicleIcon = (type: string | null) => {
    switch (type) {
      case 'авто':
        return <Car className="w-5 h-5" />;
      case 'мотоцикл':
      case 'велосипед':
        return <Bike className="w-5 h-5" />;
      default:
        return <Truck className="w-5 h-5" />;
    }
  };

  const getVehicleTypeName = (type: string | null): string => {
    switch (type) {
      case 'пеший': return 'Пеший';
      case 'велосипед': return 'Велосипед';
      case 'мотоцикл': return 'Мотоцикл';
      case 'авто': return 'Авто';
      default: return type || 'Не указан';
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      new: { label: 'Новый', color: 'bg-blue-100 text-blue-700' },
      accepted: { label: 'Принят', color: 'bg-yellow-100 text-yellow-700' },
      preparing: { label: 'Готовится', color: 'bg-orange-100 text-orange-700' },
      ready: { label: 'Готов', color: 'bg-green-100 text-green-700' },
      en_route: { label: 'В пути', color: 'bg-blue-100 text-blue-700' },
      in_progress: { label: 'В работе', color: 'bg-cyan-100 text-cyan-700' },
      completed: { label: 'Выполнен', color: 'bg-green-100 text-green-700' },
      cancelled: { label: 'Отменен', color: 'bg-red-100 text-red-700' },
    };
    const config = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const quickPeriodButtons: { id: QuickPeriod; label: string }[] = [
    { id: 'today', label: 'Сегодня' },
    { id: 'yesterday', label: 'Вчера' },
    { id: 'week', label: 'Неделя' },
    { id: 'month', label: 'Месяц' },
  ];

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
    const isNotFoundOrInactive = error === 'not_found' || error === 'not_active' || error === 'telegram_mismatch' || error === 'no_credentials';

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className={`w-16 h-16 mx-auto mb-4 ${isNotFoundOrInactive ? 'text-amber-500' : 'text-red-500'}`} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {error === 'not_found' && 'Кабинет не найден'}
            {error === 'not_active' && 'Кабинет неактивен'}
            {error === 'telegram_mismatch' && 'Доступ запрещен'}
            {error === 'no_credentials' && 'Авторизация не настроена'}
            {error !== 'not_found' && error !== 'not_active' && error !== 'telegram_mismatch' && error !== 'no_credentials' && 'Ошибка доступа'}
          </h1>
          <p className="text-gray-600 mb-6">
            {error === 'not_found' && 'Курьер с таким идентификатором не найден в системе.'}
            {error === 'not_active' && 'Ваш аккаунт курьера временно деактивирован.'}
            {error === 'telegram_mismatch' && 'Ваш Telegram-аккаунт не связан с этим кабинетом курьера.'}
            {error === 'no_credentials' && 'Для входа в кабинет необходимо настроить логин и пароль. Обратитесь к администратору.'}
            {error !== 'not_found' && error !== 'not_active' && error !== 'telegram_mismatch' && error !== 'no_credentials' && error}
          </p>
          {(error === 'not_found' || error === 'telegram_mismatch') && (
            <div className="bg-blue-50 rounded-xl p-4 text-left">
              <p className="text-sm text-blue-800 mb-2">
                <strong>Для получения доступа:</strong>
              </p>
              <p className="text-sm text-blue-700">
                Зарегистрируйтесь через Telegram-бота для курьеров. После регистрации вы получите персональную ссылку на кабинет.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthenticated && courierSlug && !isTelegramWebApp) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Кабинет курьера</h1>
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

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              Для автоматической авторизации откройте ссылку через Telegram-бота
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!courier) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
              {courier.name.charAt(0)}{courier.lastname?.charAt(0) || ''}
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {courier.name} {courier.lastname || ''}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {getVehicleIcon(courier.vehicle_type)}
                <span>{getVehicleTypeName(courier.vehicle_type)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 sticky top-[72px] z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex-1 py-4 px-4 font-medium text-sm transition-all border-b-2 ${
                activeTab === 'active'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Package className="w-5 h-5" />
                <span>Заказы</span>
                {activeOrders.length > 0 && (
                  <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {activeOrders.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-4 px-4 font-medium text-sm transition-all border-b-2 ${
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <History className="w-5 h-5" />
                <span>История</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-4 px-4 font-medium text-sm transition-all border-b-2 ${
                activeTab === 'profile'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <User className="w-5 h-5" />
                <span>Личные данные</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'active' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('assigned')}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                  statusFilter === 'assigned'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>Назначенные</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    statusFilter === 'assigned'
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-600 text-white'
                  }`}>
                    {activeOrders.filter(o => o.status === 'in_progress').length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setStatusFilter('en_route')}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                  statusFilter === 'en_route'
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>В дороге</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    statusFilter === 'en_route'
                      ? 'bg-white/20 text-white'
                      : 'bg-cyan-600 text-white'
                  }`}>
                    {activeOrders.filter(o => o.status === 'en_route').length}
                  </span>
                </div>
              </button>
            </div>

            {activeOrders.filter(order => {
              if (statusFilter === 'assigned') {
                return order.status === 'in_progress';
              }
              return order.status === 'en_route';
            }).length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {statusFilter === 'assigned' ? 'Нет назначенных заказов' : 'Нет заказов в дороге'}
                </h2>
                <p className="text-gray-500">Здесь будут отображаться ваши заказы</p>
              </div>
            ) : (
              activeOrders
                .filter(order => {
                  if (statusFilter === 'assigned') {
                    return order.status === 'in_progress';
                  }
                  return order.status === 'en_route';
                })
                .map(order => {
                  const isExpanded = expandedOrders.has(order.id);
                  const courierPayment = order.zone?.courier_payment || 0;
                  const distancePayment = order.distance_price_uah || 0;
                  const totalPayment = courierPayment + distancePayment;
                  const zoneName = order.zone?.name || null;

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden hover:shadow-xl transition-all cursor-pointer"
                      onClick={() => toggleOrderExpansion(order.id)}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-gray-900">
                              #{order.order_number}
                            </span>
                            {getStatusBadge(order.status)}
                            <div className="flex items-center gap-1 text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                              <Clock className="w-4 h-4" />
                              {formatTime(getActualOrderTime(order))}
                            </div>
                          </div>
                          <button className="p-1 hover:bg-gray-200 rounded-lg transition-colors">
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-600" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-600" />
                            )}
                          </button>
                        </div>

                        {order.branch && (
                          <div className="mb-2 p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <Package className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-blue-900 mb-1">Забрать:</div>
                                  <div className="text-xs text-gray-700 break-words leading-tight">
                                    {order.branch.name}
                                    {order.branch.address && (
                                      <div className="text-gray-500 mt-0.5">({order.branch.address})</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {order.branch.latitude && order.branch.longitude && (
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${order.branch.latitude},${order.branch.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                                >
                                  <Navigation className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {order.distance_km !== null && (
                          <div className="flex items-center justify-center py-2">
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                              <ArrowRight className="w-4 h-4" />
                              <span className="font-semibold">{order.distance_km.toFixed(1)} км</span>
                            </div>
                          </div>
                        )}

                        {(order.delivery_address || (order.delivery_lat && order.delivery_lng)) && (
                          <div className="mb-3 p-3 bg-green-50 rounded-lg">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <MapPin className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-green-900 mb-1">Отвезти:</div>
                                  <div className="text-xs text-gray-700 break-words leading-tight">
                                    {order.delivery_address}
                                  </div>
                                </div>
                              </div>
                              {order.delivery_lat && order.delivery_lng && (
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex-shrink-0"
                                >
                                  <Navigation className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {order.phone && (
                          <div className="flex items-center gap-2 mb-3">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <a
                              href={`tel:${order.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:underline font-semibold"
                            >
                              {order.phone}
                            </a>
                            {(order.client?.first_name || order.client?.last_name) && (
                              <span className="text-gray-500">
                                ({[order.client.first_name, order.client.last_name].filter(Boolean).join(' ')})
                              </span>
                            )}
                          </div>
                        )}

                        <div className="space-y-3 mb-3">
                          <div className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium text-gray-600">Сумма заказа</div>
                              {order.payment_method?.name && (
                                <div className="text-xs bg-white px-2 py-1 rounded border border-blue-200 text-gray-700">
                                  {order.payment_method.name}
                                </div>
                              )}
                            </div>
                            {order.total_amount !== null ? (
                              <div className="text-2xl font-bold text-gray-900">
                                {order.total_amount.toFixed(2)} {currency}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">-</div>
                            )}
                          </div>

                          {(courierPayment > 0 || distancePayment > 0) && (
                            <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                              <div className="text-sm font-medium text-gray-600 mb-2">Ваш заработок за доставку</div>
                              <div className="text-2xl font-bold text-green-700 mb-2">
                                {totalPayment.toFixed(2)} {currency}
                              </div>
                              <div className="space-y-1.5 text-xs text-gray-700 bg-white/70 rounded p-2 border border-green-100">
                                {courierPayment > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">
                                      {zoneName ? `Зона "${zoneName}"` : 'Базовая зона'}:
                                    </span>
                                    <span className="font-semibold text-gray-900">{courierPayment.toFixed(2)} {currency}</span>
                                  </div>
                                )}
                                {distancePayment > 0 && order.distance_km && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">
                                      Километраж ({order.distance_km.toFixed(1)} км):
                                    </span>
                                    <span className="font-semibold text-gray-900">{distancePayment.toFixed(2)} {currency}</span>
                                  </div>
                                )}
                                <div className="pt-1.5 mt-1.5 border-t border-green-200">
                                  <div className="flex items-center gap-1 text-xs">
                                    <DollarSign className="w-3 h-3 text-green-600" />
                                    <span className="text-gray-600">Расчет выполнен автоматически</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {order.status === 'in_progress' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateOrderStatus(order.id, 'en_route');
                            }}
                            disabled={updatingStatus === order.id}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updatingStatus === order.id ? 'Обновление...' : 'Выехал'}
                          </button>
                        )}

                        {order.status === 'en_route' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateOrderStatus(order.id, 'completed');
                            }}
                            disabled={updatingStatus === order.id}
                            className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updatingStatus === order.id ? 'Обновление...' : 'Выполнен'}
                          </button>
                        )}
                      </div>

                      {isExpanded && order.items && order.items.length > 0 && (
                        <div className="px-5 pb-5 border-t border-gray-200 pt-4 bg-gray-50">
                          <h4 className="font-semibold text-gray-900 mb-3">Содержимое заказа:</h4>
                          <div className="space-y-2">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center p-3 bg-white rounded-lg">
                                <div>
                                  <div className="font-medium text-gray-900">{item.product_name}</div>
                                  <div className="text-sm text-gray-500">x{item.quantity}</div>
                                </div>
                                <div className="font-semibold text-gray-900">{item.total_price.toFixed(2)} {currency}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {quickPeriodButtons.map(btn => (
                  <button
                    key={btn.id}
                    onClick={() => setQuickPeriodDates(btn.id)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      quickPeriod === btn.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">С</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setQuickPeriod('custom');
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">По</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setQuickPeriod('custom');
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-6 h-6" />
                <span className="font-semibold text-lg">Итого за период</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-3xl font-bold">{totals.orderCount}</div>
                  <div className="text-sm text-green-100">заказов</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{totals.totalZone.toLocaleString('ru-RU')}</div>
                  <div className="text-sm text-green-100">за зоны ({currency})</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{totals.totalDistance.toLocaleString('ru-RU')}</div>
                  <div className="text-sm text-green-100">за км ({currency})</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-green-400/30">
                <div className="flex items-baseline justify-between">
                  <span className="text-green-100">Всего заработано:</span>
                  <span className="text-4xl font-bold">{totals.grandTotal.toLocaleString('ru-RU')} {currency}</span>
                </div>
              </div>
            </div>

            {historyLoading ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Загрузка истории...</p>
              </div>
            ) : completedOrders.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Нет заказов</h2>
                <p className="text-gray-500">За выбранный период нет завершенных доставок</p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedOrders.map(order => {
                  const isExpanded = expandedHistory.has(order.id);
                  const payment = getCourierPayment(order);
                  const courierPayment = payment.zonePayment || 0;
                  const distancePayment = payment.distancePayment || 0;

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden hover:shadow-xl transition-all cursor-pointer"
                      onClick={() => toggleHistoryExpansion(order.id)}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-gray-900">
                              #{order.order_number}
                            </span>
                            <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700">
                              Выполнен
                            </span>
                            {order.accumulated_time_minutes !== null && (
                              <div className="flex items-center gap-1 text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                                <Clock className="w-4 h-4" />
                                {formatTime(order.accumulated_time_minutes)}
                              </div>
                            )}
                          </div>
                          <button className="p-1 hover:bg-gray-200 rounded-lg transition-colors">
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-600" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-600" />
                            )}
                          </button>
                        </div>

                        {order.branch && (
                          <div className="mb-2 p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Package className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              <span className="font-semibold text-blue-900">Забрать:</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-gray-700">
                                {order.branch.name}
                                {order.branch.address && (
                                  <div className="text-sm text-gray-500">{order.branch.address}</div>
                                )}
                              </div>
                              {order.branch.latitude && order.branch.longitude && (
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${order.branch.latitude},${order.branch.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0 ml-2"
                                >
                                  <Navigation className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {order.distance_km !== null && (
                          <div className="flex items-center justify-center py-2">
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                              <ArrowRight className="w-4 h-4" />
                              <span className="font-semibold">{order.distance_km.toFixed(1)} км</span>
                            </div>
                          </div>
                        )}

                        {(order.delivery_address || (order.delivery_lat && order.delivery_lng)) && (
                          <div className="mb-3 p-3 bg-green-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                              <span className="font-semibold text-green-900">Отвезти:</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-gray-700">{order.delivery_address}</span>
                              {order.delivery_lat && order.delivery_lng && (
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex-shrink-0 ml-2"
                                >
                                  <Navigation className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {order.phone && (
                          <div className="flex items-center gap-2 mb-3">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <a
                              href={`tel:${order.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:underline font-semibold"
                            >
                              {order.phone}
                            </a>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium text-gray-600">Сумма заказа</div>
                              {order.payment_method?.name && (
                                <div className="text-xs bg-white px-2 py-1 rounded border border-blue-200 text-gray-700">
                                  {order.payment_method.name}
                                </div>
                              )}
                            </div>
                            {order.total_amount !== null ? (
                              <div className="text-2xl font-bold text-gray-900">
                                {order.total_amount.toFixed(2)} {currency}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">-</div>
                            )}
                          </div>

                          {(courierPayment > 0 || distancePayment > 0) && (
                            <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                              <div className="text-sm font-medium text-gray-600 mb-2">Ваш заработок за доставку</div>
                              <div className="text-2xl font-bold text-green-700 mb-2">
                                {payment.total.toFixed(2)} {currency}
                              </div>
                              <div className="space-y-1.5 text-xs text-gray-700 bg-white/70 rounded p-2 border border-green-100">
                                {courierPayment > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">
                                      {payment.zoneName ? `Зона "${payment.zoneName}"` : 'Базовая зона'}:
                                    </span>
                                    <span className="font-semibold text-gray-900">{courierPayment.toFixed(2)} {currency}</span>
                                  </div>
                                )}
                                {distancePayment > 0 && order.distance_km && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">
                                      Километраж ({order.distance_km.toFixed(1)} км):
                                    </span>
                                    <span className="font-semibold text-gray-900">{distancePayment.toFixed(2)} {currency}</span>
                                  </div>
                                )}
                                <div className="pt-1.5 mt-1.5 border-t border-green-200">
                                  <div className="flex items-center gap-1 text-xs">
                                    <DollarSign className="w-3 h-3 text-green-600" />
                                    <span className="text-gray-600">Расчет выполнен автоматически</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-gray-500">
                          Завершен: {formatDate(order.completed_at)}
                        </div>
                      </div>

                      {isExpanded && order.items && order.items.length > 0 && (
                        <div className="px-5 pb-5 border-t border-gray-200 pt-4 bg-gray-50">
                          <h4 className="font-semibold text-gray-900 mb-3">Содержимое заказа:</h4>
                          <div className="space-y-2">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center p-3 bg-white rounded-lg">
                                <div>
                                  <div className="font-medium text-gray-900">{item.product_name}</div>
                                  <div className="text-sm text-gray-500">x{item.quantity}</div>
                                </div>
                                <div className="font-semibold text-gray-900">{item.total_price.toFixed(2)} {currency}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-bold">
                  {courier.name.charAt(0)}{courier.lastname?.charAt(0) || ''}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{courier.name} {courier.lastname || ''}</h2>
                  <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium mt-2 ${
                    courier.is_active ? 'bg-green-400/30 text-green-100' : 'bg-red-400/30 text-red-100'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${courier.is_active ? 'bg-green-300' : 'bg-red-300'}`}></span>
                    {courier.is_active ? 'Активен' : 'Неактивен'}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Телефон</label>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  {courier.phone ? (
                    <a href={`tel:${courier.phone}`} className="text-lg text-blue-600 hover:underline">
                      {courier.phone}
                    </a>
                  ) : (
                    <span className="text-lg text-gray-400">Не указан</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Транспорт</label>
                <div className="flex items-center gap-3">
                  {getVehicleIcon(courier.vehicle_type)}
                  <span className="text-lg text-gray-900">{getVehicleTypeName(courier.vehicle_type)}</span>
                </div>
              </div>

              {courier.telegram_username && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Telegram</label>
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.1.154.233.17.329.015.096.034.314.019.484z"/>
                    </svg>
                    <span className="text-lg text-gray-900">@{courier.telegram_username}</span>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Для изменения данных используйте команду <code className="bg-gray-100 px-2 py-0.5 rounded text-blue-600">/editregis</code> в боте
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
