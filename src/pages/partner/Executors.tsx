import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, MapPin, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import PerformerZoneManager from '../../components/PerformerZoneManager';
import { checkBotTokenUniqueness, getConflictMessage } from '../../lib/botTokenValidator';

interface Executor {
  id: string;
  partner_id: string;
  name: string;
  own_couriers: boolean;
  allow_external_couriers: boolean;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  telegram_thread_id: string | null;
  distribute_by_branches: boolean;
  payment_for_pour: boolean;
  payment_terminal: boolean;
  payment_cashless: boolean;
  commission_percent: number;
  bad_weather_surcharge_percent: number;
  different_prices: boolean;
  price_markup_percent: number | null;
  delivery_payer_default: 'restaurant' | 'client';
  default_payment_method_id: string | null;
  status: 'active' | 'inactive';
  no_zone_message: string | null;
  created_at: string;
}

interface ExecutorBranchTelegramSettings {
  id: string;
  executor_id: string;
  branch_id: string;
  telegram_chat_id: string;
  telegram_thread_id: string | null;
  telegram_bot_token: string | null;
}

interface Branch {
  id: string;
  name: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  method_type: 'cash' | 'cashless';
}

interface ExecutorsProps {
  partnerId: string;
}

export default function Executors({ partnerId }: ExecutorsProps) {
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExecutor, setEditingExecutor] = useState<Executor | null>(null);
  const [zoneExecutorId, setZoneExecutorId] = useState<string | null>(null);

  useEffect(() => {
    loadExecutors();
  }, [partnerId]);

  const loadExecutors = async () => {
    try {
      const { data, error } = await supabase
        .from('executors')
        .select('*')
        .eq('partner_id', partnerId)
        .order('name');

      if (error) throw error;
      setExecutors(data || []);
    } catch (error) {
      console.error('Error loading executors:', error);
      await logger.error(partnerId, 'executors', 'Ошибка загрузки исполнителей', { error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого исполнителя?')) return;

    try {
      const { error } = await supabase
        .from('executors')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setExecutors(executors.filter(e => e.id !== id));
      await logger.info(partnerId, 'executors', 'Исполнитель удалён', { executorId: id });
    } catch (error) {
      console.error('Error deleting executor:', error);
      await logger.error(partnerId, 'executors', 'Ошибка удаления исполнителя', { executorId: id, error: String(error) });
      alert('Ошибка при удалении исполнителя');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Исполнители</h2>
          <p className="text-sm text-gray-600 mt-1">Управление исполнителями заказов</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Добавить исполнителя
        </button>
      </div>

      {executors.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Нет исполнителей</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Добавить первого исполнителя
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {executors.map((executor) => (
            <div
              key={executor.id}
              className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{executor.name}</h3>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Свои курьеры:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {executor.own_couriers ? '✓ Да' : '✗ Нет'}
                      </span>
                    </div>

                    {executor.own_couriers && (
                      <>
                        <div>
                          <span className="text-gray-500">Bot Token:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {executor.telegram_bot_token ? '✓ Настроен' : '✗ Не настроен'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Chat ID:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {executor.telegram_chat_id || '—'}
                          </span>
                        </div>
                      </>
                    )}

                    <div>
                      <span className="text-gray-500">Комиссия:</span>
                      <span className="ml-2 font-medium text-gray-900">{executor.commission_percent}%</span>
                    </div>

                    <div>
                      <span className="text-gray-500">Доставку платит:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {executor.delivery_payer_default === 'client' ? '👤 Клиент' : '🏢 Заведение'}
                      </span>
                    </div>

                    {executor.different_prices && (
                      <div>
                        <span className="text-gray-500">Наценка:</span>
                        <span className="ml-2 font-medium text-gray-900">{executor.price_markup_percent}%</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2 text-xs">
                    {executor.payment_for_pour && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">За наливку</span>
                    )}
                    {executor.payment_terminal && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded">Терминал</span>
                    )}
                    {executor.payment_cashless && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">Безнал</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setZoneExecutorId(executor.id)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Зоны доставки"
                  >
                    <MapPin className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setEditingExecutor(executor)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Редактировать"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(executor.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddExecutorModal
          partnerId={partnerId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadExecutors();
          }}
        />
      )}

      {editingExecutor && (
        <EditExecutorModal
          executor={editingExecutor}
          onClose={() => setEditingExecutor(null)}
          onSuccess={() => {
            setEditingExecutor(null);
            loadExecutors();
          }}
        />
      )}

      {zoneExecutorId && (
        <ZoneManagementModal
          executor={executors.find(e => e.id === zoneExecutorId)!}
          onClose={() => setZoneExecutorId(null)}
          onSuccess={() => {
            setZoneExecutorId(null);
            loadExecutors();
          }}
        />
      )}
    </div>
  );
}

function AddExecutorModal({ partnerId, onClose, onSuccess }: { partnerId: string; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    own_couriers: true,
    allow_external_couriers: false,
    telegram_bot_token: '',
    telegram_chat_id: '',
    telegram_thread_id: '',
    distribute_by_branches: false,
    payment_for_pour: false,
    payment_terminal: false,
    payment_cashless: false,
    commission_percent: 0,
    bad_weather_surcharge_percent: 0,
    different_prices: false,
    price_markup_percent: 0,
    delivery_payer_default: 'restaurant' as 'restaurant' | 'client',
    default_payment_method_id: ''
  });
  const [saving, setSaving] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [botTokenError, setBotTokenError] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentMethods();
  }, [partnerId]);

  const loadPaymentMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, name, method_type')
        .eq('partner_id', partnerId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBotTokenError(null);
    setSaving(true);

    try {
      if (!formData.own_couriers && formData.telegram_bot_token) {
        const skipBranchCheck = !formData.allow_external_couriers;
        const { isUnique, conflictType } = await checkBotTokenUniqueness(
          partnerId,
          formData.telegram_bot_token,
          'executor',
          undefined,
          skipBranchCheck
        );
        if (!isUnique) {
          setBotTokenError(`Ошибка: ${getConflictMessage(conflictType || '')}`);
          setSaving(false);
          return;
        }
      }

      const { data: newExecutor, error } = await supabase
        .from('executors')
        .insert({
          partner_id: partnerId,
          ...formData,
          telegram_bot_token: !formData.own_couriers ? formData.telegram_bot_token : null,
          telegram_chat_id: !formData.own_couriers ? formData.telegram_chat_id : null,
          telegram_thread_id: !formData.own_couriers && formData.telegram_thread_id ? formData.telegram_thread_id : null,
          price_markup_percent: formData.different_prices ? formData.price_markup_percent : null,
          default_payment_method_id: formData.default_payment_method_id || null
        })
        .select('id')
        .single();

      if (error) throw error;

      if (!formData.own_couriers && formData.telegram_bot_token && newExecutor) {
        try {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/setup-executor-webhook`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              executor_id: newExecutor.id,
              bot_token: formData.telegram_bot_token
            })
          });
        } catch (webhookError) {
          console.error('Error setting up webhook:', webhookError);
        }
      }

      await logger.info(partnerId, 'executors', 'Создан новый исполнитель', { name: formData.name });
      onSuccess();
    } catch (error) {
      console.error('Error creating executor:', error);
      await logger.error(partnerId, 'executors', 'Ошибка создания исполнителя', { error: String(error) });
      alert('Ошибка при создании исполнителя');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b sticky top-0 bg-white z-10">
            <h3 className="text-xl font-bold text-gray-900">Добавить исполнителя</h3>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название исполнителя
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.own_couriers}
                  onChange={(e) => setFormData({ ...formData, own_couriers: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <span className="font-medium text-gray-900">Свои курьеры</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-8">
                {formData.own_couriers
                  ? 'Заказы НЕ будут отправляться в Telegram. Отправка отключена.'
                  : 'Заказы БУДУТ отправляться в Telegram группу исполнителя.'}
              </p>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allow_external_couriers}
                  onChange={(e) => setFormData({ ...formData, allow_external_couriers: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <span className="font-medium text-gray-900">Подключить сторонних курьеров</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-8">
                Сторонние курьеры смогут принимать заказы от этого исполнителя
              </p>
            </div>

            {!formData.own_couriers && (
              <div className="space-y-4 pl-8 border-l-2 border-blue-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Токен бота
                  </label>
                  <input
                    type="text"
                    value={formData.telegram_bot_token}
                    onChange={(e) => {
                      setFormData({ ...formData, telegram_bot_token: e.target.value });
                      setBotTokenError(null);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-colors ${
                      botTokenError
                        ? 'border-red-500 focus:ring-red-500 bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                  />
                  {botTokenError && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{botTokenError}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chat ID (группа/супергруппа)
                  </label>
                  <input
                    type="text"
                    value={formData.telegram_chat_id}
                    onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Thread ID (топик, опционально)
                  </label>
                  <input
                    type="text"
                    value={formData.telegram_thread_id}
                    onChange={(e) => setFormData({ ...formData, telegram_thread_id: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="message_thread_id"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ID топика в супергруппе (если используются топики)
                  </p>
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Настройка оплаты</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Счет по умолчанию
                  </label>
                  <select
                    value={formData.default_payment_method_id}
                    onChange={(e) => setFormData({ ...formData, default_payment_method_id: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Не выбран</option>
                    {paymentMethods.map(method => (
                      <option key={method.id} value={method.id}>
                        {method.name} ({method.method_type === 'cash' ? 'Наличные' : 'Безнал'})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Этот счет будет автоматически выбран при создании заказа с данным исполнителем
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.payment_for_pour}
                      onChange={(e) => setFormData({ ...formData, payment_for_pour: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-gray-900">Выкуп заказа за наливку</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.payment_terminal}
                      onChange={(e) => setFormData({ ...formData, payment_terminal: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-gray-900">На терминал</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.payment_cashless}
                      onChange={(e) => setFormData({ ...formData, payment_cashless: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-gray-900">Безнал (на счет исполнителя)</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Процент комиссии
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.commission_percent}
                onChange={(e) => setFormData({ ...formData, commission_percent: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Плохая погода (% надбавки к зоне доставки)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.bad_weather_surcharge_percent}
                onChange={(e) => setFormData({ ...formData, bad_weather_surcharge_percent: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Процент, который будет прибавляться к стоимости зоны доставки при включении режима "Плохая погода"
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Кто оплачивает доставку по умолчанию
              </label>
              <div className="flex gap-3">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="delivery_payer_add"
                    value="restaurant"
                    checked={formData.delivery_payer_default === 'restaurant'}
                    onChange={() => setFormData({ ...formData, delivery_payer_default: 'restaurant' })}
                    className="sr-only peer"
                  />
                  <div className="px-4 py-3 border-2 rounded-lg text-center peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-900 transition-colors">
                    <div className="font-medium">🏢 Заведение</div>
                  </div>
                </label>
                <label className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="delivery_payer_add"
                    value="client"
                    checked={formData.delivery_payer_default === 'client'}
                    onChange={() => setFormData({ ...formData, delivery_payer_default: 'client' })}
                    className="sr-only peer"
                  />
                  <div className="px-4 py-3 border-2 rounded-lg text-center peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-900 transition-colors">
                    <div className="font-medium">👤 Клиент</div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.different_prices}
                  onChange={(e) => setFormData({ ...formData, different_prices: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <span className="font-medium text-gray-900">Разные цены</span>
              </label>
            </div>

            {formData.different_prices && (
              <div className="pl-8 border-l-2 border-blue-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Процент удорожания товаров у исполнителя
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.price_markup_percent}
                  onChange={(e) => setFormData({ ...formData, price_markup_percent: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Укажите, на сколько процентов ваши цены должны быть выше положенных исполнителю.
                </p>
              </div>
            )}
          </div>

          <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end sticky bottom-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditExecutorModal({ executor, onClose, onSuccess }: { executor: Executor; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: executor.name,
    own_couriers: executor.own_couriers,
    allow_external_couriers: executor.allow_external_couriers || false,
    telegram_bot_token: executor.telegram_bot_token || '',
    telegram_chat_id: executor.telegram_chat_id || '',
    telegram_thread_id: executor.telegram_thread_id || '',
    distribute_by_branches: executor.distribute_by_branches || false,
    payment_for_pour: executor.payment_for_pour,
    payment_terminal: executor.payment_terminal,
    payment_cashless: executor.payment_cashless,
    commission_percent: executor.commission_percent,
    bad_weather_surcharge_percent: executor.bad_weather_surcharge_percent || 0,
    different_prices: executor.different_prices,
    price_markup_percent: executor.price_markup_percent || 0,
    delivery_payer_default: executor.delivery_payer_default || 'restaurant',
    default_payment_method_id: executor.default_payment_method_id || ''
  });
  const [saving, setSaving] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchSettings, setBranchSettings] = useState<Record<string, { chat_id: string; thread_id: string; bot_token: string }>>({});
  const [botTokenError, setBotTokenError] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentMethods();
    loadBranchesAndSettings();
  }, [executor.partner_id]);

  const loadPaymentMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, name, method_type')
        .eq('partner_id', executor.partner_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };

  const loadBranchesAndSettings = async () => {
    try {
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name')
        .eq('partner_id', executor.partner_id)
        .order('name');

      if (branchesError) throw branchesError;
      setBranches(branchesData || []);

      const { data: settingsData, error: settingsError } = await supabase
        .from('executor_branch_telegram_settings')
        .select('*')
        .eq('executor_id', executor.id);

      if (settingsError) throw settingsError;

      const settingsMap: Record<string, { chat_id: string; thread_id: string; bot_token: string }> = {};
      (settingsData || []).forEach((s: ExecutorBranchTelegramSettings) => {
        settingsMap[s.branch_id] = {
          chat_id: s.telegram_chat_id || '',
          thread_id: s.telegram_thread_id || '',
          bot_token: s.telegram_bot_token || ''
        };
      });
      setBranchSettings(settingsMap);
    } catch (error) {
      console.error('Error loading branches and settings:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBotTokenError(null);
    setSaving(true);

    try {
      if (!formData.own_couriers && formData.telegram_bot_token) {
        const skipBranchCheck = !formData.allow_external_couriers;
        const { isUnique, conflictType } = await checkBotTokenUniqueness(
          executor.partner_id,
          formData.telegram_bot_token,
          'executor',
          executor.id,
          skipBranchCheck
        );
        if (!isUnique) {
          setBotTokenError(`Ошибка: ${getConflictMessage(conflictType || '')}`);
          setSaving(false);
          return;
        }
      }

      const { error } = await supabase
        .from('executors')
        .update({
          name: formData.name,
          own_couriers: formData.own_couriers,
          allow_external_couriers: formData.allow_external_couriers,
          telegram_bot_token: !formData.own_couriers ? formData.telegram_bot_token : null,
          telegram_chat_id: !formData.own_couriers ? formData.telegram_chat_id : null,
          telegram_thread_id: !formData.own_couriers && formData.telegram_thread_id ? formData.telegram_thread_id : null,
          distribute_by_branches: formData.distribute_by_branches,
          payment_for_pour: formData.payment_for_pour,
          payment_terminal: formData.payment_terminal,
          payment_cashless: formData.payment_cashless,
          commission_percent: formData.commission_percent,
          bad_weather_surcharge_percent: formData.bad_weather_surcharge_percent,
          different_prices: formData.different_prices,
          price_markup_percent: formData.different_prices ? formData.price_markup_percent : null,
          delivery_payer_default: formData.delivery_payer_default,
          default_payment_method_id: formData.default_payment_method_id || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', executor.id);

      if (error) throw error;

      if (formData.distribute_by_branches && !formData.own_couriers) {
        console.log('Deleting old branch settings for executor:', executor.id);
        const { error: deleteError } = await supabase
          .from('executor_branch_telegram_settings')
          .delete()
          .eq('executor_id', executor.id);

        if (deleteError) {
          console.error('Error deleting old branch settings:', deleteError);
          throw new Error(`Ошибка удаления старых настроек: ${deleteError.message}`);
        }

        const settingsToInsert = Object.entries(branchSettings)
          .filter(([_, settings]) => settings && settings.chat_id && settings.chat_id.trim())
          .map(([branchId, settings]) => ({
            executor_id: executor.id,
            branch_id: branchId,
            telegram_chat_id: settings.chat_id.trim(),
            telegram_thread_id: settings.thread_id && settings.thread_id.trim() ? settings.thread_id.trim() : null,
            telegram_bot_token: settings.bot_token && settings.bot_token.trim() ? settings.bot_token.trim() : null
          }));

        console.log('Settings to insert:', settingsToInsert);

        if (settingsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('executor_branch_telegram_settings')
            .insert(settingsToInsert);

          if (insertError) {
            console.error('Error saving branch settings:', insertError);
            throw new Error(`Ошибка сохранения настроек филиалов: ${insertError.message}`);
          }
        }
      } else if (!formData.distribute_by_branches) {
        console.log('Removing branch settings because distribute_by_branches is OFF');
        const { error: deleteError } = await supabase
          .from('executor_branch_telegram_settings')
          .delete()
          .eq('executor_id', executor.id);

        if (deleteError) {
          console.error('Error removing branch settings:', deleteError);
        }
      }

      if (!formData.own_couriers && formData.telegram_bot_token) {
        const botsToSetup = new Set<string>();
        botsToSetup.add(formData.telegram_bot_token);

        if (formData.distribute_by_branches) {
          Object.values(branchSettings).forEach(settings => {
            if (settings.bot_token && settings.bot_token.trim()) {
              botsToSetup.add(settings.bot_token.trim());
            }
          });
        }

        for (const botToken of botsToSetup) {
          try {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/setup-executor-webhook`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                executor_id: executor.id,
                bot_token: botToken
              })
            });
          } catch (webhookError) {
            console.error('Error setting up webhook for bot:', webhookError);
          }
        }
      }

      await logger.info(executor.partner_id, 'executors', 'Исполнитель обновлён', { executorId: executor.id, name: formData.name });
      onSuccess();
    } catch (error) {
      console.error('Error updating executor:', error);
      const errorDetails = error instanceof Error
        ? { message: error.message, stack: error.stack }
        : typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error);

      await logger.error(executor.partner_id, 'executors', 'Ошибка обновления исполнителя', {
        executorId: executor.id,
        error: errorDetails,
        branchSettingsCount: Object.keys(branchSettings).length,
        distributeByBranches: formData.distribute_by_branches
      });

      alert(`Ошибка при обновлении исполнителя: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b sticky top-0 bg-white z-10">
            <h3 className="text-xl font-bold text-gray-900">Редактировать исполнителя</h3>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название исполнителя
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.own_couriers}
                  onChange={(e) => setFormData({ ...formData, own_couriers: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <span className="font-medium text-gray-900">Свои курьеры</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-8">
                {formData.own_couriers
                  ? 'Заказы НЕ будут отправляться в Telegram. Отправка отключена.'
                  : 'Заказы БУДУТ отправляться в Telegram группу исполнителя.'}
              </p>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allow_external_couriers}
                  onChange={(e) => setFormData({ ...formData, allow_external_couriers: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <span className="font-medium text-gray-900">Подключить сторонних курьеров</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-8">
                Сторонние курьеры смогут принимать заказы от этого исполнителя
              </p>
            </div>

            {!formData.own_couriers && (
              <div className="space-y-4 pl-8 border-l-2 border-blue-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Токен бота
                  </label>
                  <input
                    type="text"
                    value={formData.telegram_bot_token}
                    onChange={(e) => {
                      setFormData({ ...formData, telegram_bot_token: e.target.value });
                      setBotTokenError(null);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-colors ${
                      botTokenError
                        ? 'border-red-500 focus:ring-red-500 bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                  />
                  {botTokenError && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{botTokenError}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chat ID (группа/супергруппа)
                  </label>
                  <input
                    type="text"
                    value={formData.telegram_chat_id}
                    onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Thread ID (топик, опционально)
                  </label>
                  <input
                    type="text"
                    value={formData.telegram_thread_id}
                    onChange={(e) => setFormData({ ...formData, telegram_thread_id: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="message_thread_id"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ID топика в супергруппе (если используются топики)
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.distribute_by_branches}
                      onChange={(e) => setFormData({ ...formData, distribute_by_branches: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="font-medium text-gray-900">Распределять по филиалам</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-8">
                    Заказы будут отправляться в разные чаты в зависимости от филиала
                  </p>
                </div>

                {formData.distribute_by_branches && branches.length > 0 && (
                  <div className="mt-4 space-y-4">
                    <h5 className="text-sm font-semibold text-gray-700">Настройки Telegram по филиалам</h5>
                    <p className="text-xs text-gray-500">
                      Если для филиала не указан Chat ID, будут использоваться общие настройки выше
                    </p>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {branches.map((branch) => (
                        <div key={branch.id} className="p-3 bg-gray-50 rounded-lg border">
                          <div className="font-medium text-gray-800 mb-2">{branch.name}</div>
                          <div className="grid grid-cols-1 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Chat ID</label>
                              <input
                                type="text"
                                value={branchSettings[branch.id]?.chat_id || ''}
                                onChange={(e) => setBranchSettings(prev => ({
                                  ...prev,
                                  [branch.id]: {
                                    ...prev[branch.id],
                                    chat_id: e.target.value,
                                    thread_id: prev[branch.id]?.thread_id || '',
                                    bot_token: prev[branch.id]?.bot_token || ''
                                  }
                                }))}
                                className="w-full px-3 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Chat ID группы"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Thread ID (опционально)</label>
                              <input
                                type="text"
                                value={branchSettings[branch.id]?.thread_id || ''}
                                onChange={(e) => setBranchSettings(prev => ({
                                  ...prev,
                                  [branch.id]: {
                                    ...prev[branch.id],
                                    chat_id: prev[branch.id]?.chat_id || '',
                                    thread_id: e.target.value,
                                    bot_token: prev[branch.id]?.bot_token || ''
                                  }
                                }))}
                                className="w-full px-3 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="message_thread_id"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Bot Token (если отличается)</label>
                              <input
                                type="text"
                                value={branchSettings[branch.id]?.bot_token || ''}
                                onChange={(e) => setBranchSettings(prev => ({
                                  ...prev,
                                  [branch.id]: {
                                    ...prev[branch.id],
                                    chat_id: prev[branch.id]?.chat_id || '',
                                    thread_id: prev[branch.id]?.thread_id || '',
                                    bot_token: e.target.value
                                  }
                                }))}
                                className="w-full px-3 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Оставьте пустым для использования основного токена"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {formData.distribute_by_branches && branches.length === 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      Нет филиалов для настройки. Сначала создайте филиалы в разделе "Филиалы".
                    </p>
                  </div>
                )}
              </div>
            )}

            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Настройка оплаты</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Счет по умолчанию
                  </label>
                  <select
                    value={formData.default_payment_method_id}
                    onChange={(e) => setFormData({ ...formData, default_payment_method_id: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Не выбран</option>
                    {paymentMethods.map(method => (
                      <option key={method.id} value={method.id}>
                        {method.name} ({method.method_type === 'cash' ? 'Наличные' : 'Безнал'})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Этот счет будет автоматически выбран при создании заказа с данным исполнителем
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.payment_for_pour}
                      onChange={(e) => setFormData({ ...formData, payment_for_pour: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-gray-900">Выкуп заказа за наливку</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.payment_terminal}
                      onChange={(e) => setFormData({ ...formData, payment_terminal: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-gray-900">На терминал</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.payment_cashless}
                      onChange={(e) => setFormData({ ...formData, payment_cashless: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-gray-900">Безнал (на счет исполнителя)</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Процент комиссии
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.commission_percent}
                onChange={(e) => setFormData({ ...formData, commission_percent: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Плохая погода (% надбавки к зоне доставки)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.bad_weather_surcharge_percent}
                onChange={(e) => setFormData({ ...formData, bad_weather_surcharge_percent: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Процент, который будет прибавляться к стоимости зоны доставки при включении режима "Плохая погода"
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Кто оплачивает доставку по умолчанию
              </label>
              <div className="flex gap-3">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="delivery_payer_edit"
                    value="restaurant"
                    checked={formData.delivery_payer_default === 'restaurant'}
                    onChange={() => setFormData({ ...formData, delivery_payer_default: 'restaurant' })}
                    className="sr-only peer"
                  />
                  <div className="px-4 py-3 border-2 rounded-lg text-center peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-900 transition-colors">
                    <div className="font-medium">🏢 Заведение</div>
                  </div>
                </label>
                <label className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="delivery_payer_edit"
                    value="client"
                    checked={formData.delivery_payer_default === 'client'}
                    onChange={() => setFormData({ ...formData, delivery_payer_default: 'client' })}
                    className="sr-only peer"
                  />
                  <div className="px-4 py-3 border-2 rounded-lg text-center peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-900 transition-colors">
                    <div className="font-medium">👤 Клиент</div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.different_prices}
                  onChange={(e) => setFormData({ ...formData, different_prices: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <span className="font-medium text-gray-900">Разные цены</span>
              </label>
            </div>

            {formData.different_prices && (
              <div className="pl-8 border-l-2 border-blue-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Процент удорожания товаров у исполнителя
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.price_markup_percent}
                  onChange={(e) => setFormData({ ...formData, price_markup_percent: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Укажите, на сколько процентов ваши цены должны быть выше положенных исполнителю.
                </p>
              </div>
            )}
          </div>

          <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end sticky bottom-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ZoneManagementModal({ executor, onClose, onSuccess }: { executor: Executor; onClose: () => void; onSuccess: () => void }) {
  const [noZoneMessage, setNoZoneMessage] = useState(executor.no_zone_message || 'Выберите зону доставки');
  const [saving, setSaving] = useState(false);

  const handleSaveMessage = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('executors')
        .update({ no_zone_message: noZoneMessage })
        .eq('id', executor.id);

      if (error) throw error;

      await logger.info(executor.partner_id, 'executors', 'Обновлено сообщение зоны исполнителя', { executorId: executor.id });
      onSuccess();
    } catch (error) {
      console.error('Error updating no zone message:', error);
      await logger.error(executor.partner_id, 'executors', 'Ошибка обновления сообщения зоны', { executorId: executor.id, error: String(error) });
      alert('Ошибка при сохранении сообщения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">Зоны доставки: {executor.name}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          <PerformerZoneManager
            performerId={executor.id}
            noZoneMessage={noZoneMessage}
            onNoZoneMessageChange={(message) => {
              setNoZoneMessage(message);
              handleSaveMessage();
            }}
          />
        </div>

        <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
