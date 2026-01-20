import { useState, useEffect } from 'react';
import { User, MapPin, ShoppingBag, Calendar, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Client {
  id: string;
  phone: string;
  first_name: string;
  last_name: string;
  birthday: string | null;
  total_orders: number;
  total_spent: number;
  favorite_dishes: Array<{ name: string; count: number }>;
}

interface ClientAddress {
  id: string;
  address_text: string;
  floor: string | null;
  apartment: string | null;
  entrance: string | null;
  intercom: string | null;
  office: string | null;
  lat: number | null;
  lng: number | null;
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

interface ClientProfileCardProps {
  phone: string;
  partnerId: string;
  onSelectAddress?: (address: ClientAddress) => void;
  onSelectOrder?: (orderData: any) => void;
  onViewClientDetails?: (client: Client, addresses: ClientAddress[], orderHistory: OrderHistory[]) => void;
}

export default function ClientProfileCard({
  phone,
  partnerId,
  onSelectAddress,
  onSelectOrder,
  onViewClientDetails
}: ClientProfileCardProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [addresses, setAddresses] = useState<ClientAddress[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (phone && phone.length >= 10) {
      loadClientData();
    } else {
      setClient(null);
      setAddresses([]);
      setOrderHistory([]);
      setLoading(false);
    }
  }, [phone, partnerId]);

  const normalizePhone = (phoneStr: string) => {
    return phoneStr.replace(/\D/g, '');
  };

  const loadClientData = async () => {
    try {
      setLoading(true);
      const normalizedPhone = normalizePhone(phone);

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('partner_id', partnerId)
        .eq('phone', normalizedPhone)
        .maybeSingle();

      if (clientError) throw clientError;

      if (clientData) {
        setClient(clientData);

        const { data: addressesData } = await supabase
          .from('client_addresses')
          .select('*')
          .eq('client_id', clientData.id)
          .order('deliveries_count', { ascending: false });

        setAddresses(addressesData || []);

        const { data: historyData } = await supabase
          .from('client_orders_history')
          .select('*')
          .eq('client_id', clientData.id)
          .order('created_at', { ascending: false })
          .limit(5);

        setOrderHistory(historyData || []);
      } else {
        setClient(null);
        setAddresses([]);
        setOrderHistory([]);
      }
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(2)} ₴`;
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Поиск клиента...</span>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2 text-blue-900">
          <User className="w-5 h-5" />
          <span className="font-medium">Новый клиент</span>
        </div>
        <p className="mt-1 text-sm text-blue-700">
          После создания заказа данные клиента будут сохранены
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => onViewClientDetails?.(client, addresses, orderHistory)}
        className="w-full p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
              {client.first_name[0]}{client.last_name?.[0] || ''}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {client.first_name} {client.last_name}
              </h3>
              {client.birthday && (
                <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                  <Calendar className="w-4 h-4" />
                  ДР: {formatDate(client.birthday)}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Заказов</div>
            <div className="text-xl font-bold text-blue-600">{client.total_orders}</div>
            <div className="text-xs text-gray-600 mt-1">
              На {formatCurrency(client.total_spent)}
            </div>
          </div>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-green-600" />
            Адреса доставки ({addresses.length})
          </h4>
          {addresses.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Нет сохраненных адресов</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {addresses.map((address) => (
                <button
                  key={address.id}
                  onClick={() => onSelectAddress?.(address)}
                  className="w-full text-left p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900">{address.address_text}</div>
                  {(address.apartment || address.floor || address.entrance) && (
                    <div className="text-xs text-gray-600 mt-1">
                      {address.apartment && `кв. ${address.apartment}`}
                      {address.floor && `, ${address.floor} эт.`}
                      {address.entrance && `, под. ${address.entrance}`}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <ShoppingBag className="w-3 h-3" />
                    {address.deliveries_count} доставок
                    {address.last_delivery_date && (
                      <>
                        <Clock className="w-3 h-3 ml-2" />
                        {formatDate(address.last_delivery_date)}
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-orange-600" />
            История заказов
          </h4>
          {orderHistory.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Нет истории заказов</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {orderHistory.map((order) => (
                <button
                  key={order.id}
                  onClick={() => onSelectOrder?.(order.order_data)}
                  className="w-full text-left p-3 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-900">
                      № {order.order_number}
                    </span>
                    <span className="text-sm font-semibold text-green-600">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {formatDate(order.created_at)}
                  </div>
                  {order.order_data?.items && (
                    <div className="mt-2 text-xs text-gray-700">
                      {order.order_data.items.slice(0, 2).map((item: any, idx: number) => (
                        <div key={idx}>• {item.product_name} x{item.quantity}</div>
                      ))}
                      {order.order_data.items.length > 2 && (
                        <div className="text-gray-500 mt-1">
                          +{order.order_data.items.length - 2} еще...
                        </div>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
