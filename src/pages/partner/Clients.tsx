import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Users, Search, Phone, Calendar, ShoppingBag, MapPin, ArrowLeft, Clock, Heart, Home, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Client {
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

interface OrderHistoryItem {
  id: string;
  order_number: string | null;
  total_amount: number;
  order_data: any;
  created_at: string;
}

export default function Clients() {
  const { partnerPrefix } = useParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientAddresses, setClientAddresses] = useState<Record<string, ClientAddress[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientOrderHistory, setClientOrderHistory] = useState<OrderHistoryItem[]>([]);
  const [selectedClientAddresses, setSelectedClientAddresses] = useState<ClientAddress[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  useEffect(() => {
    loadClients();

    const channel = supabase
      .channel('clients-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients'
        },
        () => {
          loadClients();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [partnerPrefix]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const { data: partner } = await supabase
        .from('partners')
        .select('id')
        .eq('url_suffix', partnerPrefix)
        .maybeSingle();

      if (!partner) return;

      setPartnerId(partner.id);

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('partner_id', partner.id)
        .order('last_order_date', { ascending: false, nullsFirst: false });

      if (error) throw error;

      const clientsData = data || [];
      setClients(clientsData);

      if (clientsData.length > 0) {
        const clientIds = clientsData.map(c => c.id);
        const { data: addresses } = await supabase
          .from('client_addresses')
          .select('*')
          .in('client_id', clientIds);

        if (addresses) {
          const addressMap: Record<string, ClientAddress[]> = {};
          addresses.forEach(addr => {
            if (!addressMap[addr.client_id]) {
              addressMap[addr.client_id] = [];
            }
            addressMap[addr.client_id].push(addr);
          });
          setClientAddresses(addressMap);
        }
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClientDetails = async (client: Client) => {
    setLoadingDetails(true);
    setSelectedClient(client);
    setClientOrderHistory([]);
    setSelectedClientAddresses([]);

    try {
      const [addressesRes, historyRes] = await Promise.all([
        supabase
          .from('client_addresses')
          .select('*')
          .eq('client_id', client.id)
          .order('deliveries_count', { ascending: false }),
        supabase
          .from('client_orders_history')
          .select('*')
          .eq('client_id', client.id)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      if (addressesRes.data) {
        setSelectedClientAddresses(addressesRes.data);
      }
      if (historyRes.data) {
        setClientOrderHistory(historyRes.data);
      }
    } catch (error) {
      console.error('Error loading client details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredClients = clients.filter(client => {
    const searchLower = searchTerm.toLowerCase();
    const matchesBasic =
      client.phone.includes(searchTerm) ||
      (client.first_name && client.first_name.toLowerCase().includes(searchLower)) ||
      (client.last_name && client.last_name.toLowerCase().includes(searchLower));

    if (matchesBasic) return true;

    const addresses = clientAddresses[client.id] || [];
    return addresses.some(addr =>
      addr.address_text.toLowerCase().includes(searchLower)
    );
  });

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

  const handleDeleteClient = async (clientId: string) => {
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
      setSelectedClient(null);
      setClientOrderHistory([]);
      setSelectedClientAddresses([]);
      loadClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Ошибка при удалении клиента');
    }
  };

  if (selectedClient) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              setSelectedClient(null);
              setClientOrderHistory([]);
              setSelectedClientAddresses([]);
            }}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад к списку
          </button>
          <button
            onClick={() => handleDeleteClient(selectedClient.id)}
            className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors inline-flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Удалить клиента
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                  {selectedClient.first_name?.[0] || '?'}{selectedClient.last_name?.[0] || ''}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedClient.first_name || 'Без имени'} {selectedClient.last_name || ''}
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Клиент с {formatDate(selectedClient.created_at)}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-gray-700">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <span className="font-medium">{selectedClient.phone}</span>
                </div>
                {selectedClient.additional_phones?.length > 0 && selectedClient.additional_phones.map((phone, i) => (
                  <div key={i} className="flex items-center gap-3 text-gray-700 pl-8">
                    <span className="text-sm">{phone}</span>
                  </div>
                ))}
                {selectedClient.birthday && (
                  <div className="flex items-center gap-3 text-gray-700">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <span>{formatDate(selectedClient.birthday)}</span>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <div className="text-3xl font-bold text-blue-600">{selectedClient.total_orders}</div>
                  <div className="text-sm text-gray-600">Заказов</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-xl">
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(selectedClient.total_spent)}</div>
                  <div className="text-sm text-gray-600">Сумма</div>
                </div>
              </div>

              {selectedClient.notes && (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <h3 className="text-sm font-semibold text-amber-900 mb-1">Заметки</h3>
                  <p className="text-sm text-amber-800">{selectedClient.notes}</p>
                </div>
              )}
            </div>

            {selectedClient.favorite_dishes?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-500" />
                  Любимые блюда
                </h3>
                <div className="space-y-3">
                  {selectedClient.favorite_dishes.slice(0, 8).map((dish, index) => (
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
                <Home className="w-5 h-5 text-blue-600" />
                Адреса доставки
                <span className="text-sm font-normal text-gray-500">({selectedClientAddresses.length})</span>
              </h3>
              {loadingDetails ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : selectedClientAddresses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Адресов пока нет</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedClientAddresses.map((address) => (
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
                <span className="text-sm font-normal text-gray-500">({clientOrderHistory.length})</span>
              </h3>
              {loadingDetails ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : clientOrderHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Заказов пока нет</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {clientOrderHistory.map((order) => (
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
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-600" />
          Клиенты
        </h1>
        <p className="text-gray-600 mt-1">
          База данных клиентов с историей заказов и предпочтениями
        </p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск по телефону, имени или адресу..."
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Загрузка клиентов...</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            {searchTerm ? 'Клиенты не найдены' : 'Клиенты появятся после создания первого заказа'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Клиент
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Телефон
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                  Адрес
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Заказов
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                  Сумма
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                  Последний заказ
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">

                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredClients.map((client) => {
                const addresses = clientAddresses[client.id] || [];
                const primaryAddress = addresses[0];
                return (
                  <tr
                    key={client.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => loadClientDetails(client)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                          {client.first_name?.[0] || '?'}{client.last_name?.[0] || ''}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {client.first_name || 'Без имени'} {client.last_name || ''}
                          </div>
                          {client.birthday && (
                            <div className="text-sm text-gray-500">
                              ДР: {formatDate(client.birthday)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-900">
                        <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{client.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      {primaryAddress ? (
                        <div className="flex items-center gap-2 text-gray-600 max-w-xs">
                          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate text-sm">{primaryAddress.address_text}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-gray-900">{client.total_orders}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="font-semibold text-green-600">
                        {formatCurrency(client.total_spent)}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="text-gray-600 text-sm">
                        {formatDate(client.last_order_date)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="w-5 h-5 text-gray-400 inline-block" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
