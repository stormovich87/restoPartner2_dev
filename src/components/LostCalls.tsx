import { useState, useEffect } from 'react';
import { ArrowLeft, PhoneMissed, AlertTriangle, Filter, X, Calendar, PhoneOutgoing, ShoppingBag, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ClientDrawer from './ClientDrawer';

interface BinotelCall {
  id: string;
  partner_id: string;
  client_phone: string;
  staff_internal_number: string | null;
  call_type: number;
  call_status: string;
  disposition: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  client_id: string | null;
  branch_id: string | null;
  is_missed: boolean;
  is_outgoing: boolean;
  is_lost: boolean;
  lost_at: string | null;
  callback_deadline: string | null;
}

interface Client {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
}

interface LostCallsProps {
  partnerId: string;
  onClose: () => void;
  onCreateOrder?: (phone: string, branchId: string | null, sourceCallId: string | null) => void;
  onRepeatOrder?: (phone: string, branchId: string | null, items: any[]) => void;
  onEditOrder?: (orderId: string) => void;
}

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export default function LostCalls({ partnerId, onClose, onCreateOrder, onRepeatOrder, onEditOrder }: LostCallsProps) {
  const [calls, setCalls] = useState<BinotelCall[]>([]);
  const [clients, setClients] = useState<Map<string, Client>>(new Map());
  const [branches, setBranches] = useState<Map<string, Branch>>(new Map());
  const [loading, setLoading] = useState(true);
  const [phoneFilter, setPhoneFilter] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [selectedCallPhone, setSelectedCallPhone] = useState<string | null>(null);
  const [selectedCallClientId, setSelectedCallClientId] = useState<string | null>(null);
  const [selectedCallClientName, setSelectedCallClientName] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  useEffect(() => {
    loadCalls();
  }, [partnerId, phoneFilter, branchFilter, dateFilter, customDateFrom, customDateTo]);

  useEffect(() => {
    loadBranches();
  }, [partnerId]);

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

  const loadBranches = async () => {
    try {
      const { data } = await supabase
        .from('branches')
        .select('id, name')
        .eq('partner_id', partnerId);

      if (data) {
        const branchesMap = new Map<string, Branch>();
        data.forEach(branch => {
          branchesMap.set(branch.id, branch);
        });
        setBranches(branchesMap);
      }
    } catch (error) {
      console.error('Error loading branches:', error);
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
        .eq('call_type', 0)
        .eq('is_missed', true)
        .neq('call_status', 'ANSWER');

      if (phoneFilter) {
        query = query.eq('client_phone', phoneFilter);
      }

      if (branchFilter) {
        query = query.eq('branch_id', branchFilter);
      }

      const { data: allData, error } = await query;

      const filteredData = (allData || []).filter(call => {
        const dateToCheck = call.started_at ? new Date(call.started_at) : new Date(call.created_at);
        return dateToCheck >= from && dateToCheck < to;
      });

      filteredData.sort((a, b) => {
        const dateA = a.started_at ? new Date(a.started_at) : new Date(a.created_at);
        const dateB = b.started_at ? new Date(b.started_at) : new Date(b.created_at);
        return dateB.getTime() - dateA.getTime();
      });

      const data = filteredData;

      if (error) throw error;

      setCalls(data || []);

      const uniqueClientIds = [...new Set(data?.map(c => c.client_id).filter(Boolean))] as string[];
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
          // If fullName is empty, use phone as fallback
          const displayName = fullName || client.phone || '';
          clientsMap.set(client.id, { id: client.id, name: displayName });
        });
        setClients(clientsMap);
      }
    } catch (error) {
      console.error('Error loading lost calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeSinceCall = (call: BinotelCall) => {
    const callTime = call.started_at || call.created_at;
    if (!callTime) return 'Неизвестно';

    const now = new Date();
    const callDate = new Date(callTime);
    const diffMs = now.getTime() - callDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} ${diffDays === 1 ? 'день' : 'дней'} назад`;
    } else if (diffHours > 0) {
      return `${diffHours} ${diffHours === 1 ? 'час' : 'часов'} назад`;
    } else {
      return `${diffMins} ${diffMins === 1 ? 'минуту' : 'минут'} назад`;
    }
  };

  const handleMakeCallback = (phone: string, branchId: string | null) => {
    window.open(`tel:${phone}`, '_self');
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 overflow-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                Потерянные звонки
              </h1>
              <p className="text-gray-600 mt-1">
                Пропущенные звонки без перезвона в течение заданного времени
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="today">Сегодня</option>
                <option value="yesterday">Вчера</option>
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
                <option value="custom">Произвольный</option>
              </select>
            </div>

            {dateFilter === 'custom' && (
              <>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-500">—</span>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </>
            )}

            {branches.size > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={branchFilter || ''}
                  onChange={(e) => setBranchFilter(e.target.value || null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Все филиалы</option>
                  {Array.from(branches.values()).map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>
            )}

            {phoneFilter && (
              <div className="flex items-center gap-2 bg-red-50 border-2 border-red-200 rounded-lg px-4 py-3 flex-1">
                <Filter className="w-5 h-5 text-red-600" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-red-900">Потерянные звонки с номера:</span>
                  <span className="text-base font-bold text-gray-900">{phoneFilter}</span>
                  {calls.length > 0 && calls[0].client_id && clients.has(calls[0].client_id) && (
                    <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                      {clients.get(calls[0].client_id)?.name}
                    </span>
                  )}
                  <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded text-sm font-medium">
                    {calls.length} {calls.length === 1 ? 'звонок' : calls.length < 5 ? 'звонка' : 'звонков'}
                  </span>
                </div>
                <button
                  onClick={() => setPhoneFilter(null)}
                  className="ml-auto p-1 hover:bg-red-100 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-red-600" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : calls.length === 0 ? (
            <div className="text-center py-16">
              <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Потерянных звонков за выбранный период нет</p>
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
                    setSelectedBranchId(call.branch_id);
                  }}
                  className="bg-white border-2 border-red-200 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 p-2 bg-red-50 rounded-lg">
                      <PhoneMissed className="w-6 h-6 text-red-500" />
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
                          <p className="text-sm text-gray-500">{formatDateTime(call.started_at || call.created_at)}</p>
                          {call.branch_id && branches.has(call.branch_id) && (
                            <p className="text-sm text-gray-600 mt-1">
                              Филиал: {branches.get(call.branch_id)?.name}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                            Потерян
                          </span>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {getTimeSinceCall(call)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMakeCallback(call.client_phone, call.branch_id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                        >
                          <PhoneOutgoing className="w-4 h-4" />
                          Перезвонить
                        </button>

                        {onCreateOrder && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCreateOrder(call.client_phone, call.branch_id, null);
                              onClose();
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                          >
                            <ShoppingBag className="w-4 h-4" />
                            Создать заказ
                          </button>
                        )}

                        {!phoneFilter && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPhoneFilter(call.client_phone);
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ClientDrawer
        isOpen={selectedCallPhone !== null}
        phone={selectedCallPhone}
        clientId={selectedCallClientId}
        clientName={selectedCallClientName}
        branchId={selectedBranchId}
        generalCallId={null}
        partnerId={partnerId}
        onClose={() => {
          setSelectedCallPhone(null);
          setSelectedCallClientId(null);
          setSelectedCallClientName(null);
          setSelectedBranchId(null);
        }}
        onCreateOrder={(phone, branchId, sourceCallId) => {
          if (onCreateOrder) {
            onCreateOrder(phone, branchId, sourceCallId);
          }
          setSelectedCallPhone(null);
          setSelectedCallClientId(null);
          setSelectedCallClientName(null);
          setSelectedBranchId(null);
        }}
        onRepeatOrder={onRepeatOrder}
        onEditOrder={onEditOrder}
      />
    </div>
  );
}
