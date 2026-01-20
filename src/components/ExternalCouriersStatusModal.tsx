import { useState, useEffect } from 'react';
import { X, Check, XCircle, Clock, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ExternalCouriersStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerId: string;
}

interface CourierStatus {
  id: string;
  name: string;
  lastname: string;
  phone: string | null;
  vehicle_type: string;
  status: 'active' | 'declined' | 'no_response';
  followup_answers?: { [key: string]: string };
}

interface FollowupQuestion {
  question: string;
  options: string[];
}

export default function ExternalCouriersStatusModal({ isOpen, onClose, partnerId }: ExternalCouriersStatusModalProps) {
  const [loading, setLoading] = useState(true);
  const [activeCouriers, setActiveCouriers] = useState<CourierStatus[]>([]);
  const [declinedCouriers, setDeclinedCouriers] = useState<CourierStatus[]>([]);
  const [noResponseCouriers, setNoResponseCouriers] = useState<CourierStatus[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'declined' | 'no_response'>('active');
  const [followupQuestions, setFollowupQuestions] = useState<FollowupQuestion[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<{ [questionIndex: number]: string[] }>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    console.log('ExternalCouriersStatusModal useEffect:', { isOpen, partnerId });
    if (isOpen && partnerId) {
      loadCourierStatuses();
    }
  }, [isOpen, partnerId]);

  const loadCourierStatuses = async () => {
    if (!partnerId) {
      console.log('No partner ID available');
      setLoading(false);
      return;
    }

    console.log('Loading courier statuses for partner:', partnerId);
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log('Today date:', today);

      const { data: settings } = await supabase
        .from('partner_settings')
        .select('external_courier_polling_followup_questions')
        .eq('partner_id', partnerId)
        .maybeSingle();

      setFollowupQuestions(settings?.external_courier_polling_followup_questions || []);

      const { data: allCouriers, error: couriersError } = await supabase
        .from('couriers')
        .select('id, name, lastname, phone, vehicle_type')
        .eq('partner_id', partnerId)
        .eq('is_own', false)
        .eq('is_active', true)
        .order('name');

      console.log('All couriers:', allCouriers, 'Error:', couriersError);
      if (couriersError) throw couriersError;

      const { data: responses, error: responsesError } = await supabase
        .from('external_courier_polling_responses')
        .select('courier_id, is_active, followup_answers, responded_at, created_at')
        .eq('partner_id', partnerId)
        .eq('response_date', today)
        .order('created_at', { ascending: false });

      console.log('Responses:', responses, 'Error:', responsesError);
      if (responsesError) throw responsesError;

      // Get only the latest response for each courier
      const latestResponseMap = new Map<string, { is_active: boolean, followup_answers: any, responded_at: string | null }>();
      responses?.forEach(r => {
        if (!latestResponseMap.has(r.courier_id)) {
          latestResponseMap.set(r.courier_id, {
            is_active: r.is_active,
            followup_answers: r.followup_answers,
            responded_at: r.responded_at
          });
        }
      });

      const active: CourierStatus[] = [];
      const declined: CourierStatus[] = [];
      const noResponse: CourierStatus[] = [];

      allCouriers?.forEach(courier => {
        const courierStatus: CourierStatus = {
          id: courier.id,
          name: courier.name,
          lastname: courier.lastname || '',
          phone: courier.phone,
          vehicle_type: courier.vehicle_type || '',
          status: 'no_response'
        };

        const responseData = latestResponseMap.get(courier.id);

        if (responseData && responseData.responded_at) {
          // Courier has responded to the latest poll
          courierStatus.followup_answers = responseData.followup_answers || {};

          if (responseData.is_active) {
            courierStatus.status = 'active';
            active.push(courierStatus);
          } else {
            courierStatus.status = 'declined';
            declined.push(courierStatus);
          }
        } else {
          // Courier hasn't responded to the latest poll
          noResponse.push(courierStatus);
        }
      });

      console.log('Final results:', {
        active: active.length,
        declined: declined.length,
        noResponse: noResponse.length
      });

      setActiveCouriers(active);
      setDeclinedCouriers(declined);
      setNoResponseCouriers(noResponse);
    } catch (error) {
      console.error('Error loading courier statuses:', error);
    } finally {
      console.log('Loading completed');
      setLoading(false);
    }
  };

  const getVehicleTypeName = (type: string) => {
    switch (type) {
      case 'пеший': return 'Пеший';
      case 'велосипед': return 'Велосипед';
      case 'мотоцикл': return 'Мотоцикл';
      case 'авто': return 'Авто';
      default: return type;
    }
  };

  const toggleFilter = (questionIndex: number, option: string) => {
    setSelectedFilters(prev => {
      const currentFilters = prev[questionIndex] || [];
      const newFilters = currentFilters.includes(option)
        ? currentFilters.filter(o => o !== option)
        : [...currentFilters, option];

      if (newFilters.length === 0) {
        const { [questionIndex]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [questionIndex]: newFilters };
    });
  };

  const clearFilters = () => {
    setSelectedFilters({});
  };

  const filterCouriers = (couriers: CourierStatus[]) => {
    if (Object.keys(selectedFilters).length === 0) {
      return couriers;
    }

    return couriers.filter(courier => {
      if (!courier.followup_answers) return false;

      return Object.entries(selectedFilters).every(([qIndex, selectedOptions]) => {
        const courierAnswer = courier.followup_answers?.[qIndex];
        if (!courierAnswer) return false;
        return selectedOptions.includes(courierAnswer);
      });
    });
  };

  if (!isOpen) return null;

  const hasActiveFilters = Object.keys(selectedFilters).length > 0;
  const baseCouriers = activeTab === 'active' ? activeCouriers : activeTab === 'declined' ? declinedCouriers : noResponseCouriers;
  const currentCouriers = activeTab === 'active' ? filterCouriers(baseCouriers) : baseCouriers;
  const filteredActiveCouriers = filterCouriers(activeCouriers);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Статус сторонних курьеров</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'active'
                ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Check className="w-5 h-5" />
            Активные ({hasActiveFilters ? `${filteredActiveCouriers.length}/${activeCouriers.length}` : activeCouriers.length})
          </button>
          <button
            onClick={() => setActiveTab('declined')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'declined'
                ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <XCircle className="w-5 h-5" />
            Отказались ({declinedCouriers.length})
          </button>
          <button
            onClick={() => setActiveTab('no_response')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'no_response'
                ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Clock className="w-5 h-5" />
            Не ответили ({noResponseCouriers.length})
          </button>
        </div>

        {activeTab === 'active' && followupQuestions.length > 0 && (
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="px-6 py-3">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-teal-600 transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  Фильтры по ответам
                  {hasActiveFilters && (
                    <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full">
                      {Object.keys(selectedFilters).length}
                    </span>
                  )}
                </button>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                  >
                    Сбросить
                  </button>
                )}
              </div>

              {showFilters && (
                <div className="space-y-3">
                  {followupQuestions.map((question, qIndex) => (
                    <div key={qIndex} className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs font-medium text-gray-700 mb-2">
                        {question.question}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {question.options.map((option, oIndex) => {
                          const isSelected = selectedFilters[qIndex]?.includes(option);
                          return (
                            <button
                              key={oIndex}
                              onClick={() => toggleFilter(qIndex, option)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                isSelected
                                  ? 'bg-teal-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Загрузка...</p>
            </div>
          ) : currentCouriers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {activeTab === 'active' && 'Нет активных курьеров'}
                {activeTab === 'declined' && 'Никто не отказался'}
                {activeTab === 'no_response' && 'Все курьеры ответили'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentCouriers.map((courier) => (
                <div
                  key={courier.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    activeTab === 'active'
                      ? 'border-teal-200 bg-teal-50/50 hover:bg-teal-50'
                      : activeTab === 'declined'
                      ? 'border-red-200 bg-red-50/50 hover:bg-red-50'
                      : 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-800">
                          {courier.name} {courier.lastname}
                        </h3>
                        {activeTab === 'active' && (
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full font-medium">
                            Активен
                          </span>
                        )}
                        {activeTab === 'declined' && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                            Отказался
                          </span>
                        )}
                        {activeTab === 'no_response' && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                            Не ответил
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {courier.phone && (
                          <span className="flex items-center gap-1">
                            <span className="text-gray-400">Тел:</span>
                            {courier.phone}
                          </span>
                        )}
                        {courier.vehicle_type && (
                          <span className="flex items-center gap-1">
                            <span className="text-gray-400">Транспорт:</span>
                            {getVehicleTypeName(courier.vehicle_type)}
                          </span>
                        )}
                      </div>

                      {activeTab === 'active' && courier.followup_answers && Object.keys(courier.followup_answers).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs font-medium text-gray-500 mb-2">Ответы на вопросы:</div>
                          <div className="space-y-1">
                            {Object.entries(courier.followup_answers).map(([qIndex, answer]) => {
                              const questionIdx = parseInt(qIndex);
                              const question = followupQuestions[questionIdx];
                              return (
                                <div key={qIndex} className="text-xs">
                                  <span className="text-gray-500">{question?.question || `Вопрос ${questionIdx + 1}`}:</span>
                                  <span className="ml-2 font-medium text-gray-700">{answer}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
