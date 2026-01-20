import { X, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Package, History, Clock, ChevronDown, ChevronRight, MapPin, Calendar, Heart, User, ShoppingBag, Trash2, RotateCcw, Pencil, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface RepeatOrderItem {
  product_poster_id: number;
  product_name: string;
  base_price: number;
  quantity: number;
  modifiers: Array<{
    modifier_poster_id: number;
    modifier_name: string;
    price: number;
  }>;
}

interface Props {
  isOpen: boolean;
  phone: string | null;
  clientId: string | null;
  clientName: string | null;
  branchId: string | null;
  generalCallId: string | null;
  partnerId: string;
  onClose: () => void;
  onCreateOrder: (phone: string, branchId: string | null, sourceCallId: string | null) => void;
  onRepeatOrder?: (phone: string, branchId: string | null, items: RepeatOrderItem[]) => void;
  onEditOrder?: (orderId: string) => void;
}

interface ClientDetails {
  id: string;
  phone: string;
  first_name: string;
  last_name: string;
  total_orders: number;
  total_spent: number;
  last_order_date: string | null;
  birthday: string | null;
  notes: string;
  favorite_dishes: Array<{ name: string; count: number }>;
  created_at: string;
  additional_phones: string[];
}

interface ClientAddress {
  id: string;
  address_text: string;
  floor: string | null;
  apartment: string | null;
  entrance: string | null;
  intercom: string | null;
  office: string | null;
  deliveries_count: number;
  last_delivery_date: string | null;
}

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  phone?: string | null;
  client_id?: string | null;
  is_archived?: boolean;
  accepted_at?: string | null;
  accumulated_time_minutes?: number | null;
}

interface OrderItem {
  id: string;
  product_poster_id: number;
  product_name: string;
  base_price: number;
  quantity: number;
  price: number;
  modifiers: Array<{
    modifier_poster_id?: number;
    modifier_name: string;
    price: number;
  }>;
}

interface CallHistoryItem {
  id: string;
  call_type: number;
  call_status: string | null;
  is_missed: boolean;
  is_outgoing: boolean;
  created_at: string;
  billsec: number | null;
  external_number?: string;
}

type TabType = 'info' | 'active' | 'orders' | 'calls' | 'addresses';

