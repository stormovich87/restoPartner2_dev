import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Filter, ChevronDown, ChevronUp, Trash2, CheckCircle, Clock, MapPin, Phone, User, CreditCard, Truck, Building2, Settings, Package, DollarSign, X, ChevronRight } from 'lucide-react';
import HistorySettingsModal from '../../components/HistorySettingsModal';

interface OrderHistoryProps {
  partnerId: string;
  staffBranchIds?: string[];
}

interface ArchivedOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  archived_at: string;
  client_name: string | null;
  phone: string | null;
  delivery_address: string | null;
  address_line: string | null;
  total_amount: number | null;
  delivery_price_uah: number | null;
  payment_status: string | null;
  delivery_type: 'delivery' | 'pickup' | null;
  executor_type: string | null;
  executor_id: string | null;
  executor_zone_id: string | null;
  courier_id: string | null;
  courier_zone_id: string | null;
  delivery_payer: string | null;
  accumulated_time_minutes: number | null;
  accumulated_delay_minutes: number | null;
  shift_id: string | null;
  branch_id: string | null;
  executor_id: string | null;
  distance_km: number | null;
  courier_payment_amount: number | null;
  branch?: { name: string } | null;
  courier?: { name: string; lastname: string | null } | null;
  payment_method?: { name: string; method_type: string } | null;
  shift?: { opened_at: string; closed_at: string | null } | null;
  courier_zone?: { name: string | null; courier_payment: number | null; free_delivery_threshold: number | null } | null;
  executor_zone?: { name: string | null; price_uah: number | null; courier_payment: number | null } | null;
  executor?: { name: string; km_calculation_enabled: boolean; price_per_km: number; km_graduation_meters: number } | null;
}

interface Shift {
  id: string;
  branch_id: string;
  opened_at: string;
  closed_at: string | null;
  status: string;
  branch?: { name: string };
}

interface CourierZone {
  id: string;
  name: string;
  price_uah: number;
  courier_payment: number;
}

interface PerformerZone {
  id: string;
  performer_id: string;
  name: string;
  price_uah: number;
  courier_payment: number;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  modifiers: Array<{
    modifier_name: string;
    price: number;
  }>;
}

type QuickPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export default function OrderHistory({ partnerId, staffBranchIds }: OrderHistoryProps) {
  const [activeTab, setActiveTab] = useState<'completed' | 'deleted'>('completed');
  const [orders, setOrders] = useState<ArchivedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [courierZones, setCourierZones] = useState<CourierZone[]>([]);
  const [performerZones, setPerformerZones] = useState<PerformerZone[]>([]);
  const [executors, setExecutors] = useState<{ id: string; name: string; km_calculation_enabled: boolean; price_per_km: number; km_graduation_meters: number }[]>([]);
  const [couriers, setCouriers] = useState<{ id: string; name: string; lastname: string | null }[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string }[]>([]);

  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>('today');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedCourierIds, setSelectedCourierIds] = useState<string[]>([]);
  const [selectedExecutorIds, setSelectedExecutorIds] = useState<string[]>([]);
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
  const [selectedPaymentMethodIds, setSelectedPaymentMethodIds] = useState<string[]>([]);
  const [filterByShifts, setFilterByShifts] = useState(false);
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<'all' | 'delivery' | 'pickup'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<'created_at' | 'completed_at' | 'order_number'>('completed_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [showBranchesDropdown, setShowBranchesDropdown] = useState(false);
  const [showCouriersDropdown, setShowCouriersDropdown] = useState(false);
  const [showExecutorsDropdown, setShowExecutorsDropdown] = useState(false);
  const [showShiftsDropdown, setShowShiftsDropdown] = useState(false);
  const [showPaymentMethodsDropdown, setShowPaymentMethodsDropdown] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});

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
    setQuickPeriodDates('today');
    loadInitialData();
  }, [partnerId]);

  useEffect(() => {
    if (branches.length > 0 && selectedBranchIds.length === 0) {
      setSelectedBranchIds(branches.map(b => b.id));
    }
  }, [branches]);

  useEffect(() => {
    if (dateFrom && dateTo) {
      loadOrders();
    }
  }, [partnerId, activeTab, dateFrom, dateTo, selectedBranchIds, selectedCourierIds, selectedExecutorIds, selectedShiftIds, selectedPaymentMethodIds, filterByShifts, deliveryTypeFilter, sortField, sortDirection]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showBranchesDropdown && !target.closest('.branches-dropdown')) {
        setShowBranchesDropdown(false);
      }
      if (showCouriersDropdown && !target.closest('.couriers-dropdown')) {
        setShowCouriersDropdown(false);
      }
      if (showExecutorsDropdown && !target.closest('.executors-dropdown')) {
        setShowExecutorsDropdown(false);
      }
      if (showShiftsDropdown && !target.closest('.shifts-dropdown')) {
        setShowShiftsDropdown(false);
      }
      if (showPaymentMethodsDropdown && !target.closest('.payment-methods-dropdown')) {
        setShowPaymentMethodsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBranchesDropdown, showCouriersDropdown, showExecutorsDropdown, showShiftsDropdown, showPaymentMethodsDropdown]);

  const loadInitialData = async () => {
    try {
      const [branchesRes, shiftsRes, courierZonesRes, executorsRes, couriersRes, paymentMethodsRes] = await Promise.all([
        supabase
          .from('branches')
          .select('id, name')
          .eq('partner_id', partnerId)
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('shifts')
          .select('id, branch_id, opened_at, closed_at, status, branch:branches!inner(name)')
          .eq('partner_id', partnerId)
          .order('closed_at', { ascending: false })
          .limit(200),
        supabase
          .from('courier_delivery_zones')
          .select('id, name, price_uah, courier_payment')
          .eq('partner_id', partnerId),
        supabase
          .from('executors')
          .select('id, name, km_calculation_enabled, price_per_km, km_graduation_meters')
          .eq('partner_id', partnerId)
          .eq('status', 'active'),
        supabase
          .from('couriers')
          .select('id, name, lastname')
          .eq('partner_id', partnerId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('payment_methods')
          .select('id, name')
          .eq('partner_id', partnerId)
          .eq('is_active', true)
          .order('name')
      ]);

      if (branchesRes.data) {
        const filteredBranches = staffBranchIds && staffBranchIds.length > 0
          ? branchesRes.data.filter(b => staffBranchIds.includes(b.id))
          : branchesRes.data;

        setBranches(filteredBranches);
        setSelectedBranchIds(filteredBranches.map(b => b.id));
      }

      if (shiftsRes.data) {
        const filteredShifts = staffBranchIds && staffBranchIds.length > 0
          ? shiftsRes.data.filter(s => staffBranchIds.includes(s.branch_id))
          : shiftsRes.data;
        setShifts(filteredShifts as Shift[]);
      }

      if (courierZonesRes.data) {
        setCourierZones(courierZonesRes.data);
      }

      if (executorsRes.data) {
        setExecutors(executorsRes.data);
        setSelectedExecutorIds(executorsRes.data.map(e => e.id));

        const executorIds = executorsRes.data.map(e => e.id);
        if (executorIds.length > 0) {
          const { data: perfZones } = await supabase
            .from('performer_delivery_zones')
            .select('id, performer_id, name, price_uah, courier_payment')
            .in('performer_id', executorIds);

          if (perfZones) {
            setPerformerZones(perfZones);
          }
        }
      }

      if (couriersRes.data) {
        setCouriers(couriersRes.data);
        setSelectedCourierIds(couriersRes.data.map(c => c.id));
      }

      if (paymentMethodsRes.data) {
        setPaymentMethods(paymentMethodsRes.data);
        setSelectedPaymentMethodIds(paymentMethodsRes.data.map(p => p.id));
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadOrders = async () => {
    if (!dateFrom || !dateTo) return;

    setLoading(true);
    try {
      if (activeTab === 'completed') {
        let query = supabase
          .from('orders')
          .select(`
            *,
            branch:branches!orders_branch_id_fkey(name),
            courier:couriers!orders_courier_id_fkey(name, lastname),
            payment_method:payment_methods!orders_payment_method_id_fkey(name, method_type),
            shift:shifts!orders_shift_id_fkey(opened_at, closed_at),
            courier_zone:courier_delivery_zones!orders_courier_zone_id_fkey(name, courier_payment, free_delivery_threshold),
            executor_zone:performer_delivery_zones!orders_executor_zone_id_fkey(name, price_uah, courier_payment)
          `)
          .eq('partner_id', partnerId)
          .eq('status', 'completed');

        query = query.gte('completed_at', `${dateFrom}T00:00:00`);
        query = query.lte('completed_at', `${dateTo}T23:59:59`);

        if (selectedBranchIds.length > 0 && selectedBranchIds.length < branches.length) {
          query = query.in('branch_id', selectedBranchIds);
        }

        if (selectedCourierIds.length > 0 && selectedCourierIds.length < couriers.length) {
          query = query.in('courier_id', selectedCourierIds);
        }

        if (selectedExecutorIds.length > 0 && selectedExecutorIds.length < executors.length) {
          query = query.in('executor_id', selectedExecutorIds);
        }

        if (filterByShifts && selectedShiftIds.length > 0) {
          query = query.in('shift_id', selectedShiftIds);
        }

        if (selectedPaymentMethodIds.length > 0 && selectedPaymentMethodIds.length < paymentMethods.length) {
          query = query.in('payment_method_id', selectedPaymentMethodIds);
        }

        if (deliveryTypeFilter !== 'all') {
          query = query.eq('delivery_type', deliveryTypeFilter);
        }

        if (staffBranchIds && staffBranchIds.length > 0) {
          query = query.in('branch_id', staffBranchIds);
        }

        query = query.order(sortField === 'completed_at' ? 'completed_at' : sortField, { ascending: sortDirection === 'asc' }).limit(500);

        const { data, error } = await query;

        if (error) throw error;

        // Enrich orders with executor data
        const enrichedOrders = (data || []).map(o => {
          const executor = executors.find(e => e.id === o.executor_id);
          return {
            ...o,
            archived_at: o.completed_at,
            executor: executor ? {
              name: executor.name,
              km_calculation_enabled: executor.km_calculation_enabled,
              price_per_km: executor.price_per_km,
              km_graduation_meters: executor.km_graduation_meters
            } : null
          };
        });

        setOrders(enrichedOrders);
      } else {
        let query = supabase
          .from('archived_orders')
          .select(`
            *,
            branch:branches!archived_orders_branch_id_fkey(name),
            courier:couriers!archived_orders_courier_id_fkey(name, lastname),
            payment_method:payment_methods!archived_orders_payment_method_id_fkey(name, method_type),
            shift:shifts!archived_orders_shift_id_fkey(opened_at, closed_at),
            courier_zone:courier_delivery_zones!archived_orders_courier_zone_id_fkey(name, courier_payment, free_delivery_threshold),
            executor_zone:performer_delivery_zones!archived_orders_executor_zone_id_fkey(name, price_uah, courier_payment)
          `)
          .eq('partner_id', partnerId);

        query = query.gte('archived_at', `${dateFrom}T00:00:00`);
        query = query.lte('archived_at', `${dateTo}T23:59:59`);

        if (selectedBranchIds.length > 0 && selectedBranchIds.length < branches.length) {
          query = query.in('branch_id', selectedBranchIds);
        }

        if (selectedCourierIds.length > 0 && selectedCourierIds.length < couriers.length) {
          query = query.in('courier_id', selectedCourierIds);
        }

        if (selectedExecutorIds.length > 0 && selectedExecutorIds.length < executors.length) {
          query = query.in('executor_id', selectedExecutorIds);
        }

        if (filterByShifts && selectedShiftIds.length > 0) {
          query = query.in('shift_id', selectedShiftIds);
        }

        if (selectedPaymentMethodIds.length > 0 && selectedPaymentMethodIds.length < paymentMethods.length) {
          query = query.in('payment_method_id', selectedPaymentMethodIds);
        }

        if (deliveryTypeFilter !== 'all') {
          query = query.eq('delivery_type', deliveryTypeFilter);
        }

        if (staffBranchIds && staffBranchIds.length > 0) {
          query = query.in('branch_id', staffBranchIds);
        }

        query = query.order(sortField, { ascending: sortDirection === 'asc' }).limit(500);

        const { data, error } = await query;

        if (error) throw error;

        // Enrich orders with executor data
        const enrichedOrders = (data || []).map(o => {
          const executor = executors.find(e => e.id === o.executor_id);
          return {
            ...o,
            executor: executor ? {
              name: executor.name,
              km_calculation_enabled: executor.km_calculation_enabled,
              price_per_km: executor.price_per_km,
              km_graduation_meters: executor.km_graduation_meters
            } : null
          };
        });

        setOrders(enrichedOrders);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredShifts = useMemo(() => {
    let filtered = shifts.filter(s => selectedBranchIds.includes(s.branch_id));

    if (dateFrom || dateTo) {
      filtered = filtered.filter(shift => {
        const shiftDate = shift.closed_at ? new Date(shift.closed_at) : new Date(shift.opened_at);

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
  }, [shifts, selectedBranchIds, dateFrom, dateTo]);

  const getDeliveryPriceAndCourierPayment = (order: ArchivedOrder): { deliveryPrice: number | null; courierPayment: number | null; zoneName: string | null } => {
    if (order.delivery_type !== 'delivery') {
      return {
        deliveryPrice: null,
        courierPayment: null,
        zoneName: null
      };
    }

    const deliveryPrice: number | null = order.delivery_price_uah;
    let courierPayment: number | null = null;
    let zoneName: string | null = null;

    if (order.courier_payment_amount != null) {
      courierPayment = Number(order.courier_payment_amount);
    } else {
      let basePayment = 0;
      if (order.executor_type === 'performer' && order.executor_zone?.courier_payment != null) {
        basePayment = Number(order.executor_zone.courier_payment);
      } else if (order.courier_zone?.courier_payment != null) {
        basePayment = Number(order.courier_zone.courier_payment);
      }

      if (basePayment > 0) {
        courierPayment = basePayment;

        if (order.executor?.km_calculation_enabled && order.executor.price_per_km > 0 && order.distance_km) {
          const minDistance = 1;
          const graduationKm = (order.executor.km_graduation_meters || 100) / 1000;
          let calcDistance = Math.max(order.distance_km, minDistance);

          if (graduationKm > 0) {
            calcDistance = Math.round(calcDistance / graduationKm) * graduationKm;
            calcDistance = Math.max(calcDistance, minDistance);
          }

          const distancePrice = Math.round(calcDistance * order.executor.price_per_km);
          courierPayment += distancePrice;
        }
      }
    }

    if (order.executor_type === 'performer' && order.executor_zone?.name) {
      zoneName = order.executor_zone.name;
    } else if (order.courier_zone?.name) {
      zoneName = order.courier_zone.name;
    }

    return {
      deliveryPrice,
      courierPayment,
      zoneName
    };
  };

  const getExecutorName = (order: ArchivedOrder): string => {
    if (order.executor_type === 'courier' && order.courier) {
      return `${order.courier.name}${order.courier.lastname ? ' ' + order.courier.lastname : ''}`;
    }
    if (order.executor_type === 'performer' && order.executor_id) {
      const executor = executors.find(e => e.id === order.executor_id);
      return executor?.name || '-';
    }
    if (order.courier) {
      return `${order.courier.name}${order.courier.lastname ? ' ' + order.courier.lastname : ''}`;
    }
    return '-';
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

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

  const formatMinutes = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return '-';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}ч ${mins}м`;
    }
    return `${mins}м`;
  };

  const fetchOrderItems = async (orderId: string) => {
    if (orderItems[orderId]) {
      return;
    }

    const { data } = await supabase
      .from('order_items')
      .select('id, product_name, quantity, total_price, base_price, modifiers')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (data) {
      const formattedData = data.map(item => ({
        id: item.id,
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.total_price / item.quantity,
        modifiers: Array.isArray(item.modifiers) ? item.modifiers.map((m: any) => ({
          modifier_name: m.name || m.modifier_name,
          price: m.price
        })) : []
      }));
      setOrderItems(prev => ({ ...prev, [orderId]: formattedData }));
    }
  };

  const toggleOrderExpand = async (orderId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(orderId);
      await fetchOrderItems(orderId);
    }
  };

  const totals = useMemo(() => {
    let totalAmount = 0;
    let totalDelivery = 0;
    let totalCourierPayment = 0;
    let deliveryCount = 0;
    let deliveryAmount = 0;
    let pickupCount = 0;
    let pickupAmount = 0;

    orders.forEach(order => {
      totalAmount += order.total_amount || 0;
      const { deliveryPrice, courierPayment } = getDeliveryPriceAndCourierPayment(order);
      totalDelivery += deliveryPrice || 0;
      totalCourierPayment += courierPayment || 0;

      if (order.delivery_type === 'delivery') {
        deliveryCount++;
        deliveryAmount += order.total_amount || 0;
      } else if (order.delivery_type === 'pickup') {
        pickupCount++;
        pickupAmount += order.total_amount || 0;
      }
    });

    return {
      totalAmount,
      totalDelivery,
      totalCourierPayment,
      deliveryCount,
      deliveryAmount,
      pickupCount,
      pickupAmount
    };
  }, [orders, courierZones, performerZones]);

  const quickPeriodButtons: { id: QuickPeriod; label: string }[] = [
    { id: 'today', label: 'Сегодня' },
    { id: 'yesterday', label: 'Вчера' },
    { id: 'week', label: 'Неделя' },
    { id: 'month', label: 'Месяц' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-4 items-center">
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'completed'
              ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
              : 'bg-white/80 border border-gray-300 text-gray-700 hover:border-green-400'
          }`}
        >
          <CheckCircle className="w-5 h-5" />
          Завершенные
        </button>
        <button
          onClick={() => setActiveTab('deleted')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'deleted'
              ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg'
              : 'bg-white/80 border border-gray-300 text-gray-700 hover:border-red-400'
          }`}
        >
          <Trash2 className="w-5 h-5" />
          Удаленные
        </button>
        <div className="ml-auto">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 bg-white/80 border border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50"
            title="Настройки автоматической очистки истории"
          >
            <Settings className="w-5 h-5" />
            Настройки очистки
          </button>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 relative z-20">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors rounded-t-2xl"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="font-semibold text-gray-900">Фильтры</span>
          </div>
          {showFilters ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
        </button>

        {showFilters && (
          <div className="px-6 pb-6 border-t border-gray-200 relative z-50">
            <div className="pt-4 space-y-4 relative">
              <div className="flex flex-wrap gap-2 items-end relative">
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

                <div className="ml-auto flex gap-2 items-end">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">З</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setQuickPeriod('custom');
                      }}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">По</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setQuickPeriod('custom');
                      }}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Package className="w-4 h-4 inline mr-2" />
                  Тип заказа
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeliveryTypeFilter('all')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      deliveryTypeFilter === 'all'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Все типы
                  </button>
                  <button
                    onClick={() => setDeliveryTypeFilter('delivery')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                      deliveryTypeFilter === 'delivery'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    Доставка
                  </button>
                  <button
                    onClick={() => setDeliveryTypeFilter('pickup')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                      deliveryTypeFilter === 'pickup'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    Самовынос
                  </button>
                </div>
              </div>

              <div className="space-y-4 relative">
                <div className="flex flex-wrap gap-3 relative">
                  <div className="min-w-[200px] branches-dropdown relative">
                    <button
                      onClick={() => setShowBranchesDropdown(!showBranchesDropdown)}
                      className="w-full px-4 py-2.5 bg-gray-100 rounded-lg text-left flex items-center justify-between hover:bg-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">
                          Филиалы {selectedBranchIds.length < branches.length && `(${selectedBranchIds.length})`}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showBranchesDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showBranchesDropdown && (
                      <div className="absolute z-50 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg">
                        <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                          <label className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer bg-blue-50">
                            <input
                              type="checkbox"
                              checked={selectedBranchIds.length === branches.length && branches.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBranchIds(branches.map(b => b.id));
                                } else {
                                  setSelectedBranchIds([]);
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="text-sm font-semibold text-blue-700">Все филиалы</span>
                          </label>
                          {branches.map(branch => (
                            <label key={branch.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedBranchIds.includes(branch.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedBranchIds([...selectedBranchIds, branch.id]);
                                  } else {
                                    setSelectedBranchIds(selectedBranchIds.filter(id => id !== branch.id));
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 rounded"
                              />
                              <span className="text-sm text-gray-700">{branch.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="min-w-[200px] couriers-dropdown relative">
                    <button
                      onClick={() => setShowCouriersDropdown(!showCouriersDropdown)}
                      className="w-full px-4 py-2.5 bg-gray-100 rounded-lg text-left flex items-center justify-between hover:bg-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">
                          Курьеры {selectedCourierIds.length < couriers.length && `(${selectedCourierIds.length})`}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showCouriersDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showCouriersDropdown && (
                      <div className="absolute z-50 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg">
                        <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                          {couriers.length === 0 ? (
                            <div className="text-xs text-gray-500 text-center py-4">
                              Нет активных курьеров
                            </div>
                          ) : (
                            <>
                              <label className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer bg-blue-50">
                                <input
                                  type="checkbox"
                                  checked={selectedCourierIds.length === couriers.length && couriers.length > 0}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedCourierIds(couriers.map(c => c.id));
                                    } else {
                                      setSelectedCourierIds([]);
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-sm font-semibold text-blue-700">Все курьеры</span>
                              </label>
                              {couriers.map(courier => (
                                <label key={courier.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedCourierIds.includes(courier.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedCourierIds([...selectedCourierIds, courier.id]);
                                      } else {
                                        setSelectedCourierIds(selectedCourierIds.filter(id => id !== courier.id));
                                      }
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded"
                                  />
                                  <span className="text-sm text-gray-700">{courier.name} {courier.lastname || ''}</span>
                                </label>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="min-w-[200px] executors-dropdown relative">
                    <button
                      onClick={() => setShowExecutorsDropdown(!showExecutorsDropdown)}
                      className="w-full px-4 py-2.5 bg-gray-100 rounded-lg text-left flex items-center justify-between hover:bg-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">
                          Исполнители {selectedExecutorIds.length < executors.length && `(${selectedExecutorIds.length})`}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showExecutorsDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showExecutorsDropdown && (
                      <div className="absolute z-50 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg">
                        <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                          {executors.length === 0 ? (
                            <div className="text-xs text-gray-500 text-center py-4">
                              Нет активных исполнителей
                            </div>
                          ) : (
                            <>
                              <label className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer bg-blue-50">
                                <input
                                  type="checkbox"
                                  checked={selectedExecutorIds.length === executors.length && executors.length > 0}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedExecutorIds(executors.map(e => e.id));
                                    } else {
                                      setSelectedExecutorIds([]);
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-sm font-semibold text-blue-700">Все исполнители</span>
                              </label>
                              {executors.map(executor => (
                                <label key={executor.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedExecutorIds.includes(executor.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedExecutorIds([...selectedExecutorIds, executor.id]);
                                      } else {
                                        setSelectedExecutorIds(selectedExecutorIds.filter(id => id !== executor.id));
                                      }
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded"
                                  />
                                  <span className="text-sm text-gray-700">{executor.name}</span>
                                </label>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="min-w-[200px] payment-methods-dropdown relative">
                    <button
                      onClick={() => setShowPaymentMethodsDropdown(!showPaymentMethodsDropdown)}
                      className="w-full px-4 py-2.5 bg-gray-100 rounded-lg text-left flex items-center justify-between hover:bg-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">
                          Типы оплат {selectedPaymentMethodIds.length < paymentMethods.length && `(${selectedPaymentMethodIds.length})`}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showPaymentMethodsDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showPaymentMethodsDropdown && (
                      <div className="absolute z-50 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg">
                        <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                          {paymentMethods.length === 0 ? (
                            <div className="text-xs text-gray-500 text-center py-4">
                              Нет доступных способов оплаты
                            </div>
                          ) : (
                            <>
                              <label className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer bg-blue-50">
                                <input
                                  type="checkbox"
                                  checked={selectedPaymentMethodIds.length === paymentMethods.length && paymentMethods.length > 0}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedPaymentMethodIds(paymentMethods.map(p => p.id));
                                    } else {
                                      setSelectedPaymentMethodIds([]);
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-sm font-semibold text-blue-700">Все типы</span>
                              </label>
                              {paymentMethods.map(method => (
                                <label key={method.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedPaymentMethodIds.includes(method.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedPaymentMethodIds([...selectedPaymentMethodIds, method.id]);
                                      } else {
                                        setSelectedPaymentMethodIds(selectedPaymentMethodIds.filter(id => id !== method.id));
                                      }
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded"
                                  />
                                  <span className="text-sm text-gray-700">{method.name}</span>
                                </label>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="min-w-[200px] shifts-dropdown relative">
                    <button
                      onClick={() => setShowShiftsDropdown(!showShiftsDropdown)}
                      className="w-full px-4 py-2.5 bg-gray-100 rounded-lg text-left flex items-center justify-between hover:bg-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">
                          Смены {filterByShifts && selectedShiftIds.length < filteredShifts.length && `(${selectedShiftIds.length})`}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showShiftsDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showShiftsDropdown && (
                      <div className="absolute z-50 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg">
                        <div className="p-3 space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filterByShifts}
                              onChange={(e) => {
                                setFilterByShifts(e.target.checked);
                                if (e.target.checked) {
                                  setSelectedShiftIds(filteredShifts.map(s => s.id));
                                } else {
                                  setSelectedShiftIds([]);
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="text-sm font-semibold text-gray-700">Фильтровать по сменам</span>
                          </label>

                          {filterByShifts && (
                            <div className="space-y-1 max-h-64 overflow-y-auto border-t border-gray-200 pt-2">
                              {filteredShifts.length === 0 ? (
                                <div className="text-xs text-gray-500 text-center py-4">
                                  Нет смен за выбранный период
                                </div>
                              ) : (
                                <>
                                  <label className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer bg-blue-50">
                                    <input
                                      type="checkbox"
                                      checked={selectedShiftIds.length === filteredShifts.length && filteredShifts.length > 0}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedShiftIds(filteredShifts.map(s => s.id));
                                        } else {
                                          setSelectedShiftIds([]);
                                        }
                                      }}
                                      className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-sm font-semibold text-blue-700">Выбрать все</span>
                                  </label>
                                  {filteredShifts.map(shift => (
                                    <label key={shift.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
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
                                        className="w-4 h-4 text-blue-600 rounded mt-0.5"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-gray-700 truncate">
                                          {shift.branch?.name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {new Date(shift.opened_at).toLocaleDateString('ru-RU')}
                                          {shift.closed_at && (
                                            <span className="ml-1">
                                              ({new Date(shift.opened_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - {new Date(shift.closed_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })})
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </label>
                                  ))}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedBranchIds.length > 0 && selectedBranchIds.length < branches.length && (
                    selectedBranchIds.map(branchId => {
                      const branch = branches.find(b => b.id === branchId);
                      if (!branch) return null;
                      return (
                        <div
                          key={branchId}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span>{branch.name}</span>
                          <button
                            onClick={() => setSelectedBranchIds(selectedBranchIds.filter(id => id !== branchId))}
                            className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}

                  {selectedCourierIds.length > 0 && selectedCourierIds.length < couriers.length && (
                    selectedCourierIds.map(courierId => {
                      const courier = couriers.find(c => c.id === courierId);
                      if (!courier) return null;
                      return (
                        <div
                          key={courierId}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>{courier.name} {courier.lastname || ''}</span>
                          <button
                            onClick={() => setSelectedCourierIds(selectedCourierIds.filter(id => id !== courierId))}
                            className="hover:bg-green-200 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}

                  {selectedExecutorIds.length > 0 && selectedExecutorIds.length < executors.length && (
                    selectedExecutorIds.map(executorId => {
                      const executor = executors.find(e => e.id === executorId);
                      if (!executor) return null;
                      return (
                        <div
                          key={executorId}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium"
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>{executor.name}</span>
                          <button
                            onClick={() => setSelectedExecutorIds(selectedExecutorIds.filter(id => id !== executorId))}
                            className="hover:bg-yellow-200 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}

                  {selectedPaymentMethodIds.length > 0 && selectedPaymentMethodIds.length < paymentMethods.length && (
                    selectedPaymentMethodIds.map(methodId => {
                      const method = paymentMethods.find(p => p.id === methodId);
                      if (!method) return null;
                      return (
                        <div
                          key={methodId}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>{method.name}</span>
                          <button
                            onClick={() => setSelectedPaymentMethodIds(selectedPaymentMethodIds.filter(id => id !== methodId))}
                            className="hover:bg-orange-200 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-6 relative z-10">
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{orders.length}</div>
              <div className="text-xs text-gray-500">Всего заказов</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{totals.totalAmount.toLocaleString('ru-RU')} грн</div>
              <div className="text-xs text-gray-500">Общая выручка</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{totals.totalDelivery.toLocaleString('ru-RU')} грн</div>
              <div className="text-xs text-gray-500">Стоимость доставки</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{totals.totalCourierPayment.toLocaleString('ru-RU')} грн</div>
              <div className="text-xs text-gray-500">Оплата курьерам</div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-900">Доставка</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xl font-bold text-blue-900">{totals.deliveryCount}</div>
                    <div className="text-xs text-blue-700">заказов</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-blue-900">{totals.deliveryAmount.toLocaleString('ru-RU')} грн</div>
                    <div className="text-xs text-blue-700">выручка</div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-900">Самовынос</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xl font-bold text-green-900">{totals.pickupCount}</div>
                    <div className="text-xs text-green-700">заказов</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-green-900">{totals.pickupAmount.toLocaleString('ru-RU')} грн</div>
                    <div className="text-xs text-green-700">выручка</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden relative z-10">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Загрузка...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Нет заказов за выбранный период
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th
                    onClick={() => handleSort('order_number')}
                    className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      N
                      {sortField === 'order_number' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Тип</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Филиал</th>
                  <th
                    onClick={() => handleSort('created_at')}
                    className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      Создан
                      {sortField === 'created_at' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('completed_at')}
                    className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      {activeTab === 'completed' ? 'Завершен' : 'Удален'}
                      {sortField === 'completed_at' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Клиент</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Адрес</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Сумма</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Оплата</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Исполнитель</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Доставка</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Курьеру</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Плательщик</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Время</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Задержка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(order => {
                  const { deliveryPrice, courierPayment, zoneName } = getDeliveryPriceAndCourierPayment(order);
                  const executorName = getExecutorName(order);
                  const isExpanded = expandedOrderId === order.id;

                  return (
                    <>
                      <tr key={order.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={(e) => toggleOrderExpand(order.id, e)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-600" />
                            )}
                            <span className="font-mono font-semibold text-blue-600">#{order.order_number}</span>
                          </div>
                        </td>
                      <td className="px-4 py-3">
                        {order.delivery_type === 'delivery' ? (
                          <div className="flex items-center gap-1">
                            <Truck className="w-4 h-4 text-blue-600" />
                            <span className="text-xs text-blue-700 font-medium">Доставка</span>
                          </div>
                        ) : order.delivery_type === 'pickup' ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="w-4 h-4 text-green-600" />
                            <span className="text-xs text-green-700 font-medium">Самовынос</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-700">{order.branch?.name || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {formatDateTime(order.created_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {formatDateTime(order.completed_at || order.archived_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-700">{order.client_name || '-'}</span>
                        </div>
                        {order.phone && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <Phone className="w-3 h-3" />
                            {order.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-start gap-1">
                          <MapPin className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 text-xs truncate" title={order.delivery_address || order.address_line || ''}>
                            {order.delivery_address || order.address_line || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-gray-900">{order.total_amount?.toLocaleString('ru-RU') || '-'}</span>
                        <span className="text-gray-500 text-xs ml-1">грн</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-700 text-xs">{order.payment_method?.name || '-'}</span>
                        </div>
                        {order.payment_method?.method_type === 'cashless' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {order.payment_status === 'paid' ? 'Оплачен' : 'Не оплачен'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {order.delivery_type === 'delivery' && (order.executor_type || order.courier_id) ? (
                          <>
                            <div className="flex items-center gap-1">
                              <Truck className="w-3 h-3 text-gray-400" />
                              <span className="text-gray-700 text-xs">{executorName}</span>
                            </div>
                            {order.executor_type && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                order.executor_type === 'courier' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                              }`}>
                                {order.executor_type === 'courier' ? 'Курьер' : 'Исполнитель'}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {deliveryPrice !== null ? (
                          <>
                            <span className="font-semibold text-blue-600">{deliveryPrice.toLocaleString('ru-RU')}</span>
                            <span className="text-gray-500 text-xs ml-1">грн</span>
                          </>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {courierPayment !== null ? (
                          <div className="flex flex-col items-end">
                            <div>
                              <span className="font-semibold text-green-600">{courierPayment.toLocaleString('ru-RU')}</span>
                              <span className="text-gray-500 text-xs ml-1">грн</span>
                            </div>
                            {zoneName && (
                              <span className="text-xs text-gray-400">{zoneName}</span>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {order.delivery_type === 'delivery' && (order.executor_type || order.courier_id) ? (
                          <span className={`text-xs px-2 py-1 rounded ${
                            order.delivery_payer === 'restaurant' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {order.delivery_payer === 'restaurant' ? 'Ресторан' : 'Клиент'}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatMinutes(order.accumulated_time_minutes)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {order.accumulated_delay_minutes && order.accumulated_delay_minutes > 0 ? (
                          <span className="text-red-600 font-medium">{formatMinutes(order.accumulated_delay_minutes)}</span>
                        ) : (
                          <span className="text-green-600">-</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && orderItems[order.id] && (
                      <tr key={`${order.id}-details`} className="bg-gray-50">
                        <td colSpan={14} className="px-4 py-4">
                          <div className="bg-white rounded-lg border border-gray-200 p-4 max-w-2xl">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <Package className="w-4 h-4" />
                              Состав заказа:
                            </h4>
                            <div className="space-y-3">
                              {orderItems[order.id].map((item) => (
                                <div key={item.id} className="pb-3 border-b border-gray-200 last:border-0 last:pb-0">
                                  <div className="flex justify-between items-start mb-1">
                                    <div className="flex-1">
                                      <span className="font-medium text-gray-900 text-sm">
                                        {item.product_name}
                                      </span>
                                      <span className="text-gray-600 ml-2 text-sm">×{item.quantity}</span>
                                    </div>
                                    <span className="font-semibold text-gray-900 ml-4 text-sm">
                                      {(item.price * item.quantity).toFixed(2)} грн
                                    </span>
                                  </div>
                                  {item.modifiers && item.modifiers.length > 0 && (
                                    <div className="ml-4 mt-2 space-y-1">
                                      {item.modifiers.map((modifier, idx) => (
                                        <div key={idx} className="flex justify-between text-xs text-gray-600">
                                          <span>+ {modifier.modifier_name}</span>
                                          <span>{modifier.price.toFixed(2)} грн</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <HistorySettingsModal
        partnerId={partnerId}
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSettingsUpdated={() => loadOrders()}
      />
    </div>
  );
}
