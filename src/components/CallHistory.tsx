import { useState, useEffect } from 'react';
import { ArrowLeft, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Filter, X, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ClientDrawer from './ClientDrawer';

interface BinotelCall {
  id: string;
  external_id: string;
  partner_id: string;
  client_phone: string;
  staff_internal_number: string | null;
  call_status: string;
  disposition: string | null;
  call_type: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  client_id: string | null;
  order_id: string | null;
  answered_at: string | null;
  is_outgoing: boolean;
}

interface Client {
  id: string;
  name: string;
}

interface CallHistoryProps {
  partnerId: string;
  onClose: () => void;
  onCreateOrder?: (phone: string, branchId: string | null, sourceCallId: string | null) => void;
  onRepeatOrder?: (phone: string, branchId: string | null, items: any[]) => void;
  onEditOrder?: (orderId: string) => void;
}

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export default function CallHistory({ partnerId, onClose, onCreateOrder, onRepeatOrder, onEditOrder }: CallHistoryProps) {
  const [calls, setCalls] = useState<BinotelCall[]>([]);
  const [clients, setClients] = useState<Map<string, Client>>(new Map());
  const [loading, setLoading] = useState(true);
  const [phoneFilter, setPhoneFilter] = useState<string | null>(null);
  const [showMissedOnly, setShowMissedOnly] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [missedCount, setMissedCount] = useState(0);
  const [selectedCallPhone, setSelectedCallPhone] = useState<string | null>(null);
  const [selectedCallClientId, setSelectedCallClientId] = useState<string | null>(null);
  const [selectedCallClientName, setSelectedCallClientName] = useState<string | null>(null);

  useEffect(() => {
    loadCalls();
  }, [partnerId, phoneFilter, showMissedOnly, dateFilter, customDateFrom, customDateTo]);

  const getDateRange = (): { from: Date; to: Date } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateFilter) {
      case 'today':
        return { from: today, to: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { from: yesterday, to: today };
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { from: weekAgo, to: new Date(now.getTime() + 24 * 60 * 60 * 1000) };
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return { from: monthAgo, to: new Date(now.getTime() + 24 * 60 * 60 * 1000) };
      case 'custom':
        if (customDateFrom && customDateTo) {
          return {
            from: new Date(customDateFrom),
            to: new Date(new Date(customDateTo).getTime() + 24 * 60 * 60 * 1000)
          };
        }
        return { from: today, to: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      default:
        return { from: today, to: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
    }
  };

  const loadCalls = async () => {
    try {
      setLoading(true);

      const { from, to } = getDateRange();

      let query = supabase
        .from('binotel_calls')
        .select('*')
        .eq('partner_id', partnerId)
        .gte('created_at', from.toISOString())
        .lt('created_at', to.toISOString())
        .order('created_at', { ascending: false });

      if (phoneFilter) {
        query = query.eq('client_phone', phoneFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      let filteredCalls = data || [];

      if (showMissedOnly) {
        const missedCalls = await filterMissedCalls(filteredCalls);
        filteredCalls = missedCalls;
      }

      setCalls(filteredCalls);

      const uniqueClientIds = [...new Set(filteredCalls.map(c => c.client_id).filter(Boolean))] as string[];
      if (uniqueClientIds.length > 0) {
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, first_name, last_name, phone')
          .in('id', uniqueClientIds);

        const clientsMap = new Map<string, Client>();
        clientsData?.forEach(client => {
          const firstName = client.first_name || '';
          const lastName = client.last_name || '';
          const fullName = `${firstName} ${lastName}`.trim();
          clientsMap.set(client.id, {
            id: client.id,
            name: fullName || client.phone || '',
          });
        });
        setClients(clientsMap);
      }

      if (!showMissedOnly) {
        const allMissedCalls = await filterMissedCalls(data || []);
        setMissedCount(allMissedCalls.length);
      } else {
        setMissedCount(filteredCalls.length);
      }
    } catch (error) {
      console.error('Error loading calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterMissedCalls = async (callsList: BinotelCall[]): Promise<BinotelCall[]> => {
    // Use Binotel data to determine missed calls
    // Only show missed calls that haven't received callback yet and aren't lost
    const { data: missedCalls } = await supabase
      .from('binotel_calls')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('is_missed', true)
      .eq('is_callback_made', false)
      .eq('is_lost', false)
      .eq('is_outgoing', false)
      .order('created_at', { ascending: false });

    return missedCalls || [];
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCallIcon = (call: BinotelCall) => {
    if (call.is_outgoing) {
      return <PhoneOutgoing className="w-5 h-5 text-blue-600" />;
    }
    if (call.call_status === 'ANSWER') {
      return <PhoneIncoming className="w-5 h-5 text-green-600" />;
    }
    return <PhoneMissed className="w-5 h-5 text-red-600" />;
  };

  const getCallStatusText = (call: BinotelCall) => {
    if (call.is_outgoing) return 'Исходящий';
    if (call.call_status === 'ANSWER') return 'Принят';
    if (call.call_status === 'NOANSWER') return 'Не отвечен';
    if (call.call_status === 'BUSY') return 'Занято';
    return call.call_status;
  };

  const getCallStatusColor = (call: BinotelCall) => {
    if (call.is_outgoing) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (call.call_status === 'ANSWER') return 'bg-green-50 text-green-700 border-green-200';
    return 'bg-red-50 text-red-700 border-red-200';
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 overflow-auto">
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-xl">
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Назад к заказам"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-3">
                <Phone className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-900">История звонков</h2>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={() => {
                  setDateFilter('today');
                  setCustomDateFrom('');
                  setCustomDateTo('');
                }}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  dateFilter === 'today'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
                }`}
              >
                Сегодня
              </button>
              <button
                onClick={() => {
                  setDateFilter('yesterday');
                  setCustomDateFrom('');
                  setCustomDateTo('');
                }}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  dateFilter === 'yesterday'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
                }`}
              >
                Вчера
              </button>
              <button
                onClick={() => {
                  setDateFilter('week');
                  setCustomDateFrom('');
                  setCustomDateTo('');
                }}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  dateFilter === 'week'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
                }`}
              >
                Неделя
              </button>
              <button
                onClick={() => {
                  setDateFilter('month');
                  setCustomDateFrom('');
                  setCustomDateTo('');
                }}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  dateFilter === 'month'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
                }`}
              >
                Месяц
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDateFilter('custom')}
                  className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 ${
                    dateFilter === 'custom'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                      : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Период
                </button>

                {dateFilter === 'custom' && (
                  <>
                    <input
                      type="date"
                      value={customDateFrom}
                      onChange={(e) => setCustomDateFrom(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <span className="text-gray-500">-</span>
                    <input
                      type="date"
                      value={customDateTo}
                      onChange={(e) => setCustomDateTo(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </>
                )}
              </div>

              <button
                onClick={() => setShowMissedOnly(!showMissedOnly)}
                className={`px-4 py-2 rounded-xl font-medium transition-all relative ${
                  showMissedOnly
                    ? 'bg-red-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-red-50 border border-gray-200'
                }`}
              >
                Пропущенные
                {missedCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {missedCount}
                  </span>
                )}
              </button>
            </div>

            {phoneFilter && (
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl px-6 py-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <Filter className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-900">История взаимодействия с номером</span>
                    </div>
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-lg font-bold text-gray-900">{phoneFilter}</span>
                      {calls.length > 0 && calls[0].client_id && clients.has(calls[0].client_id) && (
                        <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-lg border border-gray-200">
                          {clients.get(calls[0].client_id)?.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <PhoneIncoming className="w-4 h-4 text-green-600" />
                          <span className="text-gray-600">Входящих:</span>
                          <span className="font-semibold text-gray-900">
                            {calls.filter(c => !c.is_outgoing && c.call_status === 'ANSWER').length}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <PhoneOutgoing className="w-4 h-4 text-blue-600" />
                          <span className="text-gray-600">Исходящих:</span>
                          <span className="font-semibold text-gray-900">
                            {calls.filter(c => c.is_outgoing).length}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <PhoneMissed className="w-4 h-4 text-red-600" />
                          <span className="text-gray-600">Пропущенных:</span>
                          <span className="font-semibold text-gray-900">
                            {calls.filter(c => c.is_missed && !c.is_outgoing).length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setPhoneFilter(null)}
                    className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                    title="Сбросить фильтр"
                  >
                    <X className="w-5 h-5 text-blue-600" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Загрузка звонков...</p>
              </div>
            ) : calls.length === 0 ? (
              <div className="text-center py-12">
                <Phone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">Звонков за выбранный период нет</p>
              </div>
            ) : (
              <div className="space-y-3">
                {calls.map((call) => (
                  <div
                    key={call.id}
                    onClick={() => {
                      const client = call.client_id ? clients.get(call.client_id) : null;
                      setSelectedCallPhone(call.client_phone);
                      setSelectedCallClientId(call.client_id);
                      setSelectedCallClientName(client?.name || null);
                    }}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 p-2 bg-gray-50 rounded-lg">
                        {getCallIcon(call)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-900">{call.client_phone}</span>
                              {call.client_id && clients.has(call.client_id) && (
                                <span className="text-sm text-gray-600">
                                  {clients.get(call.client_id)?.name}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">{formatDateTime(call.created_at)}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${getCallStatusColor(call)}`}>
                              {getCallStatusText(call)}
                            </span>
                            {call.duration_seconds !== null && call.duration_seconds > 0 && (
                              <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                {formatDuration(call.duration_seconds)}
                              </span>
                            )}
                          </div>
                        </div>

                        {!phoneFilter && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPhoneFilter(call.client_phone);
                              setShowMissedOnly(false);
                            }}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <Filter className="w-3 h-3" />
                            Показать по номеру
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ClientDrawer
        isOpen={selectedCallPhone !== null}
        phone={selectedCallPhone}
        clientId={selectedCallClientId}
        clientName={selectedCallClientName}
        branchId={null}
        generalCallId={null}
        partnerId={partnerId}
        onClose={() => {
          setSelectedCallPhone(null);
          setSelectedCallClientId(null);
          setSelectedCallClientName(null);
        }}
        onCreateOrder={(phone, branchId, sourceCallId) => {
          if (onCreateOrder) {
            onCreateOrder(phone, branchId, sourceCallId);
          }
          setSelectedCallPhone(null);
          setSelectedCallClientId(null);
          setSelectedCallClientName(null);
        }}
        onRepeatOrder={onRepeatOrder}
        onEditOrder={onEditOrder}
      />
    </div>
  );
}