export default function ClientDrawer({
  isOpen,
  phone,
  clientId,
  clientName,
  branchId,
  generalCallId,
  partnerId,
  onClose,
  onCreateOrder,
  onRepeatOrder,
  onEditOrder,
}: Props) {
  const [clientDetails, setClientDetails] = useState<ClientDetails | null>(null);
  const [clientAddresses, setClientAddresses] = useState<ClientAddress[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});

  useEffect(() => {
    if (isOpen && (clientId || phone)) {
      fetchClientData();
    }
  }, [isOpen, clientId, phone]);

  const normalizePhone = (p: string): string => {
    const digits = p.replace(/\D/g, '');
    if (digits.startsWith('380')) return digits;
    if (digits.startsWith('0')) return '38' + digits;
    return digits;
  };

  const fetchClientData = async () => {
    if (!clientId && !phone) return;

    let client = null;
    let effectiveClientId = clientId;
    const normalizedInputPhone = phone ? normalizePhone(phone) : null;

    if (clientId) {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();
      client = data;
      if (client) {
        setClientDetails(client);
      }
    } else if (normalizedInputPhone) {
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .eq('partner_id', partnerId);

      if (clients) {
        client = clients.find(c => normalizePhone(c.phone) === normalizedInputPhone) || null;
        if (client) {
          setClientDetails(client);
          effectiveClientId = client.id;
        }
      }
    }

    const clientPhone = phone || client?.phone;
    if (!clientPhone) return;
    const normalizedPhone = normalizePhone(clientPhone);

    if (effectiveClientId) {
      const { data: addresses } = await supabase
        .from('client_addresses')
        .select('*')
        .eq('client_id', effectiveClientId)
        .order('deliveries_count', { ascending: false });

      if (addresses) {
        setClientAddresses(addresses);
      }
    }

    const last9Digits = normalizedPhone.slice(-9);

    const matchesPhone = (orderPhone: string | null): boolean => {
      if (!orderPhone) return false;
      const normalizedOrderPhone = orderPhone.replace(/\D/g, '');
      return normalizedOrderPhone.slice(-9) === last9Digits;
    };

    const { data: activeOrdersRaw } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, status, created_at, phone, client_id, accepted_at, accumulated_time_minutes')
      .eq('partner_id', partnerId)
      .neq('status', 'completed')
      .order('created_at', { ascending: false });

    const activeOrdersFiltered = (activeOrdersRaw || []).filter(o =>
      (effectiveClientId && o.client_id === effectiveClientId) || matchesPhone(o.phone)
    );

    if (activeOrdersFiltered.length > 0) {
      setActiveOrders(activeOrdersFiltered);
      setActiveTab('active');
    } else {
      setActiveOrders([]);
    }

    let ordersQuery = supabase
      .from('orders')
      .select('id, order_number, total_amount, status, created_at, phone, client_id, accepted_at, accumulated_time_minutes')
      .eq('partner_id', partnerId);

    const { data: ordersRaw } = await ordersQuery
      .order('created_at', { ascending: false })
      .limit(200);

    const ordersFiltered = (ordersRaw || []).filter(o =>
      (effectiveClientId && o.client_id === effectiveClientId) || matchesPhone(o.phone)
    ).slice(0, 50);

    let archivedQuery = supabase
      .from('archived_orders')
      .select('id, order_number, total_amount, status, created_at, phone, client_id, accepted_at, accumulated_time_minutes')
      .eq('partner_id', partnerId);

    const { data: archivedRaw } = await archivedQuery
      .order('created_at', { ascending: false })
      .limit(200);

    const archivedFiltered = (archivedRaw || []).filter(o =>
      (effectiveClientId && o.client_id === effectiveClientId) || matchesPhone(o.phone)
    ).slice(0, 50);

    const activeOrdersWithFlag = ordersFiltered.map(o => ({ ...o, is_archived: false }));
    const archivedOrdersWithFlag = archivedFiltered.map(o => ({ ...o, is_archived: true }));

    const allOrders = [...activeOrdersWithFlag, ...archivedOrdersWithFlag]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    setOrders(allOrders);

    const { data: callsRaw } = await supabase
      .from('binotel_calls')
      .select('id, call_type, call_status, is_missed, is_outgoing, created_at, billsec, external_number, client_id')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(200);

    const callsFiltered = (callsRaw || []).filter(c =>
      (effectiveClientId && c.client_id === effectiveClientId) || matchesPhone(c.external_number)
    ).slice(0, 50);

    const callsData = callsFiltered;

    if (callsData) {
      setCallHistory(callsData);
    }
  };

  useEffect(() => {
    if (isOpen && activeOrders.length > 0) {
      setActiveTab('active');
    }
  }, [isOpen, activeOrders.length]);

  const fetchOrderItems = async (orderId: string, isArchived: boolean = false) => {
    if (orderItems[orderId]) {
      return;
    }

    const { data } = await supabase
      .from('order_items')
      .select('id, product_poster_id, product_name, quantity, total_price, base_price, modifiers')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (data && data.length > 0) {
      const formattedData = data.map(item => ({
        id: item.id,
        product_poster_id: item.product_poster_id,
        product_name: item.product_name,
        base_price: item.base_price || 0,
        quantity: item.quantity,
        price: item.total_price / item.quantity,
        modifiers: Array.isArray(item.modifiers) ? item.modifiers.map((m: any) => ({
          modifier_poster_id: m.modifier_poster_id || m.id,
          modifier_name: m.name || m.modifier_name,
          price: m.price || 0
        })) : []
      }));
      setOrderItems(prev => ({ ...prev, [orderId]: formattedData }));
    } else if (isArchived) {
      const { data: historyData } = await supabase
        .from('client_orders_history')
        .select('order_data')
        .eq('order_id', orderId)
        .maybeSingle();

      if (historyData?.order_data?.items) {
        const items = historyData.order_data.items;
        const formattedData = items.map((item: any, idx: number) => ({
          id: `history-${idx}`,
          product_poster_id: item.product_poster_id || item.poster_product_id || 0,
          product_name: item.product_name || item.name,
          base_price: item.base_price || item.price || 0,
          quantity: item.quantity || 1,
          price: item.total_price || item.price || 0,
          modifiers: Array.isArray(item.modifiers) ? item.modifiers.map((m: any) => ({
            modifier_poster_id: m.modifier_poster_id || m.id,
            modifier_name: m.name || m.modifier_name,
            price: m.price || 0
          })) : []
        }));
        setOrderItems(prev => ({ ...prev, [orderId]: formattedData }));
      }
    }
  };

  const toggleOrderExpand = async (orderId: string, isArchived: boolean = false) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(orderId);
      await fetchOrderItems(orderId, isArchived);
    }
  };

  const handleRepeatOrder = (orderId: string) => {
    if (!phone || !onRepeatOrder) return;

    const items = orderItems[orderId];
    if (!items || items.length === 0) return;

    const repeatItems: RepeatOrderItem[] = items.map(item => ({
      product_poster_id: item.product_poster_id,
      product_name: item.product_name,
      base_price: item.base_price,
      quantity: item.quantity,
      modifiers: item.modifiers.map(m => ({
        modifier_poster_id: m.modifier_poster_id || 0,
        modifier_name: m.modifier_name,
        price: m.price
      }))
    }));

    onRepeatOrder(phone, branchId, repeatItems);
    onClose();
  };

  const callStats = {
    missed: callHistory.filter(c => c.is_missed).length,
    incoming: callHistory.filter(c => !c.is_outgoing && !c.is_missed).length,
    outgoing: callHistory.filter(c => c.is_outgoing).length,
    total: callHistory.length,
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      new: 'Новый',
      accepted: 'Принят',
      preparing: 'Готовится',
      ready: 'Готов',
      on_the_way: 'В пути',
      en_route: 'Курьер выехал',
      completed: 'Завершен',
      cancelled: 'Отменен',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      preparing: 'bg-yellow-100 text-yellow-800',
      ready: 'bg-orange-100 text-orange-800',
      on_the_way: 'bg-purple-100 text-purple-800',
      en_route: 'bg-purple-100 text-purple-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCallIcon = (call: CallHistoryItem) => {
    if (call.is_missed) return <PhoneMissed className="w-4 h-4 text-red-500" />;
    if (call.is_outgoing) return <PhoneOutgoing className="w-4 h-4 text-blue-500" />;
    return <PhoneIncoming className="w-4 h-4 text-green-500" />;
  };

  const getCallLabel = (call: CallHistoryItem) => {
    if (call.is_missed) return 'Пропущенный';
    if (call.is_outgoing) return 'Исходящий';
    return 'Входящий';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Никогда';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(2)} ₴`;
  };

  const handleDeleteClient = async () => {
    if (!clientId) return;

    const confirmed = window.confirm(
      'Вы уверены, что хотите удалить этого клиента? Эта операция необратима. Будут удалены все связанные данные (адреса, история заказов).'
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (error) throw error;

      alert('Клиент успешно удален');
      onClose();
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Ошибка при удалении клиента');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed left-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col">
        <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-lg font-bold">
                {clientDetails?.first_name?.[0] || clientName?.[0] || '?'}
                {clientDetails?.last_name?.[0] || ''}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {clientDetails ? `${clientDetails.first_name || ''} ${clientDetails.last_name || ''}`.trim() || 'Без имени' : clientName || 'Новый клиент'}
                </h2>
                <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3" />
                  {phone}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {clientId && (
                <button
                  onClick={handleDeleteClient}
                  className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                  title="Удалить клиента"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
          {clientDetails && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="bg-white rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-blue-600">{clientDetails.total_orders}</div>
                <div className="text-xs text-gray-600">Заказов</div>
              </div>
              <div className="bg-white rounded-lg p-2 text-center col-span-2">
                <div className="text-lg font-bold text-green-600">{formatCurrency(clientDetails.total_spent)}</div>
                <div className="text-xs text-gray-600">На сумму</div>
              </div>
            </div>
          )}
        </div>

        {(clientId || phone) && (
          <div className="border-b bg-white overflow-x-auto">
            <div className="flex">
              <button
                onClick={() => setActiveTab('info')}
                className={`flex-1 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'info'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  Инфо
                </div>
              </button>
              {clientId && (
                <button
                  onClick={() => setActiveTab('addresses')}
                  className={`flex-1 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'addresses'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    Адреса ({clientAddresses.length})
                  </div>
                </button>
              )}
              <button
                onClick={() => setActiveTab('active')}
                className={`flex-1 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'active'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Активные
                  {activeOrders.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded-full text-xs">
                      {activeOrders.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex-1 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'orders'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <History className="w-3.5 h-3.5" />
                  История
                </div>
              </button>
              <button
                onClick={() => setActiveTab('calls')}
                className={`flex-1 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'calls'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  Звонки
                </div>
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {(clientId || phone) ? (
            <>
              {activeTab === 'info' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Контактная информация</h3>
                    <div className="space-y-3 bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-gray-900">{clientDetails?.phone || phone}</span>
                      </div>
                      {clientDetails?.additional_phones?.length > 0 && clientDetails.additional_phones.map((phone, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm pl-6">
                          <span className="text-gray-700">{phone}</span>
                        </div>
                      ))}
                      {clientDetails?.birthday && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-700">{formatDate(clientDetails.birthday)}</span>
                        </div>
                      )}
                      {clientDetails?.created_at && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-700">Клиент с {formatDate(clientDetails.created_at)}</span>
                        </div>
                      )}
                      {!clientDetails && (
                        <div className="text-xs text-gray-500 italic">
                          Новый клиент
                        </div>
                      )}
                    </div>
                  </div>

                  {clientDetails?.notes && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Заметки</h3>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-sm text-amber-900">{clientDetails.notes}</p>
                      </div>
                    </div>
                  )}

                  {clientDetails?.favorite_dishes?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-red-500" />
                        Любимые блюда
                      </h3>
                      <div className="space-y-2">
                        {clientDetails.favorite_dishes.slice(0, 5).map((dish, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-lg"
                          >
                            <span className="text-sm font-medium text-gray-900">{dish.name}</span>
                            <span className="text-xs text-orange-600 font-semibold">{dish.count}x</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'addresses' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Адреса доставки
                  </h3>
                  {clientAddresses.length === 0 ? (
                    <div className="text-center py-8">
                      <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Адресов пока нет</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {clientAddresses.map((address) => (
                        <div
                          key={address.id}
                          className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{address.address_text}</p>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {address.apartment && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Кв. {address.apartment}</span>}
                                {address.floor && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Эт. {address.floor}</span>}
                                {address.entrance && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Под. {address.entrance}</span>}
                                {address.intercom && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Дом: {address.intercom}</span>}
                                {address.office && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Офис {address.office}</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                <span>Доставок: {address.deliveries_count}</span>
                                {address.last_delivery_date && (
                                  <span>Последняя: {formatDate(address.last_delivery_date)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'active' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Активные заказы
                  </h3>
                  {activeOrders.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Нет активных заказов</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeOrders.map((order) => {
                        const getExecutionTime = () => {
                          if (!order.accepted_at) return null;
                          const acceptedTime = new Date(order.accepted_at).getTime();
                          const now = Date.now();
                          const runningMinutes = Math.floor((now - acceptedTime) / 60000);
                          const totalMinutes = (order.accumulated_time_minutes || 0) + runningMinutes;
                          return totalMinutes;
                        };
                        const executionTime = getExecutionTime();

                        return (
                          <div key={order.id} className="bg-blue-50 rounded-lg border border-blue-200 overflow-hidden">
                            <div
                              className="p-4 cursor-pointer hover:bg-blue-100 transition-colors"
                              onClick={() => toggleOrderExpand(order.id)}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  {expandedOrderId === order.id ? (
                                    <ChevronDown className="w-4 h-4 text-gray-600" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-600" />
                                  )}
                                  <span className="text-sm font-semibold text-gray-900">
                                    Заказ #{order.order_number}
                                  </span>
                                </div>
                                <span className="text-sm font-bold text-gray-900">
                                  {order.total_amount.toFixed(2)} ₴
                                </span>
                              </div>
                              <div className="flex justify-between items-center mb-2">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(order.status)}`}>
                                  {getStatusLabel(order.status)}
                                </span>
                                <span className="text-xs text-gray-600">
                                  {new Date(order.created_at).toLocaleString('ru', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              {executionTime !== null && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                  <Timer className="w-3.5 h-3.5" />
                                  <span>Время выполнения: {executionTime} мин</span>
                                </div>
                              )}
                            </div>

                            {expandedOrderId === order.id && orderItems[order.id] && (
                              <div className="px-4 pb-4 border-t border-blue-200 bg-white">
                                <div className="pt-3 space-y-2">
                                  <h4 className="text-xs font-semibold text-gray-700 mb-2">Состав заказа:</h4>
                                  {orderItems[order.id].map((item) => (
                                    <div key={item.id} className="text-sm">
                                      <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                          <span className="font-medium text-gray-900">
                                            {item.product_name}
                                          </span>
                                          <span className="text-gray-600 ml-2">x{item.quantity}</span>
                                        </div>
                                        <span className="font-semibold text-gray-900 ml-2">
                                          {(item.price * item.quantity).toFixed(2)} ₴
                                        </span>
                                      </div>
                                      {item.modifiers && item.modifiers.length > 0 && (
                                        <div className="ml-4 mt-1 space-y-1">
                                          {item.modifiers.map((modifier, idx) => (
                                            <div key={idx} className="flex justify-between text-xs text-gray-600">
                                              <span>+ {modifier.modifier_name}</span>
                                              <span>{modifier.price.toFixed(2)} ₴</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                {onEditOrder && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditOrder(order.id);
                                    }}
                                    className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                  >
                                    <Pencil className="w-4 h-4" />
                                    Редактировать заказ
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'orders' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    История заказов
                  </h3>
                  {orders.filter(o => o.status === 'completed').length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Нет заказов</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orders.filter(o => o.status === 'completed').map((order) => (
                        <div key={order.id} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                          <div
                            className="p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => toggleOrderExpand(order.id, order.is_archived)}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-2">
                                {expandedOrderId === order.id ? (
                                  <ChevronDown className="w-4 h-4 text-gray-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-600" />
                                )}
                                <span className="text-sm font-medium text-gray-900">
                                  #{order.order_number}
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-gray-900">
                                {order.total_amount.toFixed(2)} ₴
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(order.status)}`}>
                                {getStatusLabel(order.status)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(order.created_at).toLocaleDateString('ru')}
                              </span>
                            </div>
                          </div>

                          {expandedOrderId === order.id && orderItems[order.id] && (
                            <div className="px-3 pb-3 border-t border-gray-200 bg-white">
                              <div className="pt-2 space-y-2">
                                <h4 className="text-xs font-semibold text-gray-700 mb-2">Состав заказа:</h4>
                                {orderItems[order.id].map((item) => (
                                  <div key={item.id} className="text-sm">
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <span className="font-medium text-gray-900">
                                          {item.product_name}
                                        </span>
                                        <span className="text-gray-600 ml-2">x{item.quantity}</span>
                                      </div>
                                      <span className="font-semibold text-gray-900 ml-2">
                                        {(item.price * item.quantity).toFixed(2)} ₴
                                      </span>
                                    </div>
                                    {item.modifiers && item.modifiers.length > 0 && (
                                      <div className="ml-4 mt-1 space-y-1">
                                        {item.modifiers.map((modifier, idx) => (
                                          <div key={idx} className="flex justify-between text-xs text-gray-600">
                                            <span>+ {modifier.modifier_name}</span>
                                            <span>{modifier.price.toFixed(2)} ₴</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {onRepeatOrder && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRepeatOrder(order.id);
                                  }}
                                  className="mt-3 w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                  Повторить заказ
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'calls' && (
                <div>
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center gap-2 mb-1">
                        <PhoneMissed className="w-4 h-4 text-red-600" />
                        <span className="text-xs font-medium text-red-900">Пропущенные</span>
                      </div>
                      <div className="text-xl font-bold text-red-700">{callStats.missed}</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-1">
                        <PhoneIncoming className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-medium text-green-900">Входящие</span>
                      </div>
                      <div className="text-xl font-bold text-green-700">{callStats.incoming}</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <PhoneOutgoing className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-medium text-blue-900">Исходящие</span>
                      </div>
                      <div className="text-xl font-bold text-blue-700">{callStats.outgoing}</div>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    История звонков ({callStats.total})
                  </h3>
                  {callHistory.length === 0 ? (
                    <div className="text-center py-8">
                      <Phone className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Нет звонков</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {callHistory.map((call) => (
                        <div
                          key={call.id}
                          className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {getCallIcon(call)}
                              <span className="text-sm font-medium text-gray-900">
                                {getCallLabel(call)}
                              </span>
                            </div>
                            <span className="text-xs text-gray-600">
                              {formatDuration(call.billsec)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">
                              {call.call_status || 'В процессе'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(call.created_at).toLocaleString('ru', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">Информация о клиенте недоступна</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={() => {
              if (phone) {
                onCreateOrder(phone, branchId, generalCallId);
                onClose();
              }
            }}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Создать заказ
          </button>
        </div>
      </div>
    </>
  );
}
