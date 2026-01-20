import { X, Phone, Calendar, ShoppingBag, MapPin, Clock, Heart } from 'lucide-react';

interface Client {
  id: string;
  phone: string;
  first_name: string;
  last_name: string;
  birthday: string | null;
  total_orders: number;
  total_spent: number;
  favorite_dishes: Array<{ name: string; count: number }>;
  additional_phones?: string[];
  notes?: string;
  created_at: string;
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

interface OrderHistory {
  id: string;
  order_number: string;
  order_data: any;
  total_amount: number;
  created_at: string;
}

interface ClientDetailsModalProps {
  client: Client;
  addresses: ClientAddress[];
  orderHistory: OrderHistory[];
  onClose: () => void;
}

export default function ClientDetailsModal({
  client,
  addresses,
  orderHistory,
  onClose
}: ClientDetailsModalProps) {
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Карточка клиента</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                    {client.first_name?.[0] || '?'}{client.last_name?.[0] || ''}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {client.first_name || 'Без имени'} {client.last_name || ''}
                    </h2>
                    <p className="text-gray-500 text-sm">
                      Клиент с {formatDate(client.created_at)}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-gray-700">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span className="font-medium">{client.phone}</span>
                  </div>
                  {client.additional_phones?.length > 0 && client.additional_phones.map((phone, i) => (
                    <div key={i} className="flex items-center gap-3 text-gray-700 pl-8">
                      <span className="text-sm">{phone}</span>
                    </div>
                  ))}
                  {client.birthday && (
                    <div className="flex items-center gap-3 text-gray-700">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <span>{formatDate(client.birthday)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-xl">
                    <div className="text-3xl font-bold text-blue-600">{client.total_orders}</div>
                    <div className="text-sm text-gray-600">Заказов</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-xl">
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(client.total_spent)}</div>
                    <div className="text-sm text-gray-600">Сумма</div>
                  </div>
                </div>

                {client.notes && (
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <h3 className="text-sm font-semibold text-amber-900 mb-1">Заметки</h3>
                    <p className="text-sm text-amber-800">{client.notes}</p>
                  </div>
                )}
              </div>

              {client.favorite_dishes?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-red-500" />
                    Любимые блюда
                  </h3>
                  <div className="space-y-3">
                    {client.favorite_dishes.slice(0, 8).map((dish, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-lg"
                      >
                        <span className="font-medium text-gray-900">{dish.name}</span>
                        <span className="text-sm text-orange-600 font-semibold">{dish.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Адреса доставки
                  <span className="text-sm font-normal text-gray-500">({addresses.length})</span>
                </h3>
                {addresses.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Адресов пока нет</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((address) => (
                      <div
                        key={address.id}
                        className="p-4 border border-gray-200 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">{address.address_text}</p>
                            <div className="flex flex-wrap gap-2 mt-2 text-sm text-gray-600">
                              {address.apartment && <span className="bg-gray-100 px-2 py-0.5 rounded">Кв. {address.apartment}</span>}
                              {address.floor && <span className="bg-gray-100 px-2 py-0.5 rounded">Этаж {address.floor}</span>}
                              {address.entrance && <span className="bg-gray-100 px-2 py-0.5 rounded">Подъезд {address.entrance}</span>}
                              {address.intercom && <span className="bg-gray-100 px-2 py-0.5 rounded">Домофон: {address.intercom}</span>}
                              {address.office && <span className="bg-gray-100 px-2 py-0.5 rounded">Офис {address.office}</span>}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
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

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-green-600" />
                  История заказов
                  <span className="text-sm font-normal text-gray-500">({orderHistory.length})</span>
                </h3>
                {orderHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Заказов пока нет</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {orderHistory.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 border border-gray-200 rounded-xl hover:border-green-200 hover:bg-green-50/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {order.order_number ? `#${order.order_number}` : 'Заказ'}
                            </span>
                            <span className="text-sm text-gray-500">
                              {formatDateTime(order.created_at)}
                            </span>
                          </div>
                          <span className="font-bold text-green-600">{formatCurrency(order.total_amount || 0)}</span>
                        </div>
                        {order.order_data?.items && (
                          <div className="text-sm text-gray-600">
                            {order.order_data.items.slice(0, 3).map((item: any, i: number) => (
                              <span key={i}>
                                {item.name || item.product_name}
                                {item.quantity > 1 && ` x${item.quantity}`}
                                {i < Math.min(order.order_data.items.length, 3) - 1 && ', '}
                              </span>
                            ))}
                            {order.order_data.items.length > 3 && (
                              <span className="text-gray-400"> +{order.order_data.items.length - 3} ещё</span>
                            )}
                          </div>
                        )}
                        {order.order_data?.delivery_address && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                            <MapPin className="w-3 h-3" />
                            {order.order_data.delivery_address}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
