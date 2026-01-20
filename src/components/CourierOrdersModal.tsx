import { useState, useEffect } from 'react';
import { X, Package, MapPin, DollarSign, Calendar, User, Phone, Clock, Navigation, ChevronDown, ChevronUp, ArrowRight, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface OrderItem {
  product_name: string;
  quantity: number;
  base_price: number;
  total_price: number;
  modifiers?: any;
}

interface Order {
  id: string;
  order_number: string;
  shift_order_number: string | null;
  phone: string | null;
  address: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  total_amount: number | null;
  delivery_price_uah: number | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
  completed_at?: string | null;
  accumulated_time_minutes: number | null;
  distance_km: number | null;
  payment_method_id: string | null;
  branch?: {
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  client?: { first_name: string | null; last_name: string | null } | null;
  zone?: { courier_payment: number | null; name: string } | null;
  distance_price_uah?: number | null;
  rounded_distance_km?: number | null;
  payment_method?: { name: string } | null;
  items?: OrderItem[];
}

interface OrderExecutor {
  id: string;
  order_id: string;
  courier_id: string;
  created_at: string;
  orders?: Order;
}

interface CourierOrdersModalProps {
  courierId: string;
  courierName: string;
  onClose: () => void;
}

type StatusFilter = 'assigned' | 'en_route' | 'completed';

export default function CourierOrdersModal({ courierId, courierName, onClose }: CourierOrdersModalProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('assigned');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, [courierId]);

  const loadOrders = async () => {
    setLoading(true);
    setError('');

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
            accepted_at,
            completed_at,
            accumulated_time_minutes,
            distance_km,
            payment_method_id,
            branch:branches!orders_branch_id_fkey(name, address, latitude, longitude),
            client:clients!orders_client_id_fkey(first_name, last_name),
            payment_method:payment_methods!orders_payment_method_id_fkey(name)
          )
        `)
        .eq('courier_id', courierId)
        .order('created_at', { ascending: false });

      if (executorError) throw executorError;

      const formattedOrders: Order[] = [];
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
              order_number: order.order_number,
              shift_order_number: order.shift_order_number,
              phone: order.phone,
              address: order.address,
              delivery_address: order.address_line,
              delivery_lat: order.delivery_lat,
              delivery_lng: order.delivery_lng,
              total_amount: order.total_amount,
              delivery_price_uah: order.delivery_price_uah,
              status: order.status,
              created_at: order.created_at,
              accepted_at: executor.created_at,
              completed_at: order.completed_at,
              accumulated_time_minutes: order.accumulated_time_minutes,
              distance_km: order.distance_km,
              payment_method_id: order.payment_method_id,
              branch: order.branch,
              client: order.client,
              zone: executor.zone,
              distance_price_uah: executor.distance_price_uah,
              rounded_distance_km: executor.rounded_distance_km,
              payment_method: order.payment_method,
              items: items || [],
            });
          }
        }
      }

      setOrders(formattedOrders);
    } catch (err) {
      console.error('Error loading courier orders:', err);
      setError('Ошибка загрузки заказов');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; color: string }> = {
      new: { text: 'Новый', color: 'bg-blue-100 text-blue-700' },
      accepted: { text: 'Принят', color: 'bg-yellow-100 text-yellow-700' },
      preparing: { text: 'Готовится', color: 'bg-orange-100 text-orange-700' },
      ready: { text: 'Готов', color: 'bg-green-100 text-green-700' },
      en_route: { text: 'В пути', color: 'bg-blue-100 text-blue-700' },
      in_progress: { text: 'В работе', color: 'bg-cyan-100 text-cyan-700' },
      completed: { text: 'Выполнен', color: 'bg-green-100 text-green-700' },
      cancelled: { text: 'Отменен', color: 'bg-red-100 text-red-700' },
    };

    const status_info = statusMap[status] || { text: status, color: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${status_info.color}`}>
        {status_info.text}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getClientName = (order: Order) => {
    if (order.client?.first_name || order.client?.last_name) {
      return [order.client.first_name, order.client.last_name].filter(Boolean).join(' ');
    }
    return 'Не указан';
  };

  const formatTime = (minutes: number | null) => {
    if (!minutes) return '0:00';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
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

  const openNavigation = (lat: number, lng: number, label: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      await loadOrders();
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Ошибка при обновлении статуса заказа');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (statusFilter === 'assigned') {
      return order.status === 'in_progress';
    }
    if (statusFilter === 'en_route') {
      return order.status === 'en_route';
    }
    if (statusFilter === 'completed') {
      return order.status === 'completed';
    }
    return true;
  });

  const totalTime = filteredOrders.reduce((sum, order) => {
    return sum + (order.accumulated_time_minutes || 0);
  }, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Заказы курьера</h3>
              <p className="text-sm text-gray-500 mt-1">{courierName}</p>
              {filteredOrders.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-600">
                    Общее время: {formatTime(totalTime)}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({filteredOrders.length} {filteredOrders.length === 1 ? 'заказ' : filteredOrders.length < 5 ? 'заказа' : 'заказов'})
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('assigned')}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                statusFilter === 'assigned'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Назначенные
            </button>
            <button
              onClick={() => setStatusFilter('en_route')}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                statusFilter === 'en_route'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              В дороге
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                statusFilter === 'completed'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Выполненные
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {!loading && !error && filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {statusFilter === 'assigned' && 'Нет назначенных заказов'}
                {statusFilter === 'en_route' && 'Нет заказов в дороге'}
                {statusFilter === 'completed' && 'Нет выполненных заказов'}
              </p>
            </div>
          )}

          {!loading && !error && filteredOrders.length > 0 && (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrders.has(order.id);
                const courierPayment = order.zone?.courier_payment ? Number(order.zone.courier_payment) : 0;
                const distancePayment = order.distance_price_uah ? Number(order.distance_price_uah) : 0;
                const totalDelivery = courierPayment + distancePayment;

                return (
                  <div
                    key={order.id}
                    className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                  >
                    <div
                      onClick={() => toggleOrderExpansion(order.id)}
                      className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-gray-900">
                            #{order.shift_order_number || order.order_number}
                          </span>
                          {getStatusBadge(order.status)}
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openNavigation(order.branch!.latitude!, order.branch!.longitude!, order.branch!.name);
                                }}
                                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                              >
                                <Navigation className="w-4 h-4" />
                              </button>
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openNavigation(order.delivery_lat!, order.delivery_lng!, 'Адрес доставки');
                                }}
                                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex-shrink-0"
                              >
                                <Navigation className="w-4 h-4" />
                              </button>
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

                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Сумма заказа</div>
                          <div className="text-2xl font-bold text-gray-900">
                            {order.total_amount?.toFixed(2)} ₴
                          </div>
                          {order.payment_method?.name && (
                            <div className="text-xs text-gray-500 mt-1">
                              {order.payment_method.name === 'Безналичный счет' ? 'Оплачено' : order.payment_method.name}
                            </div>
                          )}
                        </div>

                        {(courierPayment > 0 || distancePayment > 0) && (
                          <div className="text-right">
                            <div className="text-sm text-gray-600 mb-1">Доставка</div>
                            <div className="text-lg font-bold text-green-600">
                              {totalDelivery.toFixed(2)} ₴
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {courierPayment > 0 && distancePayment > 0 ? (
                                <div>{courierPayment} + {distancePayment} км</div>
                              ) : courierPayment > 0 ? (
                                <div>Зона: {courierPayment}</div>
                              ) : (
                                <div>Км: {distancePayment}</div>
                              )}
                            </div>
                          </div>
                        )}
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
                              <div className="font-semibold text-gray-900">{item.total_price.toFixed(2)} ₴</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {order.status === 'in_progress' && (
                      <div className="p-4 bg-gray-50 border-t border-gray-200">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateOrderStatus(order.id, 'en_route');
                          }}
                          disabled={updatingStatus === order.id}
                          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {updatingStatus === order.id ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                              Обновление...
                            </>
                          ) : (
                            <>
                              <Navigation className="w-5 h-5" />
                              Выехал
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {order.status === 'en_route' && (
                      <div className="p-4 bg-gray-50 border-t border-gray-200">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateOrderStatus(order.id, 'completed');
                          }}
                          disabled={updatingStatus === order.id}
                          className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {updatingStatus === order.id ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                              Обновление...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-5 h-5" />
                              Отдал
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
