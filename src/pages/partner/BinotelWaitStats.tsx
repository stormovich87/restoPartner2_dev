import { useState, useEffect, useCallback } from 'react';
import { Phone, Clock, AlertCircle, RefreshCw, TrendingUp, Activity, BarChart2, List } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface BinotelWaitStatsProps {
  partnerId: string;
}

interface WaitStats {
  calls_count: number;
  avg_waitsec: number;
  median_waitsec: number;
  p95_waitsec: number;
  min_waitsec: number;
  max_waitsec: number;
  zero_waitsec_count: number;
}

interface CallSample {
  id: string;
  completed_at: string;
  external_number: string;
  internal_number: string;
  waitsec: number;
  call_status: string;
  branch_id: string | null;
  branch_name: string | null;
}

interface Branch {
  id: string;
  name: string;
}

type CalcMode = 'NOANSWER_ONLY' | 'NOANSWER_OR_CANCEL';

export default function BinotelWaitStats({ partnerId }: BinotelWaitStatsProps) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [branchId, setBranchId] = useState<string>('');
  const [internalNumber, setInternalNumber] = useState('');
  const [mode, setMode] = useState<CalcMode>('NOANSWER_ONLY');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stats, setStats] = useState<WaitStats | null>(null);
  const [samples, setSamples] = useState<CallSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalNumbers, setInternalNumbers] = useState<string[]>([]);

  useEffect(() => {
    loadBranches();
    loadInternalNumbers();
  }, [partnerId]);

  useEffect(() => {
    if (partnerId && dateFrom && dateTo) {
      loadStats();
    }
  }, [partnerId, dateFrom, dateTo, branchId, internalNumber, mode]);

  const loadBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .eq('partner_id', partnerId)
      .eq('status', 'active')
      .order('name');

    if (data) {
      setBranches(data);
    }
  };

  const loadInternalNumbers = async () => {
    const { data } = await supabase
      .from('binotel_calls')
      .select('internal_number')
      .eq('partner_id', partnerId)
      .not('internal_number', 'is', null)
      .limit(1000);

    if (data) {
      const uniqueNumbers = [...new Set(data.map(d => d.internal_number).filter(Boolean))];
      setInternalNumbers(uniqueNumbers.sort());
    }
  };

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);

      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);

      const [statsRes, samplesRes] = await Promise.all([
        supabase.rpc('get_binotel_wait_stats', {
          p_partner_id: partnerId,
          p_date_from: fromDate.toISOString(),
          p_date_to: toDate.toISOString(),
          p_branch_id: branchId || null,
          p_internal_number: internalNumber || null,
          p_mode: mode
        }),
        supabase.rpc('get_binotel_wait_calls_sample', {
          p_partner_id: partnerId,
          p_date_from: fromDate.toISOString(),
          p_date_to: toDate.toISOString(),
          p_branch_id: branchId || null,
          p_internal_number: internalNumber || null,
          p_mode: mode,
          p_limit: 20
        })
      ]);

      if (statsRes.error) throw statsRes.error;
      if (samplesRes.error) throw samplesRes.error;

      if (statsRes.data && statsRes.data.length > 0) {
        setStats(statsRes.data[0]);
      } else {
        setStats({
          calls_count: 0,
          avg_waitsec: 0,
          median_waitsec: 0,
          p95_waitsec: 0,
          min_waitsec: 0,
          max_waitsec: 0,
          zero_waitsec_count: 0
        });
      }

      setSamples(samplesRes.data || []);
    } catch (err) {
      console.error('Error loading stats:', err);
      setError('Не удалось загрузить статистику. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }, [partnerId, dateFrom, dateTo, branchId, internalNumber, mode]);

  const formatSeconds = (sec: number) => {
    if (sec >= 60) {
      const min = Math.floor(sec / 60);
      const s = Math.round(sec % 60);
      return `${min}м ${s}с`;
    }
    return `${Math.round(sec)}с`;
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('380')) {
      return `+${digits.slice(0, 3)} (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`;
    }
    return phone;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Ожидание ответа</h2>
            <p className="text-sm text-gray-500">Статистика пропущенных входящих звонков</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Период с</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Период по</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Филиал</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">Все филиалы</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Внутренний номер</label>
            <select
              value={internalNumber}
              onChange={(e) => setInternalNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">Все операторы</option>
              {internalNumbers.map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Режим расчета</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as CalcMode)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="NOANSWER_ONLY">Не ответили (NOANSWER)</option>
              <option value="NOANSWER_OR_CANCEL">+ клиент сбросил (CANCEL)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-semibold hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </button>
          {loading && <span className="text-sm text-gray-500">Загрузка...</span>}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-amber-200/50 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-600">Среднее ожидание</span>
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              {stats.calls_count > 0 ? formatSeconds(stats.avg_waitsec) : '-'}
            </div>
            <p className="text-xs text-gray-500 mt-1">среднее время до сброса</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-blue-200/50 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                <BarChart2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-600">Медиана</span>
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              {stats.calls_count > 0 ? formatSeconds(stats.median_waitsec) : '-'}
            </div>
            <p className="text-xs text-gray-500 mt-1">50% звонков короче</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-rose-200/50 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-600">P95</span>
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
              {stats.calls_count > 0 ? formatSeconds(stats.p95_waitsec) : '-'}
            </div>
            <p className="text-xs text-gray-500 mt-1">95% звонков короче</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-teal-200/50 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-600">Всего звонков</span>
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
              {stats.calls_count}
            </div>
            <p className="text-xs text-gray-500 mt-1">в расчете метрики</p>
          </div>
        </div>
      )}

      {stats && stats.calls_count > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/80 backdrop-blur-xl p-4 rounded-xl shadow border border-gray-200/50">
            <div className="text-sm text-gray-600 mb-1">Минимум</div>
            <div className="text-xl font-bold text-gray-900">{formatSeconds(stats.min_waitsec)}</div>
          </div>
          <div className="bg-white/80 backdrop-blur-xl p-4 rounded-xl shadow border border-gray-200/50">
            <div className="text-sm text-gray-600 mb-1">Максимум</div>
            <div className="text-xl font-bold text-gray-900">{formatSeconds(stats.max_waitsec)}</div>
          </div>
          <div className="bg-white/80 backdrop-blur-xl p-4 rounded-xl shadow border border-gray-200/50">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              Записей с waitsec=0
              {stats.zero_waitsec_count > 0 && (
                <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">внимание</span>
              )}
            </div>
            <div className="text-xl font-bold text-gray-900">{stats.zero_waitsec_count}</div>
          </div>
        </div>
      )}

      {samples.length > 0 && (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
          <div className="p-4 border-b border-gray-200/50 flex items-center gap-3">
            <List className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Последние звонки в расчете (до 20)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Время</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Внешний номер</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Внутр. номер</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ожидание</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Филиал</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/50">
                {samples.map((call) => (
                  <tr key={call.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(call.completed_at).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                      {formatPhone(call.external_number)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {call.internal_number || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`font-semibold ${call.waitsec >= 30 ? 'text-rose-600' : call.waitsec >= 15 ? 'text-amber-600' : 'text-gray-900'}`}>
                        {formatSeconds(call.waitsec)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        call.call_status === 'NOANSWER'
                          ? 'bg-red-100 text-red-700'
                          : call.call_status === 'CANCEL'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {call.call_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {call.branch_name || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && stats && stats.calls_count === 0 && (
        <div className="bg-white/80 backdrop-blur-xl p-12 rounded-2xl shadow-lg border border-gray-200/50 text-center">
          <Phone className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Нет данных</h3>
          <p className="text-gray-500">
            За выбранный период нет пропущенных входящих звонков с статусом NOANSWER.
          </p>
        </div>
      )}
    </div>
  );
}
