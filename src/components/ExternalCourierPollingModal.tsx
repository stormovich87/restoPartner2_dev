import { useState, useEffect } from 'react';
import { X, Send, Calendar, Clock, MessageSquare, Users, Check, Plus, Trash2, HelpCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ExternalCourierPollingModalProps {
  partnerId: string;
  onClose: () => void;
}

interface Courier {
  id: string;
  name: string;
  lastname?: string;
  telegram_user_id?: string;
  is_active: boolean;
}

interface FollowupQuestion {
  question: string;
  options: string[];
}

interface PollingSettings {
  external_courier_polling_enabled: boolean;
  external_courier_polling_schedule: {
    days: number[];
    time: string;
  };
  external_courier_polling_message: string;
  external_courier_polling_agree_button: string;
  external_courier_polling_decline_button: string;
  external_courier_polling_success_message: string;
  external_courier_polling_join_button: string;
  external_courier_final_button_url?: string;
  external_courier_polling_followup_questions?: FollowupQuestion[];
  external_courier_polling_selected_couriers?: string[] | null;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' },
];

export default function ExternalCourierPollingModal({ partnerId, onClose }: ExternalCourierPollingModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedCouriers, setSelectedCouriers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [showCourierSelector, setShowCourierSelector] = useState(false);
  const [settings, setSettings] = useState<PollingSettings>({
    external_courier_polling_enabled: false,
    external_courier_polling_schedule: { days: [1, 2, 3, 4, 5, 6, 0], time: '09:00' },
    external_courier_polling_message: 'Вы сегодня готовы принимать заказы?',
    external_courier_polling_agree_button: 'Да, готов',
    external_courier_polling_decline_button: 'Нет, не сегодня',
    external_courier_polling_success_message: 'Отлично! Вы добавлены в список активных курьеров на сегодня.',
    external_courier_polling_join_button: 'Перейти в группу заказов',
    external_courier_polling_followup_questions: [],
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [partnerId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [settingsRes, couriersRes] = await Promise.all([
        supabase
          .from('partner_settings')
          .select(`
            external_courier_polling_enabled,
            external_courier_polling_schedule,
            external_courier_polling_message,
            external_courier_polling_agree_button,
            external_courier_polling_decline_button,
            external_courier_polling_success_message,
            external_courier_polling_join_button,
            external_courier_final_button_url,
            external_courier_polling_followup_questions,
            external_courier_polling_selected_couriers
          `)
          .eq('partner_id', partnerId)
          .maybeSingle(),
        supabase
          .from('couriers')
          .select('id, name, lastname, telegram_user_id, is_active')
          .eq('partner_id', partnerId)
          .eq('is_own', false)
          .eq('is_active', true)
          .not('telegram_user_id', 'is', null)
          .order('name')
      ]);

      if (settingsRes.data) {
        setSettings({
          external_courier_polling_enabled: settingsRes.data.external_courier_polling_enabled || false,
          external_courier_polling_schedule: settingsRes.data.external_courier_polling_schedule || { days: [1, 2, 3, 4, 5, 6, 0], time: '09:00' },
          external_courier_polling_message: settingsRes.data.external_courier_polling_message || 'Вы сегодня готовы принимать заказы?',
          external_courier_polling_agree_button: settingsRes.data.external_courier_polling_agree_button || 'Да, готов',
          external_courier_polling_decline_button: settingsRes.data.external_courier_polling_decline_button || 'Нет, не сегодня',
          external_courier_polling_success_message: settingsRes.data.external_courier_polling_success_message || 'Отлично! Вы добавлены в список активных курьеров на сегодня.',
          external_courier_polling_join_button: settingsRes.data.external_courier_polling_join_button || 'Перейти в группу заказов',
          external_courier_final_button_url: settingsRes.data.external_courier_final_button_url,
          external_courier_polling_followup_questions: settingsRes.data.external_courier_polling_followup_questions || [],
          external_courier_polling_selected_couriers: settingsRes.data.external_courier_polling_selected_couriers,
        });
      }

      if (couriersRes.data) {
        setCouriers(couriersRes.data);

        // Load saved courier selection
        const savedCouriers = settingsRes.data?.external_courier_polling_selected_couriers;
        if (savedCouriers && savedCouriers.length > 0) {
          // Filter to only include couriers that still exist and are active
          const validSavedCouriers = savedCouriers.filter(id =>
            couriersRes.data.some(c => c.id === id)
          );
          setSelectedCouriers(validSavedCouriers);
          setSelectAll(validSavedCouriers.length === couriersRes.data.length);
        } else {
          // Default: select all couriers
          setSelectedCouriers(couriersRes.data.map(c => c.id));
          setSelectAll(true);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Ошибка загрузки данных' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const { error } = await supabase
        .from('partner_settings')
        .update({
          external_courier_polling_enabled: settings.external_courier_polling_enabled,
          external_courier_polling_schedule: settings.external_courier_polling_schedule,
          external_courier_polling_message: settings.external_courier_polling_message,
          external_courier_polling_agree_button: settings.external_courier_polling_agree_button,
          external_courier_polling_decline_button: settings.external_courier_polling_decline_button,
          external_courier_polling_success_message: settings.external_courier_polling_success_message,
          external_courier_polling_join_button: settings.external_courier_polling_join_button,
          external_courier_polling_followup_questions: settings.external_courier_polling_followup_questions || [],
          external_courier_polling_selected_couriers: selectAll ? null : selectedCouriers,
        })
        .eq('partner_id', partnerId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Настройки сохранены' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Ошибка сохранения настроек' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendPoll = async () => {
    if (selectedCouriers.length === 0) {
      setMessage({ type: 'error', text: 'Выберите хотя бы одного курьера' });
      return;
    }

    try {
      setSending(true);
      setMessage(null);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-courier-polling`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partner_id: partnerId,
            courier_ids: selectAll ? null : selectedCouriers,
            action: 'send_poll',
          }),
        }
      );

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setMessage({
        type: 'success',
        text: `Опрос отправлен ${result.sent_count} курьерам`
      });
    } catch (error) {
      console.error('Error sending poll:', error);
      setMessage({ type: 'error', text: 'Ошибка отправки опроса' });
    } finally {
      setSending(false);
    }
  };

  const toggleDay = (day: number) => {
    const currentDays = settings.external_courier_polling_schedule.days;
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort((a, b) => {
          const order = [1, 2, 3, 4, 5, 6, 0];
          return order.indexOf(a) - order.indexOf(b);
        });

    setSettings({
      ...settings,
      external_courier_polling_schedule: {
        ...settings.external_courier_polling_schedule,
        days: newDays,
      },
    });
  };

  const toggleCourier = (courierId: string) => {
    setSelectedCouriers(prev =>
      prev.includes(courierId)
        ? prev.filter(id => id !== courierId)
        : [...prev, courierId]
    );
    setSelectAll(false);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedCouriers(couriers.map(c => c.id));
    }
  };

  const addQuestion = () => {
    const newQuestions = [...(settings.external_courier_polling_followup_questions || [])];
    newQuestions.push({ question: '', options: [''] });
    setSettings({ ...settings, external_courier_polling_followup_questions: newQuestions });
  };

  const removeQuestion = (index: number) => {
    const newQuestions = [...(settings.external_courier_polling_followup_questions || [])];
    newQuestions.splice(index, 1);
    setSettings({ ...settings, external_courier_polling_followup_questions: newQuestions });
  };

  const updateQuestion = (index: number, question: string) => {
    const newQuestions = [...(settings.external_courier_polling_followup_questions || [])];
    newQuestions[index].question = question;
    setSettings({ ...settings, external_courier_polling_followup_questions: newQuestions });
  };

  const addOption = (questionIndex: number) => {
    const newQuestions = [...(settings.external_courier_polling_followup_questions || [])];
    newQuestions[questionIndex].options.push('');
    setSettings({ ...settings, external_courier_polling_followup_questions: newQuestions });
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const newQuestions = [...(settings.external_courier_polling_followup_questions || [])];
    newQuestions[questionIndex].options.splice(optionIndex, 1);
    setSettings({ ...settings, external_courier_polling_followup_questions: newQuestions });
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const newQuestions = [...(settings.external_courier_polling_followup_questions || [])];
    newQuestions[questionIndex].options[optionIndex] = value;
    setSettings({ ...settings, external_courier_polling_followup_questions: newQuestions });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600">Загрузка...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
          <h3 className="text-2xl font-bold text-gray-900">Опрос сторонних курьеров</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {message && (
            <div className={`p-4 rounded-xl flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Как это работает</h4>
            <p className="text-sm text-blue-700">
              Система отправляет личное сообщение активным сторонним курьерам с вопросом о готовности принимать заказы.
              При согласии курьер добавляется в список активных на сегодня и получает кнопку для перехода в группу заказов.
            </p>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-gray-900">Автоматическая отправка по расписанию</span>
              </div>
              <button
                onClick={() => setSettings({ ...settings, external_courier_polling_enabled: !settings.external_courier_polling_enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.external_courier_polling_enabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.external_courier_polling_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {settings.external_courier_polling_enabled && (
              <div className="space-y-4 pl-7">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Дни недели</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <button
                        key={day.value}
                        onClick={() => toggleDay(day.value)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          settings.external_courier_polling_schedule.days.includes(day.value)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      Время отправки
                    </div>
                  </label>
                  <input
                    type="time"
                    value={settings.external_courier_polling_schedule.time}
                    onChange={(e) => setSettings({
                      ...settings,
                      external_courier_polling_schedule: {
                        ...settings.external_courier_polling_schedule,
                        time: e.target.value,
                      },
                    })}
                    className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900">Настройки сообщения</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Текст сообщения</label>
                <textarea
                  value={settings.external_courier_polling_message}
                  onChange={(e) => setSettings({ ...settings, external_courier_polling_message: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Кнопка "Согласие"</label>
                  <input
                    type="text"
                    value={settings.external_courier_polling_agree_button}
                    onChange={(e) => setSettings({ ...settings, external_courier_polling_agree_button: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Кнопка "Отказ"</label>
                  <input
                    type="text"
                    value={settings.external_courier_polling_decline_button}
                    onChange={(e) => setSettings({ ...settings, external_courier_polling_decline_button: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Сообщение после согласия</label>
                <textarea
                  value={settings.external_courier_polling_success_message}
                  onChange={(e) => setSettings({ ...settings, external_courier_polling_success_message: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Название кнопки перехода в группу</label>
                <input
                  type="text"
                  value={settings.external_courier_polling_join_button}
                  onChange={(e) => setSettings({ ...settings, external_courier_polling_join_button: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ссылка берется из настроек бота сторонних курьеров (Ссылка-приглашение в группу)
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-gray-900">Дополнительные вопросы</span>
              </div>
              <button
                onClick={addQuestion}
                className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Добавить вопрос
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-blue-700">
                Дополнительные вопросы отправляются курьеру после согласия работать. Курьер может выбрать один или несколько вариантов ответа через кнопки в Telegram.
              </p>
            </div>

            {(settings.external_courier_polling_followup_questions || []).length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">
                Дополнительные вопросы не добавлены
              </div>
            ) : (
              <div className="space-y-4">
                {(settings.external_courier_polling_followup_questions || []).map((q, qIndex) => (
                  <div key={qIndex} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <span className="font-medium text-gray-700">Вопрос {qIndex + 1}</span>
                      <button
                        onClick={() => removeQuestion(qIndex)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Удалить вопрос"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Текст вопроса</label>
                        <textarea
                          value={q.question}
                          onChange={(e) => updateQuestion(qIndex, e.target.value)}
                          rows={2}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          placeholder="Например: На каком транспорте вы сегодня?"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">Варианты ответов</label>
                          <button
                            onClick={() => addOption(qIndex)}
                            className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors flex items-center gap-1 text-xs font-medium"
                          >
                            <Plus className="w-3 h-3" />
                            Добавить вариант
                          </button>
                        </div>

                        <div className="space-y-2">
                          {q.options.map((option, oIndex) => (
                            <div key={oIndex} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder={`Вариант ${oIndex + 1}`}
                              />
                              {q.options.length > 1 && (
                                <button
                                  onClick={() => removeOption(qIndex, oIndex)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Удалить вариант"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-gray-900">Отправить опрос вручную</span>
              </div>
              <button
                onClick={() => setShowCourierSelector(!showCourierSelector)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {showCourierSelector ? 'Скрыть выбор' : 'Выбрать курьеров'}
              </button>
            </div>

            {showCourierSelector && (
              <div className="mb-4 bg-gray-50 rounded-xl p-4 space-y-3 max-h-64 overflow-y-auto">
                <label className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer border-b border-gray-200 pb-3 mb-2">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <span className="font-semibold text-gray-900">Выбрать всех ({couriers.length})</span>
                </label>

                {couriers.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    Нет активных сторонних курьеров с Telegram
                  </p>
                ) : (
                  couriers.map(courier => (
                    <label key={courier.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectAll || selectedCouriers.includes(courier.id)}
                        disabled={selectAll}
                        onChange={() => toggleCourier(courier.id)}
                        className="w-5 h-5 text-blue-600 rounded disabled:opacity-50"
                      />
                      <span className="text-gray-700">
                        {courier.name} {courier.lastname || ''}
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}

            <button
              onClick={handleSendPoll}
              disabled={sending || couriers.length === 0}
              className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Отправка...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Отправить запрос об активности
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {selectAll
                ? `Будет отправлено всем активным курьерам (${couriers.length})`
                : `Выбрано курьеров: ${selectedCouriers.length}`}
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
          >
            Закрыть
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Сохранение...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Сохранить настройки
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
