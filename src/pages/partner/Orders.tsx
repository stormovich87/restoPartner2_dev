import { useState, useEffect, useMemo } from 'react';
import { Clock, Plus, X, Eye, Navigation, CreditCard as Edit, MessageSquare, User, Bike, Trash2, ChevronUp, ChevronDown, Building2, Car, Users, ArrowLeft, Phone, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import CreateOrderModal from '../../components/CreateOrderModal';
import EditOrderModal from '../../components/EditOrderModal';
import OrderStatusModal from '../../components/OrderStatusModal';
import CallHistory from '../../components/CallHistory';
import LostCalls from '../../components/LostCalls';
import type { PerformerDeliveryZone } from '../../types';
import { buildCourierTelegramMessage, buildExecutorTelegramMessage, buildCourierPrivateMessage } from '../../lib/orderMessageBuilder';

interface ExecutorBadgeProps {
  executor: {
    id: string;
    name: string;
    own_couriers: boolean;
    telegram_bot_token: string | null;
    telegram_chat_id: string | null;
  };
  orderExecutorId: string;
  readinessMinutes: number | null;
  readinessStartedAt: string | null;
  readinessCompletedTimeMinutes: number | null;
  orderStatus: string;
  executorStatus: string;
  courierName: string | null;
  etaPickupMinutes: number | null;
  etaPickupAt: string | null;
  onOpenModal: () => void;
  onRemove: () => void;
}

function ExecutorBadge({ executor, orderExecutorId, readinessMinutes, readinessStartedAt, readinessCompletedTimeMinutes, orderStatus, executorStatus, courierName, etaPickupMinutes, etaPickupAt, onOpenModal, onRemove }: ExecutorBadgeProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [frozenTimeSeconds, setFrozenTimeSeconds] = useState<number | null>(null);
  const [etaRemainingSeconds, setEtaRemainingSeconds] = useState<number | null>(null);
  const [etaExpired, setEtaExpired] = useState(false);

  useEffect(() => {
    if (orderStatus === 'completed' && readinessCompletedTimeMinutes !== null) {
      setFrozenTimeSeconds(readinessCompletedTimeMinutes * 60);
      return;
    }

    // Hide timer when order is en_route or completed (unless showing final time)
    if (orderStatus === 'en_route') {
      setRemainingSeconds(null);
      setIsExpired(false);
      setFrozenTimeSeconds(null);
      return;
    }

    if (orderStatus === 'completed' && readinessCompletedTimeMinutes === null) {
      setRemainingSeconds(null);
      setIsExpired(false);
      setFrozenTimeSeconds(null);
      return;
    }

    if (!readinessMinutes || !readinessStartedAt) {
      setRemainingSeconds(null);
      setIsExpired(false);
      return;
    }

    const calculateRemaining = () => {
      const startTime = new Date(readinessStartedAt).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const totalSeconds = readinessMinutes * 60;
      const remaining = totalSeconds - elapsedSeconds;

      if (remaining <= 0) {
        setRemainingSeconds(0);
        setIsExpired(true);
      } else {
        setRemainingSeconds(remaining);
        setIsExpired(false);
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);

    return () => clearInterval(interval);
  }, [readinessMinutes, readinessStartedAt, readinessCompletedTimeMinutes, orderStatus]);

  useEffect(() => {
    if (!etaPickupAt || orderStatus === 'completed') {
      setEtaRemainingSeconds(null);
      setEtaExpired(false);
      return;
    }

    const calculateEtaRemaining = () => {
      const pickupTime = new Date(etaPickupAt).getTime();
      const now = Date.now();
      const remaining = Math.floor((pickupTime - now) / 1000);

      if (remaining <= 0) {
        setEtaRemainingSeconds(0);
        setEtaExpired(true);
      } else {
        setEtaRemainingSeconds(remaining);
        setEtaExpired(false);
      }
    };

    calculateEtaRemaining();
    const interval = setInterval(calculateEtaRemaining, 1000);

    return () => clearInterval(interval);
  }, [etaPickupAt, orderStatus]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isCompleted = orderStatus === 'completed';
  const isEnRoute = orderStatus === 'en_route';
  const isAssigned = executorStatus === 'assigned';
  const bgColor = isCompleted ? 'bg-gray-100 border-gray-300' : isAssigned ? 'bg-green-100 border-green-300' : isExpired ? 'bg-red-100 border-red-300' : 'bg-green-100 border-green-300';
  const textColor = isCompleted ? 'text-gray-800' : isAssigned ? 'text-green-800' : isExpired ? 'text-red-800' : 'text-green-800';

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${bgColor} border ${textColor}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!isCompleted) {
            onOpenModal();
          }
        }}
        disabled={isCompleted}
        className={`flex items-center gap-1 ${isCompleted ? 'cursor-not-allowed opacity-70' : 'hover:opacity-70 transition-opacity'}`}
      >
        <span>{courierName || executor.name}</span>
        {frozenTimeSeconds !== null && isCompleted && (
          <span className="flex items-center gap-1 ml-1">
            <Clock className="w-3 h-3" />
            <span>{formatTime(frozenTimeSeconds)}</span>
          </span>
        )}
        {!isCompleted && !isEnRoute && etaRemainingSeconds !== null && (
          <span className="flex items-center gap-1 ml-1">
            <Clock className="w-3 h-3" />
            {etaExpired ? (
              <span className="font-bold text-orange-700">⏰ Время вышло</span>
            ) : (
              <span>⏱ {formatTime(etaRemainingSeconds)}</span>
            )}
          </span>
        )}
        {!isCompleted && !isEnRoute && remainingSeconds !== null && etaRemainingSeconds === null && (
          <span className="flex items-center gap-1 ml-1">
            <Clock className="w-3 h-3" />
            {isExpired ? (
              <span className="font-bold">Время вышло</span>
            ) : (
              <span>{formatTime(remainingSeconds)}</span>
            )}
          </span>
        )}
      </button>
      {!isCompleted && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove();
          }}
          className="ml-1 hover:bg-red-200 rounded px-1 transition-colors flex-shrink-0"
          title="Отменить"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

interface DeliveryTimerProps {
  durationMinutes: number | null;
  enRouteAt: string | null;
  status: 'in_progress' | 'en_route' | 'completed';
  completedAt: string | null;
}

function DeliveryTimer({ durationMinutes, enRouteAt, status, completedAt }: DeliveryTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isDelayed, setIsDelayed] = useState(false);

  useEffect(() => {
    if (!enRouteAt) {
      setElapsedSeconds(0);
      setIsDelayed(false);
      return;
    }

    const calculateElapsed = () => {
      const startTime = new Date(enRouteAt).getTime();
      let endTime: number;

      if (status === 'completed' && completedAt) {
        endTime = new Date(completedAt).getTime();
      } else if (status === 'in_progress') {
        endTime = Date.now();
      } else {
        endTime = Date.now();
      }

      const elapsed = Math.floor((endTime - startTime) / 1000);
      setElapsedSeconds(elapsed);

      if (durationMinutes !== null && elapsed >= durationMinutes * 60) {
        setIsDelayed(true);
      } else {
        setIsDelayed(false);
      }
    };

    calculateElapsed();

    if (status === 'en_route') {
      const interval = setInterval(calculateElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [durationMinutes, enRouteAt, status, completedAt]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!enRouteAt || durationMinutes === null) {
    return null;
  }

  const getTimerStyles = () => {
    if (status === 'completed' || status === 'in_progress') {
      return 'border-gray-300 text-gray-700';
    }
    return isDelayed ? 'bg-red-100 border-red-300 text-red-800' : 'bg-blue-100 border-blue-300 text-blue-800';
  };

  return (
    <div className={`px-2 py-1 rounded-lg text-xs font-semibold border flex items-center gap-2 ${getTimerStyles()}`}>
      <div className="flex items-center gap-1">
        <Navigation className="w-3 h-3" />
        <span>Прогноз: {durationMinutes} мин</span>
      </div>
      <div className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        <span>{formatTime(elapsedSeconds)}</span>
      </div>
      {isDelayed && status === 'en_route' && (
        <span className="font-bold">⚠️ Задержка в дороге</span>
      )}
    </div>
  );
}

interface CompletedOrderStatsProps {
  completedTotalTimeMinutes: number | null;
  durationMinutes: number | null;
  enRouteAt: string | null;
  completedAt: string | null;
}

function CompletedOrderStats({ completedTotalTimeMinutes, durationMinutes, enRouteAt, completedAt }: CompletedOrderStatsProps) {
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  let actualDeliveryMinutes: number | null = null;
  if (enRouteAt && completedAt) {
    const enRouteTime = new Date(enRouteAt).getTime();
    const completedTime = new Date(completedAt).getTime();
    actualDeliveryMinutes = Math.floor((completedTime - enRouteTime) / 60000);
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-700">
      {completedTotalTimeMinutes !== null && (
        <div className="px-2 py-1 border border-gray-300 rounded-lg font-semibold">
          ⏱️ Общее время: {formatTime(completedTotalTimeMinutes)}
        </div>
      )}
      {actualDeliveryMinutes !== null && durationMinutes !== null && (
        <div className="px-2 py-1 border border-gray-300 rounded-lg font-semibold">
          🚗 В дороге: {actualDeliveryMinutes} мин (прогноз: {durationMinutes} мин)
        </div>
      )}
    </div>
  );
}

function OrderRow({
  order,
  onStatusChange,
  onExtraTimeClick,
  onEdit,
  onView,
  onTogglePayment,
  onOpenCourierModal,
  onOpenExecutorModal,
  onRemoveExecutor,
  onOpenStatusModal,
  orderExecutors,
  formatDateTime,
  isOverdue,
  orderCompletionNorm,
  currentTime,
  canRevertOrderStatus,
  openShiftIds
}: {
  order: Order;
  onStatusChange: (id: string, status: 'in_progress' | 'en_route' | 'completed') => void;
  onExtraTimeClick: (orderId: string, currentMinutes: number) => void;
  onEdit: (order: Order) => void;
  onView: (order: Order) => void;
  onTogglePayment: (orderId: string) => void;
  onOpenCourierModal: (orderId: string) => void;
  onOpenExecutorModal: (orderId: string) => void;
  onRemoveExecutor: (orderId: string, executor: OrderExecutor) => void;
  onOpenStatusModal: () => void;
  orderExecutors: OrderExecutor[];
  formatDateTime: (date: string) => string;
  isOverdue: boolean;
  orderCompletionNorm: number;
  currentTime: number;
  canRevertOrderStatus: boolean;
  openShiftIds: string[];
}) {
  const formatElapsedTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [delayMinutes, setDelayMinutes] = useState(0);

  useEffect(() => {
    if (order.status === 'completed') {
      setDelayMinutes(order.accumulated_delay_minutes || 0);
      return;
    }

    if (!order.delay_started_at) {
      setDelayMinutes(0);
      return;
    }

    const calculateDelay = () => {
      const delayStartTime = new Date(order.delay_started_at!).getTime();
      const now = Date.now();
      const diffMs = now - delayStartTime;
      const runningMinutes = Math.floor(diffMs / 60000);
      const totalMinutes = (order.accumulated_delay_minutes || 0) + runningMinutes;
      setDelayMinutes(totalMinutes > 0 ? totalMinutes : 0);
    };

    calculateDelay();
    const interval = setInterval(calculateDelay, 1000);

    return () => clearInterval(interval);
  }, [order.delay_started_at, order.status, order.accumulated_delay_minutes]);

  useEffect(() => {
    if (order.status === 'completed') {
      setElapsedMinutes(order.completed_total_time_minutes || 0);
      return;
    }

    const calculateElapsed = () => {
      const startTime = new Date(order.accepted_at).getTime();
      const now = Date.now();
      const diffMs = now - startTime;
      const runningMinutes = Math.floor(diffMs / 60000);
      const totalMinutes = (order.accumulated_time_minutes || 0) + runningMinutes;
      setElapsedMinutes(totalMinutes);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);

    return () => clearInterval(interval);
  }, [order.accepted_at, order.status, order.completed_total_time_minutes, order.accumulated_time_minutes]);

  const fullAddress = [
    order.address_line,
    order.floor && `эт. ${order.floor}`,
    order.apartment && `кв. ${order.apartment}`,
    order.entrance && `под. ${order.entrance}`,
    order.intercom && `дом. ${order.intercom}`,
    order.office && `оф. ${order.office}`
  ].filter(Boolean).join(', ');

  return (
    <div className={`backdrop-blur-xl rounded-xl shadow border hover:shadow-lg transition-all overflow-hidden ${
      isOverdue
        ? 'bg-red-50/90 border-red-300'
        : order.status === 'completed'
        ? 'bg-green-50/90 border-green-200/50'
        : 'bg-white/80 border-gray-200/50'
    }`}>
      <div
        className="p-3 cursor-pointer"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          onView(order);
        }}
      >
        <div className="flex flex-wrap items-center gap-2 md:gap-4 mb-2">
          <div className="flex items-center gap-2 flex-shrink-0 text-sm font-semibold text-gray-700">
            <span>№ {order.order_number}</span>
            {order.shift_order_number && (
              <span className="text-gray-500">({order.shift_order_number})</span>
            )}
          </div>

          <div className="flex flex-col items-center gap-0 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (order.status === 'completed' && !canRevertOrderStatus) {
                  return;
                }
                onOpenStatusModal();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={order.status === 'completed' && !canRevertOrderStatus}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex flex-col items-center gap-0 ${
                order.status === 'completed'
                  ? canRevertOrderStatus
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-green-100 text-green-700 opacity-50 cursor-not-allowed'
                  : order.status === 'en_route'
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              }`}
            >
              {order.status === 'completed' && order.completed_at && (
                <span className="text-[9px] text-green-600 font-normal mb-0.5">
                  {formatDateTime(order.completed_at)}
                </span>
              )}
              <span>
                {order.status === 'completed' ? '🟢 Выполнен' :
                 order.status === 'en_route' ? '🔵 В дороге' :
                 '🟡 В работе'}
              </span>
            </button>
            {order.status === 'completed' && !canRevertOrderStatus && (
              <span className="text-[9px] text-gray-500 text-center mt-0.5">
                нет разрешения менять статус заказа обратно
              </span>
            )}
          </div>

          <div className="flex flex-col items-center gap-0 flex-shrink-0">
            <span className="text-lg font-bold text-gray-900">
              {formatElapsedTime(elapsedMinutes)}
            </span>
            <span className="text-[10px] text-gray-500">
              {formatDateTime(order.accepted_at)}
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onExtraTimeClick(order.id, order.extra_time_minutes);
            }}
            disabled={order.status === 'completed'}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Clock className="w-3 h-3" />
            <span className="text-xs">+{order.extra_time_minutes}</span>
          </button>

          <div className="px-2 py-1 border-2 border-gray-300 rounded-lg text-xs font-semibold text-gray-700 flex-shrink-0">
            {order.delivery_type === 'delivery' ? '🚗 Доставка' : '🏪 Самовынос'}
          </div>

          <div className="px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs font-medium text-blue-700 flex-shrink-0">
            {order.scheduled_at ? (
              <>📅 {formatDateTime(order.scheduled_at)}</>
            ) : (
              <>⚡ Сейчас</>
            )}
          </div>

          {order.delay_started_at && (
            <div className="px-2 py-1 bg-red-100 border border-red-300 rounded-lg text-xs font-bold text-red-700 flex-shrink-0">
              ⚠️ {Math.floor(delayMinutes / 60)}ч {delayMinutes % 60}м
            </div>
          )}

          {(order.status === 'en_route' || (order.en_route_at && (order.status === 'in_progress' || order.status === 'completed'))) && (
            <DeliveryTimer
              durationMinutes={order.duration_minutes}
              enRouteAt={order.en_route_at}
              status={order.status}
              completedAt={order.completed_at}
            />
          )}

          {order.status === 'completed' && (
            <CompletedOrderStats
              completedTotalTimeMinutes={order.completed_total_time_minutes}
              durationMinutes={order.duration_minutes}
              enRouteAt={order.en_route_at}
              completedAt={order.completed_at}
            />
          )}

          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <div className="flex flex-col items-end gap-1">
              <div className="text-sm font-bold text-gray-900">
                {order.total_amount} грн
              </div>
              {order.payment_method && (
                <div className="text-xs text-gray-600">
                  {order.payment_method.name}
                </div>
              )}
              {order.payment_method?.method_type === 'cashless' && order.payment_status && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePayment(order.id);
                  }}
                  disabled={order.status === 'completed'}
                  className={`px-2 py-0.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    order.payment_status === 'paid'
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  }`}
                >
                  {order.payment_status === 'paid' ? '🟩 Оплачено' : '⬜ Не оплачено'}
                </button>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(order);
              }}
              disabled={order.status === 'completed'}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors hidden md:block disabled:opacity-50 disabled:cursor-not-allowed"
              title="Редактировать"
            >
              <Edit className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 pl-2">
          {order.branch && (
            <div className="px-2 py-1 bg-gray-100 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 flex-shrink-0">
              🏢 {order.branch.name}
            </div>
          )}

          <span className="truncate max-w-[300px] flex-shrink" title={fullAddress}>
            {fullAddress || order.address || 'Адрес не указан'}
          </span>

          <span className="truncate max-w-[250px] flex-shrink" title={order.order_items_summary}>
            {order.order_items_summary}
          </span>

          {order.manual_completion_reason && (
            <div className="px-2 py-1 bg-orange-100 border border-orange-300 rounded-lg text-xs font-semibold text-orange-800 flex items-center gap-1 flex-shrink-0" title={`Причина ручного перевода: ${order.manual_completion_reason}`}>
              ⚠️ {order.manual_completion_reason}
            </div>
          )}

          {(!order.shift_id || (order.shift_id && !openShiftIds.includes(order.shift_id))) && (
            <div className="px-2 py-1 bg-red-100 border border-red-300 rounded-lg text-xs font-semibold text-red-800 flex items-center gap-1 flex-shrink-0" title={!order.shift_id ? 'Заказ без смены' : 'Заказ из закрытой смены'}>
              🚨 {!order.shift_id ? 'Без смены' : 'Закрытая смена'}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 ml-auto md:ml-0">
            {order.comment && (
              <span className="flex items-center gap-1" title={order.comment}>
                <MessageSquare className="w-3 h-3" />
              </span>
            )}

            {order.delivery_type === 'delivery' && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenCourierModal(order.id);
                  }}
                  disabled={order.status === 'completed'}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                    order.courier_search_started_at
                      ? 'bg-yellow-100 border border-yellow-400 text-yellow-800'
                      : order.courier_id
                      ? 'bg-blue-100 border border-blue-300 text-blue-800 hover:bg-blue-200'
                      : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Назначить курьера"
                >
                  {(() => {
                    const vehicleType = order.courier?.vehicle_type;
                    if (vehicleType === 'car') {
                      return <Car className="w-3.5 h-3.5" />;
                    } else if (vehicleType === 'bicycle' || vehicleType === 'scooter') {
                      return <Bike className="w-3.5 h-3.5" />;
                    } else if (vehicleType === 'on_foot') {
                      return <User className="w-3.5 h-3.5" />;
                    } else {
                      return <Bike className="w-3.5 h-3.5" />;
                    }
                  })()}
                  <span>
                    {order.courier_search_started_at ? (
                      (() => {
                        const searchStartTime = new Date(order.courier_search_started_at).getTime();
                        const elapsedSeconds = Math.floor((Date.now() - searchStartTime) / 1000);
                        const minutes = Math.floor(elapsedSeconds / 60);
                        const seconds = elapsedSeconds % 60;
                        return `поиск ${minutes}:${seconds.toString().padStart(2, '0')}`;
                      })()
                    ) : order.courier?.name ? (
                      `${order.courier.name.toLowerCase()}${order.courier.lastname ? ` ${order.courier.lastname.toLowerCase()}` : ''}`
                    ) : (
                      'назначить'
                    )}
                  </span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenExecutorModal(order.id);
                  }}
                  disabled={order.status === 'completed'}
                  className="w-6 h-6 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Добавить исполнителя"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </>
            )}

            {orderExecutors.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {orderExecutors.map((oe) => (
                  <ExecutorBadge
                    key={oe.id}
                    executor={oe.executor}
                    orderExecutorId={oe.id}
                    readinessMinutes={oe.readiness_minutes}
                    readinessStartedAt={oe.readiness_started_at}
                    readinessCompletedTimeMinutes={oe.readiness_completed_time_minutes}
                    orderStatus={order.status}
                    executorStatus={oe.status}
                    courierName={oe.courier_name}
                    etaPickupMinutes={oe.eta_pickup_minutes}
                    etaPickupAt={oe.eta_pickup_at}
                    onOpenModal={() => onOpenExecutorModal(order.id)}
                    onRemove={() => onRemoveExecutor(order.id, oe)}
                  />
                ))}
              </div>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(order);
              }}
              disabled={order.status === 'completed'}
              className="p-1 hover:bg-gray-100 rounded transition-colors md:hidden disabled:opacity-50 disabled:cursor-not-allowed"
              title="Редактировать"
            >
              <Edit className="w-3 h-3 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PaymentMethod {
  id: string;
  name: string;
  method_type: 'cash' | 'cashless';
}

interface Courier {
  id: string;
  name: string;
  lastname?: string;
  phone: string;
  telegram_username?: string | null;
  telegram_user_id?: string | null;
  vehicle_type?: string;
  branch_id: string;
}

interface Branch {
  id: string;
  name: string;
  telegram_chat_id?: string;
  telegram_bot_token?: string;
}

interface Executor {
  id: string;
  name: string;
  own_couriers: boolean;
  allow_external_couriers: boolean;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  telegram_thread_id: string | null;
  distribute_by_branches: boolean;
  km_calculation_enabled?: boolean;
  price_per_km?: number;
  km_graduation_meters?: number;
}

interface OrderExecutor {
  id: string;
  order_id: string;
  executor_id: string;
  executor: Executor;
  status: 'searching' | 'assigned' | 'completed' | 'cancelled' | 'expired';
  telegram_message_id: string | null;
  courier_private_message_id: string | null;
  sent_at: string | null;
  readiness_minutes: number | null;
  readiness_started_at: string | null;
  readiness_completed_time_minutes: number | null;
  zone_id: string | null;
  courier_id: string | null;
  courier_name: string | null;
  branch_id: string | null;
  eta_pickup_minutes: number | null;
  eta_pickup_at: string | null;
}

interface Order {
  id: string;
  order_number: string;
  shift_order_number?: number;
  shift_id?: string | null;
  branch_id: string;
  branch?: Branch;
  address: string;
  address_line?: string;
  floor?: string;
  apartment?: string;
  entrance?: string;
  intercom?: string;
  office?: string;
  phone: string;
  comment?: string;
  order_items_summary: string;
  delivery_type: 'delivery' | 'pickup';
  courier_id?: string;
  courier?: Courier;
  payment_method_id: string;
  payment_method?: PaymentMethod;
  payment_status?: 'paid' | 'unpaid' | null;
  cash_amount?: number | null;
  accepted_at: string;
  scheduled_at: string | null;
  extra_time_minutes: number;
  total_time_minutes: number;
  total_amount: number;
  completed_at: string | null;
  completed_total_time_minutes: number | null;
  accumulated_time_minutes: number;
  accumulated_delay_minutes: number;
  status: 'in_progress' | 'en_route' | 'completed';
  delay_started_at: string | null;
  telegram_message_id?: string | null;
  courier_message_id?: string | null;
  courier_search_started_at?: string | null;
  duration_minutes?: number | null;
  distance_km?: number | null;
  en_route_at?: string | null;
  manual_completion_reason?: string | null;
  eta_pickup_minutes?: number | null;
  eta_pickup_at?: string | null;
  eta_source?: string | null;
}

interface OrdersProps {
  partnerId: string;
  staffBranchIds?: string[];
  canDeleteOrders?: boolean;
  canRevertOrderStatus?: boolean;
  canSkipOrderStatus?: boolean;
  isSuperAdmin?: boolean;
}

export default function Orders({ partnerId, staffBranchIds, canDeleteOrders = true, canRevertOrderStatus = true, canSkipOrderStatus = true, isSuperAdmin = true }: OrdersProps) {
  const formatElapsedTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  const formatResponseTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)} c`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.round(seconds % 60);
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  };

  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [orderExecutors, setOrderExecutors] = useState<OrderExecutor[]>([]);
  const [performerZones, setPerformerZones] = useState<Map<string, PerformerDeliveryZone[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'en_route' | 'completed'>('all');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<'all' | 'delivery' | 'pickup'>('all');
  const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(new Set());
  const [branchOrder, setBranchOrder] = useState<string[]>([]);
  const [extraTimeModal, setExtraTimeModal] = useState<{ orderId: string; currentMinutes: number } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [courierModalOrderId, setCourierModalOrderId] = useState<string | null>(null);
  const [executorModalOrderId, setExecutorModalOrderId] = useState<string | null>(null);
  const [statusModalOrderId, setStatusModalOrderId] = useState<string | null>(null);
  const [selectedExecutorForConfig, setSelectedExecutorForConfig] = useState<Executor | null>(null);
  const [editingOrderExecutorId, setEditingOrderExecutorId] = useState<string | null>(null);
  const [executorConfig, setExecutorConfig] = useState({
    readinessMinutes: 30,
    comment: '',
    includeComment: false,
    paymentMethodId: '',
    amount: 0,
    zoneId: '',
    deliveryPayer: 'restaurant' as 'restaurant' | 'client'
  });
  const [orderCompletionNorm, setOrderCompletionNorm] = useState<number>(60);
  const [timezone, setTimezone] = useState<string>('UTC');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [openShiftIds, setOpenShiftIds] = useState<string[]>([]);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [showLostCalls, setShowLostCalls] = useState(false);
  const [missedCallsCount, setMissedCallsCount] = useState(0);
  const [lostCallsCount, setLostCallsCount] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadCallCounts();
    loadAvgResponseTime();
    const interval = setInterval(() => {
      loadCallCounts();
      loadAvgResponseTime();
    }, 30000);
    return () => clearInterval(interval);
  }, [partnerId]);

  const loadCallCounts = async () => {
    try {
      const { data: missedData } = await supabase.rpc('get_missed_calls_count', { p_partner_id: partnerId });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { count: lostCount } = await supabase
        .from('binotel_calls')
        .select('*', { count: 'exact', head: true })
        .eq('partner_id', partnerId)
        .eq('call_type', 0)
        .eq('is_missed', true)
        .neq('call_status', 'ANSWER')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      setMissedCallsCount(missedData || 0);
      setLostCallsCount(lostCount || 0);
    } catch (error) {
      console.error('Error loading call counts:', error);
    }
  };

  const loadAvgResponseTime = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: calls, error: callsError } = await supabase
        .from('binotel_calls')
        .select('waitsec, call_status, call_type, completed_at')
        .eq('partner_id', partnerId)
        .eq('call_type', 0)
        .in('call_status', ['ANSWER', 'NOANSWER'])
        .not('completed_at', 'is', null)
        .gte('completed_at', today.toISOString())
        .lt('completed_at', tomorrow.toISOString());

      if (callsError) {
        console.error('Error loading calls for avg response time:', callsError);
        setAvgResponseTime(null);
        return;
      }

      if (!calls || calls.length === 0) {
        setAvgResponseTime(null);
        return;
      }

      const totalWaitSec = calls.reduce((sum, call) => {
        const waitValue = call.waitsec ?? 0;
        return sum + waitValue;
      }, 0);
      const avgSec = totalWaitSec / calls.length;
      setAvgResponseTime(avgSec);
    } catch (error) {
      console.error('Error loading avg response time:', error);
      setAvgResponseTime(null);
    }
  };

  useEffect(() => {
    if (courierModalOrderId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [courierModalOrderId]);

  const isOrderOverdue = (order: Order): boolean => {
    if (order.status === 'completed') return false;

    const scheduledTime = order.scheduled_at ? new Date(order.scheduled_at).getTime() : null;

    if (scheduledTime) {
      return currentTime > scheduledTime;
    } else {
      const acceptedTime = new Date(order.accepted_at).getTime();
      const runningMinutes = Math.floor((currentTime - acceptedTime) / (1000 * 60));
      const totalElapsedMinutes = (order.accumulated_time_minutes || 0) + runningMinutes;
      const totalAllowedMinutes = orderCompletionNorm + (order.extra_time_minutes || 0);

      return totalElapsedMinutes > totalAllowedMinutes;
    }
  };

  useEffect(() => {
    const updateDelayTracking = async () => {
      const updates = orders.map(async (order) => {
        if (order.status === 'completed') return;

        const isOverdue = isOrderOverdue(order);
        const hasDelayStarted = order.delay_started_at !== null;

        if (isOverdue && !hasDelayStarted) {
          await supabase
            .from('orders')
            .update({ delay_started_at: new Date().toISOString() })
            .eq('id', order.id);
        } else if (!isOverdue && hasDelayStarted) {
          const delayStartTime = new Date(order.delay_started_at).getTime();
          const now = Date.now();
          const delayRunningMinutes = Math.floor((now - delayStartTime) / 60000);
          const totalDelayMinutes = (order.accumulated_delay_minutes || 0) + delayRunningMinutes;

          await supabase
            .from('orders')
            .update({
              delay_started_at: null,
              accumulated_delay_minutes: totalDelayMinutes
            })
            .eq('id', order.id);
        }
      });

      await Promise.all(updates);
    };

    if (orders.length > 0) {
      updateDelayTracking();
    }
  }, [currentTime, orders, orderCompletionNorm]);

  useEffect(() => {
    loadData();

    const pollingInterval = setInterval(() => {
      loadData();
    }, 5000);

    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `partner_id=eq.${partnerId}`
        },
        async (payload) => {
          console.log('Realtime order change:', payload);

          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as Order;

            if (staffBranchIds && staffBranchIds.length > 0 && !staffBranchIds.includes(newOrder.branch_id)) {
              return;
            }

            const shouldShow = (
              (newOrder.shift_id && openShiftIds.includes(newOrder.shift_id)) ||
              (!newOrder.shift_id && (newOrder.status === 'in_progress' || newOrder.status === 'en_route')) ||
              (newOrder.shift_id && !openShiftIds.includes(newOrder.shift_id) && (newOrder.status === 'in_progress' || newOrder.status === 'en_route'))
            );

            if (!shouldShow) {
              return;
            }

            const { data: orderWithRelations } = await supabase
              .from('orders')
              .select(`
                *,
                branch:branches(id, name),
                payment_method:payment_methods(id, name, method_type),
                courier:couriers!orders_courier_id_fkey(id, name, lastname, phone, telegram_username, telegram_user_id, vehicle_type)
              `)
              .eq('id', newOrder.id)
              .maybeSingle();

            if (orderWithRelations) {
              setOrders(prev => {
                const exists = prev.some(o => o.id === orderWithRelations.id);
                if (exists) {
                  return prev.map(o => o.id === orderWithRelations.id ? orderWithRelations : o);
                }
                return [orderWithRelations, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedOrder = payload.new as Order;

            if (staffBranchIds && staffBranchIds.length > 0 && !staffBranchIds.includes(updatedOrder.branch_id)) {
              return;
            }

            const shouldShow = (
              (updatedOrder.shift_id && openShiftIds.includes(updatedOrder.shift_id)) ||
              (!updatedOrder.shift_id && (updatedOrder.status === 'in_progress' || updatedOrder.status === 'en_route')) ||
              (updatedOrder.shift_id && !openShiftIds.includes(updatedOrder.shift_id) && (updatedOrder.status === 'in_progress' || updatedOrder.status === 'en_route'))
            );

            if (!shouldShow) {
              setOrders(prev => prev.filter(order => order.id !== updatedOrder.id));
              return;
            }

            const { data: orderWithRelations } = await supabase
              .from('orders')
              .select(`
                *,
                branch:branches(id, name),
                payment_method:payment_methods(id, name, method_type),
                courier:couriers!orders_courier_id_fkey(id, name, lastname, phone, telegram_username, telegram_user_id, vehicle_type)
              `)
              .eq('id', updatedOrder.id)
              .maybeSingle();

            if (orderWithRelations) {
              setOrders(prev => prev.map(order =>
                order.id === orderWithRelations.id ? orderWithRelations : order
              ));
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedOrder = payload.old as Order;
            setOrders(prev => prev.filter(order => order.id !== deletedOrder.id));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_executors'
        },
        async (payload) => {
          console.log('Realtime order_executor change:', payload);

          if (payload.eventType === 'INSERT') {
            const { data: newOE } = await supabase
              .from('order_executors')
              .select(`
                *,
                executor:executors(id, name, own_couriers, telegram_bot_token, telegram_chat_id)
              `)
              .eq('id', payload.new.id)
              .maybeSingle();

            if (newOE) {
              setOrderExecutors(prev => {
                const exists = prev.some(oe => oe.id === newOE.id);
                if (!exists) {
                  return [...prev, newOE];
                }
                return prev;
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const { data: updatedOE } = await supabase
              .from('order_executors')
              .select(`
                *,
                executor:executors(id, name, own_couriers, telegram_bot_token, telegram_chat_id)
              `)
              .eq('id', payload.new.id)
              .maybeSingle();

            if (updatedOE) {
              setOrderExecutors(prev => prev.map(oe =>
                oe.id === updatedOE.id ? updatedOE : oe
              ));
            }
          } else if (payload.eventType === 'DELETE') {
            setOrderExecutors(prev => prev.filter(oe => oe.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts',
          filter: `partner_id=eq.${partnerId}`
        },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'binotel_calls',
          filter: `partner_id=eq.${partnerId}`
        },
        () => {
          loadAvgResponseTime();
          loadCallCounts();
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollingInterval);
      supabase.removeChannel(channel);
    };
  }, [partnerId, staffBranchIds]);

  const loadData = async () => {
    try {
      const [ordersResponse, methodsResponse, branchesResponse, couriersResponse, executorsResponse, orderExecutorsResponse, settingsResponse, shiftsResponse] = await Promise.all([
        supabase
          .from('orders')
          .select(`
            *,
            branch:branches(id, name, address, phone),
            payment_method:payment_methods(id, name, method_type),
            courier:couriers!orders_courier_id_fkey(id, name, lastname, phone, telegram_username, telegram_user_id, vehicle_type)
          `)
          .eq('partner_id', partnerId)
          .order('accepted_at', { ascending: false }),
        supabase
          .from('payment_methods')
          .select('*')
          .eq('partner_id', partnerId)
          .eq('is_active', true),
        supabase
          .from('branches')
          .select('id, name, address, phone, telegram_chat_id, telegram_bot_token')
          .eq('partner_id', partnerId)
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('couriers')
          .select('*')
          .eq('partner_id', partnerId)
          .eq('is_active', true)
          .eq('is_external', false)
          .order('name'),
        supabase
          .from('executors')
          .select('id, name, own_couriers, allow_external_couriers, telegram_bot_token, telegram_chat_id, telegram_thread_id, distribute_by_branches, km_calculation_enabled, price_per_km, km_graduation_meters')
          .eq('partner_id', partnerId)
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('order_executors')
          .select(`
            *,
            executor:executors(id, name, own_couriers, allow_external_couriers, telegram_bot_token, telegram_chat_id)
          `),
        supabase
          .from('partner_settings')
          .select('order_completion_norm_minutes, timezone')
          .eq('partner_id', partnerId)
          .maybeSingle(),
        supabase
          .from('shifts')
          .select('id, branch_id')
          .eq('partner_id', partnerId)
          .eq('status', 'open')
      ]);

      if (ordersResponse.error) throw ordersResponse.error;
      if (methodsResponse.error) throw methodsResponse.error;
      if (branchesResponse.error) throw branchesResponse.error;
      if (couriersResponse.error) throw couriersResponse.error;
      if (executorsResponse.error) throw executorsResponse.error;
      if (orderExecutorsResponse.error) throw orderExecutorsResponse.error;

      const openShifts = shiftsResponse.data || [];
      const currentOpenShiftIds = openShifts.map(s => s.id);
      setOpenShiftIds(currentOpenShiftIds);

      const allBranches = branchesResponse.data || [];
      const filteredBranches = staffBranchIds && staffBranchIds.length > 0
        ? allBranches.filter(b => staffBranchIds.includes(b.id))
        : allBranches;

      const allOrders = ordersResponse.data || [];
      let filteredOrders = allOrders;

      if (staffBranchIds && staffBranchIds.length > 0) {
        filteredOrders = filteredOrders.filter(o => staffBranchIds.includes(o.branch_id));
      }

      filteredOrders = filteredOrders.filter(o => {
        if (o.shift_id && currentOpenShiftIds.includes(o.shift_id)) {
          return true;
        }

        if (!o.shift_id && (o.status === 'in_progress' || o.status === 'en_route')) {
          return true;
        }

        if (o.shift_id && !currentOpenShiftIds.includes(o.shift_id) && (o.status === 'in_progress' || o.status === 'en_route')) {
          return true;
        }

        return false;
      });

      setOrders(filteredOrders);
      setPaymentMethods(methodsResponse.data || []);
      setBranches(filteredBranches);
      setCouriers(couriersResponse.data || []);
      setExecutors(executorsResponse.data || []);
      setOrderExecutors(orderExecutorsResponse.data || []);

      if (executorsResponse.data) {
        const zonesMap = new Map<string, PerformerDeliveryZone[]>();
        for (const executor of executorsResponse.data) {
          const { data } = await supabase
            .from('performer_delivery_zones')
            .select('*')
            .eq('performer_id', executor.id)
            .order('created_at');

          if (data) {
            zonesMap.set(executor.id, data);
          }
        }
        setPerformerZones(zonesMap);
      }

      if (branchesResponse.data && branchOrder.length === 0) {
        setBranchOrder(branchesResponse.data.map(b => b.id));
      }

      if (settingsResponse.data) {
        setOrderCompletionNorm(settingsResponse.data.order_completion_norm_minutes);
        setTimezone(settingsResponse.data.timezone || 'UTC');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      await logger.error(partnerId, 'orders', 'Ошибка загрузки данных заказов', { error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const togglePaymentStatus = async (orderId: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const newPaymentStatus = order.payment_status === 'paid' ? 'unpaid' : 'paid';

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-payment-methods`;

      const response = await fetch(`${apiUrl}?action=toggle-payment-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: orderId,
          partner_id: partnerId,
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      setOrders(prevOrders =>
        prevOrders.map(o =>
          o.id === orderId ? { ...o, payment_status: newPaymentStatus } : o
        )
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, payment_status: newPaymentStatus } : null);
      }

      await logger.info(partnerId, 'orders', `Изменен статус оплаты заказа ${orderId}`, { orderId });
    } catch (error) {
      console.error('Error toggling payment status:', error);
      await logger.error(partnerId, 'orders', 'Ошибка при изменении статуса оплаты', { orderId, error: String(error) });
    }
  };

  const handleRemoveExecutor = async (orderId: string, oe: OrderExecutor) => {
    setOrderExecutors(prev => prev.filter(item => item.id !== oe.id));

    try {
      const { error: deleteError } = await supabase
        .from('order_executors')
        .delete()
        .eq('id', oe.id);

      if (deleteError) {
        console.error('Error deleting order_executor:', deleteError);
        setOrderExecutors(prev => [...prev, oe]);
        alert(`Ошибка при отмене исполнителя: ${deleteError.message}`);
        await logger.error(partnerId, 'executors', 'Ошибка удаления исполнителя из БД', {
          orderId,
          executorId: oe.executor_id,
          orderExecutorId: oe.id,
          error: deleteError.message
        });
        return;
      }

      if (oe.telegram_message_id && oe.executor.telegram_bot_token && oe.executor.telegram_chat_id) {
        try {
          let deleteBotToken = oe.executor.telegram_bot_token;
          let deleteChatId = oe.executor.telegram_chat_id;

          if (oe.branch_id && oe.executor.distribute_by_branches) {
            const { data: branchSettings } = await supabase
              .from('executor_branch_telegram_settings')
              .select('telegram_bot_token, telegram_chat_id')
              .eq('executor_id', oe.executor_id)
              .eq('branch_id', oe.branch_id)
              .maybeSingle();

            if (branchSettings) {
              deleteBotToken = branchSettings.telegram_bot_token || deleteBotToken;
              deleteChatId = branchSettings.telegram_chat_id || deleteChatId;
            }
          }

          const telegramApiUrl = `https://api.telegram.org/bot${deleteBotToken}/deleteMessage`;
          const telegramResponse = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: deleteChatId,
              message_id: parseInt(oe.telegram_message_id, 10)
            })
          });

          const telegramResult = await telegramResponse.json();

          if (!telegramResult.ok) {
            await logger.warning(partnerId, 'telegram', 'Не удалось удалить сообщение исполнителя из Telegram', {
              orderId,
              executorId: oe.executor_id,
              messageId: oe.telegram_message_id,
              error: telegramResult.description
            });
          } else {
            await logger.info(partnerId, 'telegram', 'Удалено сообщение исполнителя из Telegram', {
              orderId,
              executorId: oe.executor_id,
              messageId: oe.telegram_message_id
            });
          }
        } catch (telegramError) {
          console.error('Error deleting telegram message:', telegramError);
          await logger.error(partnerId, 'telegram', 'Ошибка при удалении сообщения исполнителя из Telegram', {
            orderId,
            executorId: oe.executor_id,
            messageId: oe.telegram_message_id,
            error: String(telegramError)
          });
        }
      }

      if (oe.courier_private_message_id && oe.courier_id) {
        try {
          const { data: courier } = await supabase
            .from('couriers')
            .select('telegram_user_id')
            .eq('id', oe.courier_id)
            .maybeSingle();

          if (courier && courier.telegram_user_id) {
            let botToken = oe.executor.telegram_bot_token;

            if (oe.branch_id && oe.executor.distribute_by_branches) {
              const { data: branchSettings } = await supabase
                .from('executor_branch_telegram_settings')
                .select('telegram_bot_token')
                .eq('executor_id', oe.executor_id)
                .eq('branch_id', oe.branch_id)
                .maybeSingle();

              if (branchSettings?.telegram_bot_token) {
                botToken = branchSettings.telegram_bot_token;
              }
            }

            if (botToken) {
              const deletePrivateResponse = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: courier.telegram_user_id,
                  message_id: parseInt(oe.courier_private_message_id, 10)
                })
              });

              const deletePrivateResult = await deletePrivateResponse.json();

              if (deletePrivateResult.ok) {
                await logger.info(partnerId, 'telegram', 'Удалено личное сообщение курьера', {
                  orderId,
                  courierId: oe.courier_id,
                  messageId: oe.courier_private_message_id
                });
              }
            }
          }
        } catch (courierMessageError) {
          console.error('Error deleting courier private message:', courierMessageError);
        }
      }

      await logger.info(partnerId, 'executors', `Исполнитель ${oe.executor.name} отменён`, {
        orderId,
        executorId: oe.executor_id,
        orderExecutorId: oe.id
      });
    } catch (error) {
      console.error('Error removing executor:', error);
      setOrderExecutors(prev => [...prev, oe]);
      await logger.error(partnerId, 'executors', 'Ошибка отмены исполнителя', {
        orderId,
        executorId: oe.executor_id,
        error: String(error)
      });
      alert('Ошибка при отмене исполнителя');
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) {
        console.error('Supabase error:', error);
        await logger.error(partnerId, 'orders', 'Ошибка при удалении заказа', {
          orderId,
          error: error.message || String(error),
          errorCode: error.code,
          errorDetails: error.details
        });
        alert(`Ошибка при удалении заказа: ${error.message}`);
        return;
      }

      setOrders(prevOrders => prevOrders.filter(o => o.id !== orderId));
      await logger.info(partnerId, 'orders', `Заказ ${orderId} удален`, { orderId });
      setDeletingOrderId(null);
      setSelectedOrder(null);
    } catch (error: any) {
      console.error('Error deleting order:', error);
      await logger.error(partnerId, 'orders', 'Ошибка при удалении заказа', {
        orderId,
        error: error?.message || String(error),
        stack: error?.stack
      });
      alert(`Ошибка при удалении заказа: ${error?.message || 'Неизвестная ошибка'}`);
    }
  };

  const addExtraTime = async (orderId: string, minutesToAdd: number) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const newExtraTime = order.extra_time_minutes + minutesToAdd;

      const { error } = await supabase
        .from('orders')
        .update({ extra_time_minutes: newExtraTime })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(prevOrders =>
        prevOrders.map(o =>
          o.id === orderId ? { ...o, extra_time_minutes: newExtraTime } : o
        )
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, extra_time_minutes: newExtraTime } : null);
      }

      await logger.info(partnerId, 'orders', `Добавлено ${minutesToAdd} минут к заказу ${orderId}`, { orderId, minutesToAdd, newExtraTime });
      setExtraTimeModal(null);
    } catch (error) {
      console.error('Error adding extra time:', error);
      await logger.error(partnerId, 'orders', 'Ошибка при добавлении времени', { orderId, minutesToAdd, error: String(error) });
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: 'in_progress' | 'en_route' | 'completed', manualReason?: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      if (newStatus === 'completed' && order.delivery_type !== 'pickup') {
        if (order.courier_id === 'search_courier') {
          alert('Невозможно завершить заказ: необходимо выбрать исполнителя или курьера для завершения заказа');
          await logger.info(partnerId, 'orders', `Попытка завершить заказ ${orderId} с активным поиском курьера`, { orderId });
          return;
        }

        const activeExecutors = orderExecutors.filter(
          oe => oe.order_id === orderId && oe.status !== 'cancelled'
        );

        if (activeExecutors.length > 1) {
          alert('Невозможно завершить заказ: отправлено несколько сообщений исполнителям. Необходимо оставить одного исполнителя для выполнения заказа');
          await logger.info(partnerId, 'orders', `Попытка завершить заказ ${orderId} с несколькими активными исполнителями`, { orderId, activeExecutorsCount: activeExecutors.length });
          return;
        }

        if (!order.courier_id || order.courier_id === 'no_courier') {
          if (activeExecutors.length === 0) {
            alert('Невозможно завершить заказ: необходимо назначить курьера или исполнителя');
            await logger.info(partnerId, 'orders', `Попытка завершить заказ ${orderId} без назначенного курьера или исполнителя`, { orderId });
            return;
          }
        }
      }

      if (newStatus === 'completed' && order.payment_method?.method_type === 'cashless' && order.payment_status !== 'paid') {
        alert('Невозможно завершить заказ: безналичная оплата не произведена');
        await logger.info(partnerId, 'orders', `Попытка завершить заказ ${orderId} с неоплаченной безналичной оплатой`, { orderId });
        return;
      }

      const updates: any = { status: newStatus };

      if (newStatus === 'completed') {
        const startTime = new Date(order.accepted_at).getTime();
        const now = Date.now();
        const runningMinutes = Math.floor((now - startTime) / 60000);
        const totalMinutes = (order.accumulated_time_minutes || 0) + runningMinutes;

        updates.completed_at = new Date().toISOString();
        updates.completed_total_time_minutes = totalMinutes;
        updates.accumulated_time_minutes = totalMinutes;

        if (order.delivery_type === 'delivery') {
          const { data: orderData } = await supabase
            .from('orders')
            .select('executor_type, executor_id, executor_zone_id, courier_zone_id, distance_km')
            .eq('id', orderId)
            .maybeSingle();

          if (orderData) {
            let courierPayment: number | null = null;

            if (orderData.executor_type === 'performer' && orderData.executor_zone_id) {
              const { data: zone } = await supabase
                .from('performer_delivery_zones')
                .select('courier_payment, price_uah')
                .eq('id', orderData.executor_zone_id)
                .maybeSingle();

              if (zone) {
                courierPayment = zone.courier_payment ?? zone.price_uah ?? 0;

                const executor = executors.find(e => e.id === orderData.executor_id);
                if (executor?.km_calculation_enabled && orderData.distance_km && executor.price_per_km > 0) {
                  const minDistance = 1;
                  const graduationKm = (executor.km_graduation_meters || 100) / 1000;
                  let calcDistance = Math.max(orderData.distance_km, minDistance);

                  if (graduationKm > 0) {
                    calcDistance = Math.round(calcDistance / graduationKm) * graduationKm;
                    calcDistance = Math.max(calcDistance, minDistance);
                  }

                  const distancePrice = Math.round(calcDistance * executor.price_per_km);
                  courierPayment += distancePrice;
                }
              }
            } else if (orderData.courier_zone_id) {
              const { data: zone } = await supabase
                .from('courier_delivery_zones')
                .select('courier_payment')
                .eq('id', orderData.courier_zone_id)
                .maybeSingle();

              if (zone) {
                courierPayment = zone.courier_payment ?? 0;
              }
            }

            if (courierPayment !== null) {
              updates.courier_payment_amount = courierPayment;
            }
          }
        }

        if (order.delay_started_at) {
          const delayStartTime = new Date(order.delay_started_at).getTime();
          const delayRunningMinutes = Math.floor((now - delayStartTime) / 60000);
          const totalDelayMinutes = (order.accumulated_delay_minutes || 0) + delayRunningMinutes;
          updates.accumulated_delay_minutes = totalDelayMinutes;
        }

        updates.delay_started_at = null;

        if (manualReason) {
          updates.manual_completion_reason = manualReason;
        }

        if (!order.courier_id || order.courier_id === 'no_courier') {
          updates.assignment_status = 'assigned';

          if (order.courier_message_id) {
            try {
              const { data: settings } = await supabase
                .from('partner_settings')
                .select('main_telegram_bot_token')
                .eq('partner_id', partnerId)
                .maybeSingle();

              const { data: branch } = await supabase
                .from('branches')
                .select('telegram_chat_id')
                .eq('id', order.branch_id)
                .maybeSingle();

              if (settings?.main_telegram_bot_token && branch?.telegram_chat_id) {
                const deleteResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-telegram-message`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    bot_token: settings.main_telegram_bot_token,
                    chat_id: branch.telegram_chat_id,
                    message_id: parseInt(order.courier_message_id, 10)
                  })
                });

                const deleteResult = await deleteResponse.json();
                if (deleteResult.success) {
                  updates.courier_message_id = null;
                  await logger.info(partnerId, 'telegram', `Удалено сообщение курьера при ручном завершении заказа ${orderId}`, {
                    orderId,
                    messageId: order.courier_message_id
                  });
                } else {
                  await logger.warning(partnerId, 'telegram', `Не удалось удалить сообщение курьера при ручном завершении`, {
                    orderId,
                    error: deleteResult.error
                  });
                }
              }
            } catch (error) {
              console.error('Error deleting courier message on manual completion:', error);
              await logger.error(partnerId, 'telegram', 'Ошибка при удалении сообщения курьера при ручном завершении', {
                orderId,
                error: String(error)
              });
            }
          }

          await logger.info(partnerId, 'orders', `Остановлен поиск курьера при ручном завершении заказа ${orderId}`, { orderId });
        }

        const activeOrderExecutors = orderExecutors.filter(
          oe => oe.order_id === orderId && oe.status !== 'cancelled'
        );
        if (activeOrderExecutors.length === 1) {
          const singleExecutor = activeOrderExecutors[0];
          const { data: currentOrder } = await supabase
            .from('orders')
            .select('executor_type, executor_id')
            .eq('id', orderId)
            .maybeSingle();

          if (!currentOrder?.executor_type || !currentOrder?.executor_id) {
            updates.executor_type = 'performer';
            updates.executor_id = singleExecutor.executor_id;
            if (singleExecutor.zone_id) {
              updates.executor_zone_id = singleExecutor.zone_id;
            }
          }
        }
      } else if (newStatus === 'in_progress') {
        updates.accepted_at = new Date().toISOString();
        updates.completed_at = null;
        updates.manual_completion_reason = null;
        if (order.status === 'completed' && order.completed_total_time_minutes) {
          updates.accumulated_time_minutes = order.completed_total_time_minutes;
        }
        // Clear ETA fields when reverting to in_progress
        if (order.status === 'en_route' || order.status === 'completed') {
          updates.eta_pickup_minutes = null;
          updates.eta_pickup_at = null;
          updates.eta_source = null;
        }
      } else if (newStatus === 'en_route') {
        updates.manual_completion_reason = null;
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;

      // Clear external courier ETA state when reverting to in_progress
      if (newStatus === 'in_progress' && (order.status === 'en_route' || order.status === 'completed')) {
        await supabase
          .from('external_courier_states')
          .delete()
          .eq('order_id', orderId);

        // Clear ETA fields from order_executors
        await supabase
          .from('order_executors')
          .update({
            eta_pickup_minutes: null,
            eta_pickup_at: null
          })
          .eq('order_id', orderId);

        // Update local state
        setOrderExecutors(prevExecutors =>
          prevExecutors.map(oe => {
            if (oe.order_id === orderId) {
              return {
                ...oe,
                eta_pickup_minutes: null,
                eta_pickup_at: null
              };
            }
            return oe;
          })
        );
      }

      // Stop executor timers when status changes to en_route or completed
      if (newStatus === 'en_route' || newStatus === 'completed') {
        const activeExecutors = orderExecutors.filter(
          oe => oe.order_id === orderId && oe.status !== 'cancelled'
        );

        for (const oe of activeExecutors) {
          const updateData: any = { readiness_started_at: null };

          // Calculate elapsed time if timer was running
          if (oe.readiness_started_at) {
            const startedAt = new Date(oe.readiness_started_at).getTime();
            const now = Date.now();
            const elapsedMinutes = Math.floor((now - startedAt) / 60000);

            if (newStatus === 'completed') {
              updateData.readiness_completed_time_minutes = elapsedMinutes;
            }
          }

          if (newStatus === 'completed') {
            // Clear ETA fields when order is completed
            updateData.eta_pickup_minutes = null;
            updateData.eta_pickup_at = null;
          }

          await supabase
            .from('order_executors')
            .update(updateData)
            .eq('id', oe.id);
        }

        setOrderExecutors(prevExecutors =>
          prevExecutors.map(oe => {
            if (oe.order_id === orderId && oe.status !== 'cancelled') {
              const updates: any = {
                readiness_started_at: null
              };

              // Calculate elapsed time if timer was running
              if (oe.readiness_started_at) {
                const startedAt = new Date(oe.readiness_started_at).getTime();
                const now = Date.now();
                const elapsedMinutes = Math.floor((now - startedAt) / 60000);

                if (newStatus === 'completed') {
                  updates.readiness_completed_time_minutes = elapsedMinutes;
                }
              }

              if (newStatus === 'completed') {
                // Clear ETA fields when order is completed
                updates.eta_pickup_minutes = null;
                updates.eta_pickup_at = null;
              }

              return {
                ...oe,
                ...updates
              };
            }
            return oe;
          })
        );
      }

      setOrders(prevOrders =>
        prevOrders.map(o =>
          o.id === orderId ? { ...o, ...updates } : o
        )
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, ...updates } : null);
      }

      await logger.info(partnerId, 'orders', `Обновлен статус заказа ${orderId} на ${newStatus}`, { orderId, newStatus });
    } catch (error) {
      console.error('Error updating order status:', error);
      await logger.error(partnerId, 'orders', 'Ошибка при обновлении статуса заказа', { orderId, newStatus, error: String(error) });
    }
  };

  const deleteCourierMessage = async (order: Order, botToken: string) => {
    if (!order.courier_message_id || !order.courier?.telegram_user_id) return;

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: order.courier.telegram_user_id,
          message_id: order.courier_message_id
        })
      });

      const result = await response.json();
      if (result.ok) {
        await logger.info(partnerId, 'telegram', `Удалено личное сообщение у курьера ${order.courier.name}`, {
          orderId: order.id,
          courierId: order.courier_id,
          messageId: order.courier_message_id
        });
      } else {
        await logger.warning(partnerId, 'telegram', `Не удалось удалить личное сообщение у курьера ${order.courier.name}`, {
          orderId: order.id,
          courierId: order.courier_id,
          error: result.description
        });
      }
    } catch (error) {
      console.error('Error deleting courier message:', error);
      await logger.error(partnerId, 'telegram', 'Ошибка при удалении личного сообщения курьера', {
        orderId: order.id,
        error: String(error)
      });
    }
  };

  const updateOrderCourier = async (orderId: string, courierId: string | null) => {
    try {
      const order = orders.find(o => o.id === orderId);
      const newCourier = courierId ? couriers.find(c => c.id === courierId) : null;

      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId
            ? { ...order, courier_id: courierId, courier: newCourier || null, telegram_message_id: null, courier_message_id: null, courier_search_started_at: null }
            : order
        )
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, courier_id: courierId, courier: newCourier || null, telegram_message_id: null, courier_message_id: null, courier_search_started_at: null } : null);
      }

      const { data: settings } = await supabase
        .from('partner_settings')
        .select('courier_bot_token')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (order?.telegram_message_id) {
        cancelCourierSearch(orderId).catch(err => console.error('Error canceling courier search:', err));
      }

      console.log('updateOrderCourier conditions:', {
        courierId,
        courier_message_id: order?.courier_message_id,
        telegram_user_id: order?.courier?.telegram_user_id,
        has_bot_token: !!settings?.courier_bot_token,
        order: order ? 'exists' : 'missing'
      });

      if (courierId === null && order?.courier_message_id && order.courier?.telegram_user_id && settings?.courier_bot_token) {
        console.log('✅ All conditions met, attempting to delete courier message:', {
          courier_message_id: order.courier_message_id,
          telegram_user_id: order.courier.telegram_user_id,
          has_bot_token: !!settings.courier_bot_token
        });

        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-telegram-message`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bot_token: settings.courier_bot_token,
              chat_id: order.courier.telegram_user_id,
              message_id: parseInt(order.courier_message_id, 10)
            })
          });

          console.log('Delete message response status:', response.status);

          const result = await response.json();
          console.log('Delete message result:', result);

          if (result.success || response.ok) {
            console.log('✅ Successfully deleted courier message');
            await logger.info(partnerId, 'telegram', `Удалено личное сообщение у курьера при снятии с заказа`, {
              orderId: order.id,
              courierId: order.courier_id,
              courierName: `${order.courier.name} ${order.courier.lastname || ''}`.trim(),
              messageId: order.courier_message_id
            });
          } else {
            console.error('❌ Failed to delete courier message:', result);
            await logger.warning(partnerId, 'telegram', `Не удалось удалить личное сообщение у курьера при снятии с заказа`, {
              orderId: order.id,
              courierId: order.courier_id,
              courierName: `${order.courier.name} ${order.courier.lastname || ''}`.trim(),
              error: result.error || result.telegram_error?.description || 'Unknown error'
            });
          }
        } catch (err) {
          console.error('Error deleting old courier message:', err);
          await logger.error(partnerId, 'telegram', 'Ошибка при удалении личного сообщения курьера при снятии с заказа', {
            orderId: order.id,
            error: String(err)
          });
        }
      } else if (courierId === null) {
        console.log('⚠️ Skipping message deletion. Missing:', {
          courier_message_id: !order?.courier_message_id,
          telegram_user_id: !order?.courier?.telegram_user_id,
          bot_token: !settings?.courier_bot_token
        });
      }

      const updateData: any = {
        courier_id: courierId,
        telegram_message_id: null,
        courier_message_id: null,
        courier_search_started_at: null
      };

      if (courierId === null) {
        updateData.executor_id = null;
        updateData.executor_type = null;
        updateData.assignment_status = null;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) {
        setOrders(prevOrders =>
          prevOrders.map(o =>
            o.id === orderId ? order! : o
          )
        );
        throw error;
      }

      if (courierId === null && order?.courier) {
        await logger.info(partnerId, 'orders', `Курьер снят с заказа через кнопку "Без курьера"`, {
          orderId: order.id,
          orderNumber: order.shift_order_number || order.order_number,
          removedCourierId: order.courier_id,
          removedCourierName: `${order.courier.name} ${order.courier.lastname || ''}`.trim()
        });
      }

      if (newCourier && newCourier.telegram_user_id && order && settings?.courier_bot_token) {
        const { data: orderItemsData } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', orderId);

        const message = buildCourierPrivateMessage({
          order,
          branch: order.branch,
          distanceKm: order.distance_km,
          durationMinutes: order.duration_minutes,
          paymentMethod: order.payment_method,
          paymentStatus: order.payment_status,
          orderItems: orderItemsData || undefined,
          deliveryPrice: order.delivery_price_uah,
          paymentBreakdown: order.payment_breakdown
        });

        try {
          const response = await fetch(`https://api.telegram.org/bot${settings.courier_bot_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: newCourier.telegram_user_id,
              text: message,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🚗 Выехал',
                      callback_data: `en_route_${orderId}`
                    },
                    {
                      text: '✅ Выполнено',
                      callback_data: `complete_${orderId}`
                    }
                  ],
                  [
                    {
                      text: '❌ Отменить заказ',
                      callback_data: `cancel_order_${orderId}`
                    }
                  ]
                ]
              }
            })
          });

          const result = await response.json();
          if (result.ok && result.result?.message_id) {
            const messageId = String(result.result.message_id);

            await supabase
              .from('orders')
              .update({ courier_message_id: messageId })
              .eq('id', orderId);

            setOrders(prevOrders =>
              prevOrders.map(o =>
                o.id === orderId ? { ...o, courier_message_id: messageId } : o
              )
            );

            if (selectedOrder && selectedOrder.id === orderId) {
              setSelectedOrder(prev => prev ? { ...prev, courier_message_id: messageId } : null);
            }

            await logger.info(partnerId, 'telegram', `Отправлено уведомление курьеру ${newCourier.name}`, {
              orderId,
              courierId,
              telegramUserId: newCourier.telegram_user_id,
              messageId
            });
          } else {
            await logger.warning(partnerId, 'telegram', `Не удалось отправить уведомление курьеру ${newCourier.name}`, {
              orderId,
              courierId,
              error: result.description
            });
          }
        } catch (telegramError) {
          console.error('Error sending telegram message:', telegramError);
          await logger.error(partnerId, 'telegram', 'Ошибка при отправке уведомления курьеру', {
            orderId,
            courierId,
            error: String(telegramError)
          });
        }
      }

      await logger.info(partnerId, 'orders', `Обновлен курьер для заказа ${orderId}`, { orderId, courierId });
    } catch (error) {
      console.error('Error updating order courier:', error);
      await logger.error(partnerId, 'orders', 'Ошибка при обновлении курьера заказа', { orderId, courierId, error: String(error) });
    }
  };

  const searchCourier = async (orderId: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order || !order.branch) {
        alert('Не удалось найти данные заказа');
        return;
      }

      const branch = branches.find(b => b.id === order.branch_id);
      if (!branch?.telegram_chat_id || !branch?.telegram_bot_token) {
        alert('Telegram не настроен для этого филиала. Проверьте настройки филиала (Bot Token и Chat ID)');
        await logger.warning(partnerId, 'orders', `Попытка поиска курьера для филиала ${branch?.name} без Telegram`, {
          orderId,
          branchId: order.branch_id,
          hasChatId: !!branch?.telegram_chat_id,
          hasBotToken: !!branch?.telegram_bot_token
        });
        return;
      }

      const { data: settings } = await supabase
        .from('partner_settings')
        .select('courier_bot_token')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (order && settings?.courier_bot_token) {
        await deleteCourierMessage(order, settings.courier_bot_token);
      }

      const { data: orderItemsData } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      const message = buildCourierTelegramMessage({
        order,
        branch: order.branch,
        distanceKm: order.distance_km,
        durationMinutes: order.duration_minutes,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        orderItems: orderItemsData || undefined,
        deliveryPrice: order.delivery_price_uah,
        paymentBreakdown: order.payment_breakdown
      });

      await logger.info(partnerId, 'telegram', `Отправка уведомления о поиске курьера`, {
        orderId,
        branchId: order.branch_id,
        chatId: branch.telegram_chat_id,
        messageLength: message.length
      });

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram-message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bot_token: branch.telegram_bot_token,
          chat_id: branch.telegram_chat_id,
          message,
          inline_keyboard: [
            [{ text: '✅ Принять заказ', callback_data: `accept_order_${orderId}` }]
          ]
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        await logger.error(partnerId, 'telegram', `Ошибка отправки в Telegram (HTTP ${response.status})`, {
          orderId,
          branchId: order.branch_id,
          chatId: branch.telegram_chat_id,
          status: response.status,
          statusText: response.statusText,
          responseBody: JSON.stringify(responseData)
        });
        throw new Error(`Ошибка отправки в Telegram: ${response.status} - ${JSON.stringify(responseData)}`);
      }

      const messageId = responseData?.telegram_response?.result?.message_id;
      const searchStartTime = new Date().toISOString();

      if (messageId) {
        setOrders(prevOrders =>
          prevOrders.map(o =>
            o.id === orderId
              ? { ...o, telegram_message_id: String(messageId), courier_search_started_at: searchStartTime, courier_id: null, courier: null, courier_message_id: null }
              : o
          )
        );

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            telegram_message_id: String(messageId),
            courier_search_started_at: searchStartTime,
            courier_id: null,
            courier_message_id: null
          })
          .eq('id', orderId);

        if (updateError) {
          console.error('Error updating order with telegram message id:', updateError);
        }
      }

      await logger.info(partnerId, 'telegram', `Успешно отправлено уведомление о поиске курьера`, {
        orderId,
        branchId: order.branch_id,
        chatId: branch.telegram_chat_id,
        messageId,
        response: JSON.stringify(responseData)
      });
    } catch (error) {
      console.error('Error searching courier:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Ошибка при отправке уведомления в Telegram: ${errorMessage}`);
      await logger.error(partnerId, 'telegram', 'Ошибка при поиске курьера', {
        orderId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  };

  const cancelCourierSearch = async (orderId: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        alert('Не удалось найти данные заказа');
        return;
      }

      setOrders(prevOrders =>
        prevOrders.map(o =>
          o.id === orderId
            ? { ...o, telegram_message_id: null, courier_search_started_at: null }
            : o
        )
      );

      if (!order.telegram_message_id) {
        await supabase
          .from('orders')
          .update({
            courier_search_started_at: null
          })
          .eq('id', orderId);
        return;
      }

      const branch = branches.find(b => b.id === order.branch_id);
      if (!branch?.telegram_chat_id || !branch?.telegram_bot_token) {
        alert('Telegram не настроен для этого филиала');
        return;
      }

      await logger.info(partnerId, 'telegram', `Отмена поиска курьера - удаление сообщения`, {
        orderId,
        messageId: order.telegram_message_id,
        branchId: order.branch_id
      });

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-telegram-message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bot_token: branch.telegram_bot_token,
          chat_id: branch.telegram_chat_id,
          message_id: parseInt(order.telegram_message_id)
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        await logger.warning(partnerId, 'telegram', `Не удалось удалить сообщение из Telegram`, {
          orderId,
          messageId: order.telegram_message_id,
          status: response.status,
          response: JSON.stringify(responseData)
        });
      } else {
        await logger.info(partnerId, 'telegram', `Сообщение успешно удалено из Telegram`, {
          orderId,
          messageId: order.telegram_message_id
        });
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          telegram_message_id: null,
          courier_search_started_at: null
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('Error updating order after canceling search:', updateError);
      }

    } catch (error) {
      console.error('Error canceling courier search:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logger.error(partnerId, 'telegram', 'Ошибка при отмене поиска курьера', {
        orderId,
        error: errorMessage
      });
    }
  };

  const toggleBranchFilter = (branchId: string) => {
    setSelectedBranchIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(branchId)) {
        newSet.delete(branchId);
      } else {
        newSet.add(branchId);
      }
      return newSet;
    });
  };

  const moveBranchUp = (branchId: string) => {
    setBranchOrder(prev => {
      const index = prev.indexOf(branchId);
      if (index > 0) {
        const newOrder = [...prev];
        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        return newOrder;
      }
      return prev;
    });
  };

  const moveBranchDown = (branchId: string) => {
    setBranchOrder(prev => {
      const index = prev.indexOf(branchId);
      if (index < prev.length - 1) {
        const newOrder = [...prev];
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        return newOrder;
      }
      return prev;
    });
  };

  const filteredOrders = orders.filter(order => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (deliveryTypeFilter !== 'all' && order.delivery_type !== deliveryTypeFilter) return false;
    if (selectedBranchIds.size > 0 && !selectedBranchIds.has(order.branch_id)) return false;
    return true;
  });

  const groupedOrders = useMemo(() => {
    const groups: { [branchId: string]: Order[] } = {};

    filteredOrders.forEach(order => {
      if (!groups[order.branch_id]) {
        groups[order.branch_id] = [];
      }
      groups[order.branch_id].push(order);
    });

    return groups;
  }, [filteredOrders]);

  const orderedBranches = useMemo(() => {
    return branchOrder
      .filter(branchId => groupedOrders[branchId] && groupedOrders[branchId].length > 0)
      .map(branchId => {
        const branch = branches.find(b => b.id === branchId);
        return {
          id: branchId,
          name: branch?.name || 'Unknown',
          orders: groupedOrders[branchId]
        };
      });
  }, [branchOrder, groupedOrders, branches]);

  const branchOverdueCounts = useMemo(() => {
    const counts: { [branchId: string]: number } = {};

    branches.forEach(branch => {
      const branchOrders = orders.filter(o => o.branch_id === branch.id && o.status === 'in_progress');
      counts[branch.id] = branchOrders.filter(order => isOrderOverdue(order)).length;
    });

    return counts;
  }, [orders, branches, currentTime, orderCompletionNorm]);

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Сейчас';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-600 font-medium">Загрузка заказов...</div>
      </div>
    );
  }

  if (showCallHistory) {
    return (
      <CallHistory
        partnerId={partnerId}
        onClose={() => setShowCallHistory(false)}
        onCreateOrder={(phone, branchId, sourceCallId) => {
          setShowCallHistory(false);
          setShowCreateModal(true);
        }}
        onEditOrder={(orderId) => {
          const order = orders.find(o => o.id === orderId);
          if (order) {
            setShowCallHistory(false);
            setEditingOrder(order);
          }
        }}
      />
    );
  }

  if (showLostCalls) {
    return (
      <LostCalls
        partnerId={partnerId}
        onClose={() => setShowLostCalls(false)}
        onCreateOrder={(phone, branchId, sourceCallId) => {
          setShowLostCalls(false);
          setShowCreateModal(true);
        }}
        onEditOrder={(orderId) => {
          const order = orders.find(o => o.id === orderId);
          if (order) {
            setShowLostCalls(false);
            setEditingOrder(order);
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-3 items-center">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Заказ</span>
            </button>

            <button
              onClick={() => setShowCallHistory(true)}
              className="p-3 bg-white hover:bg-blue-50 border border-gray-200 text-gray-700 rounded-xl transition-all shadow-md hover:shadow-lg relative"
              title="Пропущенные звонки"
            >
              <Phone className="w-5 h-5" />
              {missedCallsCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {missedCallsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowLostCalls(true)}
              className="p-3 bg-white hover:bg-red-50 border border-gray-200 text-gray-700 rounded-xl transition-all shadow-md hover:shadow-lg relative"
              title="Потерянные звонки"
            >
              <AlertTriangle className="w-5 h-5 text-red-500" />
              {lostCallsCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {lostCallsCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl shadow-md text-sm text-gray-700">
              <Phone className="w-4 h-4" />
              <span className="font-medium">{avgResponseTime !== null ? formatResponseTime(avgResponseTime) : '—'}</span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                statusFilter === 'all'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                statusFilter === 'in_progress'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
              }`}
            >
              В работе
            </button>
            <button
              onClick={() => setStatusFilter('en_route')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                statusFilter === 'en_route'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
              }`}
            >
              В дороге
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                statusFilter === 'completed'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
              }`}
            >
              Выполнен
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setDeliveryTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              deliveryTypeFilter === 'all'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
            }`}
          >
            Все типы
          </button>
          <button
            onClick={() => setDeliveryTypeFilter('delivery')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
              deliveryTypeFilter === 'delivery'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            Доставка
          </button>
          <button
            onClick={() => setDeliveryTypeFilter('pickup')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
              deliveryTypeFilter === 'pickup'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Самовынос
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {branches.map((branch) => {
          const overdueCount = branchOverdueCounts[branch.id] || 0;
          const isSelected = selectedBranchIds.has(branch.id);
          const branchIndex = branchOrder.indexOf(branch.id);
          const canMoveUp = branchIndex > 0;
          const canMoveDown = branchIndex < branchOrder.length - 1;

          return (
            <div key={branch.id} className="flex items-center gap-1">
              <button
                onClick={() => toggleBranchFilter(branch.id)}
                className={`relative px-5 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>{branch.name}</span>
                {overdueCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {overdueCount}
                  </span>
                )}
              </button>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveBranchUp(branch.id)}
                  disabled={!canMoveUp}
                  className={`p-1 rounded transition-colors ${
                    canMoveUp
                      ? 'hover:bg-gray-200 text-gray-700'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveBranchDown(branch.id)}
                  disabled={!canMoveDown}
                  className={`p-1 rounded transition-colors ${
                    canMoveDown
                      ? 'hover:bg-gray-200 text-gray-700'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-12 text-center">
          <p className="text-gray-600 font-medium">Нет заказов</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orderedBranches.map((branchGroup) => (
            <div key={branchGroup.id} className="space-y-2">
              <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-50 rounded-lg border-l-4 border-blue-500">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-800">{branchGroup.name}</h3>
                <span className="text-sm text-gray-600">({branchGroup.orders.length})</span>
              </div>
              <div className="space-y-2">
                {branchGroup.orders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onStatusChange={updateOrderStatus}
                    onExtraTimeClick={(orderId, currentMinutes) => setExtraTimeModal({ orderId, currentMinutes })}
                    onEdit={setEditingOrder}
                    onView={setSelectedOrder}
                    onTogglePayment={togglePaymentStatus}
                    onOpenCourierModal={setCourierModalOrderId}
                    onOpenExecutorModal={setExecutorModalOrderId}
                    onRemoveExecutor={handleRemoveExecutor}
                    onOpenStatusModal={() => setStatusModalOrderId(order.id)}
                    orderExecutors={orderExecutors.filter(oe => oe.order_id === order.id)}
                    formatDateTime={formatDateTime}
                    isOverdue={isOrderOverdue(order)}
                    orderCompletionNorm={orderCompletionNorm}
                    currentTime={currentTime}
                    canRevertOrderStatus={canRevertOrderStatus}
                    openShiftIds={openShiftIds}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {extraTimeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Добавить время</h3>
              <button
                onClick={() => setExtraTimeModal(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">
                Текущее добавочное время: <span className="font-bold text-gray-900">{extraTimeModal.currentMinutes} минут</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => addExtraTime(extraTimeModal.orderId, minutes)}
                  className="px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg font-semibold"
                >
                  +{minutes}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateOrderModal
          partnerId={partnerId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={async () => {
            setShowCreateModal(false);
            await loadData();
          }}
        />
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900">Заказ {selectedOrder.order_number}{selectedOrder.shift_order_number && ` (${selectedOrder.shift_order_number})`}</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Статус</div>
                  <button
                    onClick={() => {
                      if (selectedOrder.status === 'completed' && !canRevertOrderStatus) {
                        return;
                      }
                      setStatusModalOrderId(selectedOrder.id);
                    }}
                    disabled={selectedOrder.status === 'completed' && !canRevertOrderStatus}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      selectedOrder.status === 'completed'
                        ? canRevertOrderStatus
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-green-100 text-green-700 opacity-50 cursor-not-allowed'
                        : selectedOrder.status === 'en_route'
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    }`}
                  >
                    {selectedOrder.status === 'completed' ? '🟢 Выполнен' :
                     selectedOrder.status === 'en_route' ? '🔵 В дороге' :
                     '🟡 В работе'}
                  </button>
                  {selectedOrder.status === 'completed' && !canRevertOrderStatus && (
                    <p className="text-[9px] text-gray-500 text-center mt-1">
                      нет разрешения менять статус заказа обратно
                    </p>
                  )}
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">Тип</div>
                  <div className="text-base font-semibold text-gray-900">
                    {selectedOrder.delivery_type === 'delivery' ? 'Доставка' : 'Самовынос'}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">Принят</div>
                  <div className="text-base font-medium text-gray-900">{formatDateTime(selectedOrder.accepted_at)}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">На когда</div>
                  <div className="text-base font-medium text-gray-900">{formatDateTime(selectedOrder.scheduled_at)}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">Сумма</div>
                  <div className="text-xl font-bold text-gray-900">{selectedOrder.total_amount} грн</div>
                </div>

                {selectedOrder.payment_method && (
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Оплата</div>
                    <div className="flex flex-col gap-2">
                      <div className="text-base font-semibold text-gray-900">{selectedOrder.payment_method.name}</div>
                      {selectedOrder.payment_method.method_type === 'cashless' && selectedOrder.payment_status && (
                        <button
                          onClick={async () => {
                            await togglePaymentStatus(selectedOrder.id);
                            setSelectedOrder({
                              ...selectedOrder,
                              payment_status: selectedOrder.payment_status === 'paid' ? 'unpaid' : 'paid'
                            });
                          }}
                          disabled={selectedOrder.status === 'completed'}
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors self-start disabled:opacity-50 disabled:cursor-not-allowed ${
                            selectedOrder.payment_status === 'paid'
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                          }`}
                        >
                          {selectedOrder.payment_status === 'paid' ? '🟩 Оплачено' : '⬜ Не оплачено'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {selectedOrder.courier && (
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Курьер</div>
                    <div className="text-base font-semibold text-gray-900">{selectedOrder.courier.name}</div>
                    <div className="text-sm text-gray-600">{selectedOrder.courier.phone}</div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-6">
                <div className="text-sm text-gray-500 mb-2">Контакт</div>
                <div className="flex items-center gap-2 text-base font-medium text-gray-900">
                  <User className="w-5 h-5 text-gray-400" />
                  {selectedOrder.phone}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <div className="text-sm text-gray-500 mb-2">Адрес доставки</div>
                <div className="text-base text-gray-900 space-y-1">
                  {selectedOrder.address_line && <div className="font-medium">{selectedOrder.address_line}</div>}
                  {(selectedOrder.floor || selectedOrder.apartment || selectedOrder.entrance || selectedOrder.intercom || selectedOrder.office) && (
                    <div className="text-sm text-gray-600">
                      {[
                        selectedOrder.floor && `Этаж: ${selectedOrder.floor}`,
                        selectedOrder.apartment && `Квартира: ${selectedOrder.apartment}`,
                        selectedOrder.entrance && `Подъезд: ${selectedOrder.entrance}`,
                        selectedOrder.intercom && `Домофон: ${selectedOrder.intercom}`,
                        selectedOrder.office && `Офис: ${selectedOrder.office}`
                      ].filter(Boolean).join(' • ')}
                    </div>
                  )}
                </div>
              </div>

              {selectedOrder.delivery_type === 'delivery' && (
                <div className="border-t border-gray-200 pt-6">
                  <div className="text-sm text-gray-500 mb-2">Назначенный курьер</div>
                  {selectedOrder.courier ? (
                    <div className="text-base text-gray-900">
                      <div className="font-semibold">{selectedOrder.courier.name}</div>
                      <div className="text-sm text-gray-600">{selectedOrder.courier.phone}</div>
                    </div>
                  ) : (
                    <div className="text-base text-gray-500 italic">Курьер не назначен</div>
                  )}
                </div>
              )}

              <div className="border-t border-gray-200 pt-6">
                <div className="text-sm text-gray-500 mb-2">Содержание заказа</div>
                <div className="text-base text-gray-900 whitespace-pre-wrap">{selectedOrder.order_items_summary}</div>
              </div>

              {selectedOrder.comment && (
                <div className="border-t border-gray-200 pt-6">
                  <div className="text-sm text-gray-500 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Комментарий
                  </div>
                  <div className="text-base text-gray-900 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                    {selectedOrder.comment}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 pt-6">
                <div className="text-sm text-gray-500 mb-2">Время</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Базовое время:</span>
                    <span className="font-medium text-gray-900">{selectedOrder.total_time_minutes} мин</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Добавочное время:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{selectedOrder.extra_time_minutes} мин</span>
                      {selectedOrder.status !== 'completed' && (
                        <button
                          onClick={() => {
                            setExtraTimeModal({ orderId: selectedOrder.id, currentMinutes: selectedOrder.extra_time_minutes });
                            setSelectedOrder(null);
                          }}
                          className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
                        >
                          Изменить
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedOrder.completed_total_time_minutes && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
                      <span className="text-gray-600">Фактическое время:</span>
                      <span className="font-bold text-gray-900">{formatElapsedTime(selectedOrder.completed_total_time_minutes)}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedOrder.status !== 'completed' && (
                <div className="border-t border-gray-200 pt-6 flex gap-3">
                  <button
                    onClick={() => {
                      setEditingOrder(selectedOrder);
                      setSelectedOrder(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold"
                  >
                    <Edit className="w-5 h-5" />
                    Редактировать
                  </button>
                  {canDeleteOrders && (
                    <button
                      onClick={() => {
                        setDeletingOrderId(selectedOrder.id);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg hover:shadow-xl font-semibold"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deletingOrderId && canDeleteOrders && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Подтверждение удаления</h3>
            <p className="text-gray-600 mb-6">Вы уверены, что хотите удалить этот заказ? Это действие нельзя отменить.</p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteOrder(deletingOrderId)}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg hover:shadow-xl font-semibold"
              >
                Удалить
              </button>
              <button
                onClick={() => setDeletingOrderId(null)}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {editingOrder && (
        <EditOrderModal
          partnerId={partnerId}
          orderId={editingOrder.id}
          onClose={() => setEditingOrder(null)}
          onSuccess={async () => {
            const orderId = editingOrder.id;
            setEditingOrder(null);

            const { data: updatedOrder } = await supabase
              .from('orders')
              .select(`
                *,
                branch:branches(id, name),
                payment_method:payment_methods(id, name, method_type),
                courier:couriers!orders_courier_id_fkey(id, name, lastname, phone, telegram_username, telegram_user_id, vehicle_type)
              `)
              .eq('id', orderId)
              .maybeSingle();

            if (updatedOrder) {
              setOrders(prevOrders =>
                prevOrders.map(o => o.id === orderId ? updatedOrder : o)
              );

              if (selectedOrder && selectedOrder.id === orderId) {
                setSelectedOrder(updatedOrder);
              }
            }
          }}
        />
      )}

      {courierModalOrderId && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setCourierModalOrderId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[600px] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Выбор курьера</h3>
              <button
                onClick={() => setCourierModalOrderId(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {couriers && couriers.length > 0 ? (
                Object.entries(
                  couriers.reduce((acc, courier) => {
                    if (!acc[courier.branch_id]) {
                      acc[courier.branch_id] = [];
                    }
                    acc[courier.branch_id].push(courier);
                    return acc;
                  }, {} as Record<string, Courier[]>)
                ).map(([branchId, branchCouriers]) => {
                  const branchName = branches.find(b => b.id === branchId)?.name || 'Филиал';
                  const currentOrder = orders.find(o => o.id === courierModalOrderId);
                  return (
                    <div key={branchId}>
                      <div className="px-6 py-2 bg-gray-50 text-sm font-bold text-gray-700 border-b border-gray-200 flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        <span>{branchName}</span>
                      </div>
                      {branchCouriers.map((courier) => {
                        const vehicleTypeLabels: Record<string, string> = {
                          'on_foot': '🚶 Пеший',
                          'bicycle': '🚴 Велосипед',
                          'scooter': '🛴 Скутер',
                          'car': '🚗 Автомобиль'
                        };

                        return (
                        <button
                          key={courier.id}
                          onClick={async () => {
                            await updateOrderCourier(courierModalOrderId, courier.id);
                            setCourierModalOrderId(null);
                          }}
                          className={`w-full px-6 py-3 text-left text-sm hover:bg-blue-50 transition-colors border-b border-gray-100 ${
                            currentOrder?.courier_id === courier.id ? 'bg-blue-100' : ''
                          }`}
                        >
                          <div className={`font-semibold ${currentOrder?.courier_id === courier.id ? 'text-blue-700' : 'text-gray-900'}`}>
                            {courier.name} {courier.lastname || ''}
                          </div>
                          <div className="text-gray-600 text-xs mt-0.5 flex items-center gap-2">
                            {courier.telegram_username && <span>@{courier.telegram_username.replace('@', '')}</span>}
                            {courier.telegram_user_id && <span className="text-gray-400">ID: {courier.telegram_user_id}</span>}
                            {courier.vehicle_type && <span>{vehicleTypeLabels[courier.vehicle_type] || courier.vehicle_type}</span>}
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  );
                })
              ) : (
                <div className="px-6 py-8 text-center text-gray-500">
                  Нет доступных курьеров
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 space-y-2">
              {(() => {
                const currentOrder = orders.find(o => o.id === courierModalOrderId);
                const isSearching = currentOrder?.courier_search_started_at;

                let searchTimeText = '';
                if (isSearching) {
                  const searchStartTime = new Date(currentOrder.courier_search_started_at!).getTime();
                  const elapsedSeconds = Math.floor((Date.now() - searchStartTime) / 1000);
                  const minutes = Math.floor(elapsedSeconds / 60);
                  const seconds = elapsedSeconds % 60;
                  searchTimeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }

                return isSearching ? (
                  <button
                    onClick={async () => {
                      await cancelCourierSearch(courierModalOrderId);
                      setCourierModalOrderId(null);
                    }}
                    className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    <span>Отменить поиск</span>
                    <span className="text-sm font-mono">{searchTimeText}</span>
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      await searchCourier(courierModalOrderId);
                      setCourierModalOrderId(null);
                    }}
                    className="w-full px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors font-semibold"
                  >
                    Найти курьера
                  </button>
                );
              })()}

              {(() => {
                const order = orders.find(o => o.id === courierModalOrderId);
                const hasCourier = order?.courier_id && order?.courier_message_id;
                const isSearching = order?.courier_search_started_at;

                if (isSearching) return null;

                return (
                  <button
                    onClick={async () => {
                      await updateOrderCourier(courierModalOrderId, null);
                      setCourierModalOrderId(null);
                    }}
                    disabled={!hasCourier}
                    className={`w-full px-4 py-3 rounded-lg transition-colors font-semibold ${
                      hasCourier
                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Без курьера
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {executorModalOrderId && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setExecutorModalOrderId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Выбрать исполнителей</h3>
                <button
                  onClick={() => {
                    setExecutorModalOrderId(null);
                    setSelectedExecutorForConfig(null);
                    setEditingOrderExecutorId(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2">
                {!selectedExecutorForConfig && executors.map((executor) => {
                  const order = orders.find(o => o.id === executorModalOrderId);
                  const alreadySelected = orderExecutors.some(
                    oe => oe.order_id === executorModalOrderId && oe.executor_id === executor.id
                  );

                  return (
                    <button
                      key={executor.id}
                      disabled={alreadySelected}
                      onClick={() => {
                        const order = orders.find(o => o.id === executorModalOrderId);
                        if (!order) return;

                        const executorZones = performerZones.get(executor.id) || [];
                        const defaultZoneId = executorZones.length === 1 ? executorZones[0].id : '';

                        setSelectedExecutorForConfig(executor);
                        setExecutorConfig({
                          readinessMinutes: 30,
                          comment: order.comment || '',
                          includeComment: false,
                          paymentMethodId: order.payment_method_id || '',
                          deliveryPayer: executor.delivery_payer_default || 'restaurant',
                          amount: order.total_amount,
                          zoneId: defaultZoneId
                        });
                      }}
                      className={`w-full px-4 py-3 rounded-lg transition-colors font-semibold text-left flex items-center gap-3 ${
                        alreadySelected
                          ? 'bg-purple-50 text-purple-400 cursor-not-allowed'
                          : 'bg-white hover:bg-purple-50 text-gray-900 border-2 border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <Users className="w-5 h-5" />
                      <div className="flex-1">
                        <div>{executor.name}</div>
                        {alreadySelected && (
                          <div className="text-xs text-purple-600">Уже добавлен</div>
                        )}
                      </div>
                    </button>
                  );
                })}

                {executors.length === 0 && !selectedExecutorForConfig && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Нет доступных исполнителей</p>
                  </div>
                )}

                {selectedExecutorForConfig && (() => {
                  const order = orders.find(o => o.id === executorModalOrderId);
                  if (!order) return null;

                  return (
                    <div className="space-y-6">
                      <button
                        onClick={() => {
                          setSelectedExecutorForConfig(null);
                          setEditingOrderExecutorId(null);
                        }}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <ArrowLeft className="w-5 h-5" />
                        Вернуться к списку исполнителей
                      </button>

                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Users className="w-6 h-6 text-purple-600" />
                          <div className="font-bold text-lg text-gray-900">{selectedExecutorForConfig.name}</div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Через сколько будет готово?
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={executorConfig.readinessMinutes}
                            onChange={(e) => setExecutorConfig({
                              ...executorConfig,
                              readinessMinutes: parseInt(e.target.value) || 30
                            })}
                            className="w-full text-4xl font-bold text-center px-4 py-6 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <div className="text-center text-gray-600 mt-2 text-lg">минут</div>
                        </div>

                        {performerZones.get(selectedExecutorForConfig.id) && performerZones.get(selectedExecutorForConfig.id)!.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Зона доставки
                            </label>
                            <select
                              value={executorConfig.zoneId}
                              onChange={(e) => setExecutorConfig({
                                ...executorConfig,
                                zoneId: e.target.value
                              })}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            >
                              <option value="">Не указана</option>
                              {performerZones.get(selectedExecutorForConfig.id)!.map(zone => (
                                <option key={zone.id} value={zone.id}>
                                  {zone.name} - {zone.price_uah} грн
                                </option>
                              ))}
                            </select>
                            {executorConfig.zoneId && (() => {
                              const selectedZone = performerZones.get(selectedExecutorForConfig.id)?.find(z => z.id === executorConfig.zoneId);
                              return selectedZone ? (
                                <div className="mt-2 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div
                                      className="w-4 h-4 rounded border border-gray-300"
                                      style={{ backgroundColor: selectedZone.color }}
                                    />
                                    <span className="font-semibold text-gray-700">{selectedZone.name}</span>
                                  </div>
                                  <div className="text-sm space-y-1">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Цена доставки:</span>
                                      <span className="font-semibold text-gray-900">{selectedZone.price_uah} грн</span>
                                    </div>
                                    {selectedZone.courier_payment !== null && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Оплата курьеру:</span>
                                        <span className="font-semibold text-green-600">{selectedZone.courier_payment} грн</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        )}

                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                          <input
                            type="checkbox"
                            id="includeComment"
                            checked={executorConfig.includeComment}
                            onChange={(e) => setExecutorConfig({
                              ...executorConfig,
                              includeComment: e.target.checked
                            })}
                            className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                          />
                          <label htmlFor="includeComment" className="flex-1 font-medium text-gray-900 cursor-pointer">
                            Включить комментарий в сообщение
                          </label>
                        </div>

                        {executorConfig.includeComment && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Комментарий
                            </label>
                            <textarea
                              value={executorConfig.comment}
                              onChange={(e) => setExecutorConfig({
                                ...executorConfig,
                                comment: e.target.value
                              })}
                              rows={3}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="Введите комментарий..."
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Кто оплачивает доставку
                          </label>
                          <div className="flex gap-3">
                            <label className="flex-1 cursor-pointer">
                              <input
                                type="radio"
                                name="delivery_payer"
                                value="restaurant"
                                checked={executorConfig.deliveryPayer === 'restaurant'}
                                onChange={() => setExecutorConfig({
                                  ...executorConfig,
                                  deliveryPayer: 'restaurant'
                                })}
                                className="sr-only peer"
                              />
                              <div className="px-4 py-3 border-2 border-gray-300 rounded-xl text-center peer-checked:border-purple-600 peer-checked:bg-purple-50 peer-checked:text-purple-900 transition-colors">
                                <div className="font-medium">🏢 Заведение</div>
                              </div>
                            </label>
                            <label className="flex-1 cursor-pointer">
                              <input
                                type="radio"
                                name="delivery_payer"
                                value="client"
                                checked={executorConfig.deliveryPayer === 'client'}
                                onChange={() => setExecutorConfig({
                                  ...executorConfig,
                                  deliveryPayer: 'client'
                                })}
                                className="sr-only peer"
                              />
                              <div className="px-4 py-3 border-2 border-gray-300 rounded-xl text-center peer-checked:border-purple-600 peer-checked:bg-purple-50 peer-checked:text-purple-900 transition-colors">
                                <div className="font-medium">👤 Клиент</div>
                              </div>
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Способ оплаты
                          </label>
                          <select
                            value={executorConfig.paymentMethodId}
                            onChange={(e) => setExecutorConfig({
                              ...executorConfig,
                              paymentMethodId: e.target.value
                            })}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="">Не указана</option>
                            {paymentMethods.map((pm) => (
                              <option key={pm.id} value={pm.id}>{pm.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Сумма заказа
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={executorConfig.amount}
                            onChange={(e) => setExecutorConfig({
                              ...executorConfig,
                              amount: parseFloat(e.target.value) || 0
                            })}
                            className="w-full text-2xl font-bold text-center px-4 py-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <div className="text-center text-gray-600 mt-2">грн</div>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={() => {
                            setSelectedExecutorForConfig(null);
                            setEditingOrderExecutorId(null);
                          }}
                          className="flex-1 px-6 py-4 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-xl transition-colors font-semibold"
                        >
                          Отменить
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const executorZones = performerZones.get(selectedExecutorForConfig.id);
                              if (executorZones && executorZones.length > 0 && !executorConfig.zoneId) {
                                alert('Выберите зону доставки для исполнителя');
                                return;
                              }

                              const existingOrderExecutor = editingOrderExecutorId
                                ? orderExecutors.find(oe => oe.id === editingOrderExecutorId)
                                : null;

                              let orderExecutor: OrderExecutor | undefined;

                              if (editingOrderExecutorId) {
                                const { data, error } = await supabase
                                  .from('order_executors')
                                  .update({
                                    readiness_minutes: executorConfig.readinessMinutes,
                                    readiness_started_at: new Date().toISOString(),
                                    zone_id: executorConfig.zoneId || null
                                  })
                                  .eq('id', editingOrderExecutorId)
                                  .select(`
                                    *,
                                    executor:executors(id, name, own_couriers, telegram_bot_token, telegram_chat_id)
                                  `)
                                  .single();

                                if (error) throw error;
                                orderExecutor = data as OrderExecutor;

                                setOrderExecutors(prev =>
                                  prev.map(oe => oe.id === editingOrderExecutorId ? orderExecutor : oe)
                                );
                              } else if (!selectedExecutorForConfig.distribute_by_branches) {
                                const { data, error } = await supabase
                                  .from('order_executors')
                                  .insert({
                                    order_id: executorModalOrderId,
                                    executor_id: selectedExecutorForConfig.id,
                                    status: 'assigned',
                                    readiness_minutes: executorConfig.readinessMinutes,
                                    readiness_started_at: new Date().toISOString(),
                                    zone_id: executorConfig.zoneId || null
                                  })
                                  .select(`
                                    *,
                                    executor:executors(id, name, own_couriers, telegram_bot_token, telegram_chat_id)
                                  `)
                                  .single();

                                if (error) throw error;
                                orderExecutor = data as OrderExecutor;

                                setOrderExecutors(prev => [...prev, orderExecutor]);
                              }

                              const updateData: Record<string, unknown> = {
                                executor_type: 'performer',
                                executor_id: selectedExecutorForConfig.id
                              };

                              if (executorConfig.zoneId) {
                                updateData.executor_zone_id = executorConfig.zoneId;
                              }

                              await supabase
                                .from('orders')
                                .update(updateData)
                                .eq('id', executorModalOrderId);

                              if (!selectedExecutorForConfig.own_couriers && selectedExecutorForConfig.telegram_bot_token && selectedExecutorForConfig.telegram_chat_id) {
                                const configurationsToSend: Array<{
                                  botToken: string;
                                  chatId: string;
                                  threadId: string | null;
                                  branchId: string | null;
                                  orderExecutorId: string;
                                }> = [];

                                const order = orders.find(o => o.id === executorModalOrderId);
                                if (!order) {
                                  alert('Заказ не найден');
                                  return;
                                }

                                if (selectedExecutorForConfig.distribute_by_branches) {
                                  const { data: branchSetting } = await supabase
                                    .from('executor_branch_telegram_settings')
                                    .select('*')
                                    .eq('executor_id', selectedExecutorForConfig.id)
                                    .eq('branch_id', order.branch_id)
                                    .maybeSingle();

                                  if (!branchSetting) {
                                    alert(`Настройки Telegram для филиала заказа не найдены в исполнителе ${selectedExecutorForConfig.name}`);
                                    return;
                                  }

                                  const { data: existingOrderExecutors } = await supabase
                                    .from('order_executors')
                                    .select(`
                                      *,
                                      executor:executors(id, name, own_couriers, telegram_bot_token, telegram_chat_id)
                                    `)
                                    .eq('order_id', executorModalOrderId)
                                    .eq('executor_id', selectedExecutorForConfig.id)
                                    .eq('branch_id', order.branch_id);

                                  let branchOrderExecutor = existingOrderExecutors?.[0];

                                  if (!branchOrderExecutor) {
                                    const { data, error } = await supabase
                                      .from('order_executors')
                                      .insert({
                                        order_id: executorModalOrderId,
                                        executor_id: selectedExecutorForConfig.id,
                                        branch_id: order.branch_id,
                                        status: 'searching',
                                        readiness_minutes: executorConfig.readinessMinutes,
                                        readiness_started_at: new Date().toISOString(),
                                        zone_id: executorConfig.zoneId || null
                                      })
                                      .select(`
                                        *,
                                        executor:executors(id, name, own_couriers, telegram_bot_token, telegram_chat_id)
                                      `)
                                      .single();

                                    if (error) {
                                      throw error;
                                    }
                                    branchOrderExecutor = data as OrderExecutor;
                                    setOrderExecutors(prev => [...prev, branchOrderExecutor!]);
                                  }

                                  if (!branchOrderExecutor.telegram_message_id) {
                                    configurationsToSend.push({
                                      botToken: branchSetting.telegram_bot_token || selectedExecutorForConfig.telegram_bot_token,
                                      chatId: branchSetting.telegram_chat_id,
                                      threadId: branchSetting.telegram_thread_id || null,
                                      branchId: order.branch_id,
                                      orderExecutorId: branchOrderExecutor.id
                                    });
                                  }
                                } else if (orderExecutor && !orderExecutor.telegram_message_id) {
                                  configurationsToSend.push({
                                    botToken: selectedExecutorForConfig.telegram_bot_token,
                                    chatId: selectedExecutorForConfig.telegram_chat_id,
                                    threadId: selectedExecutorForConfig.telegram_thread_id || null,
                                    branchId: null,
                                    orderExecutorId: orderExecutor.id
                                  });
                                }

                                const paymentMethod = paymentMethods.find(pm => pm.id === executorConfig.paymentMethodId);

                                let deliveryPrice = 0;
                                let zonePrice = 0;
                                let distancePrice = 0;
                                let roundedDistanceKm: number | null = null;

                                if (executorConfig.zoneId) {
                                  const zone = performerZones.get(selectedExecutorForConfig.id)?.find(z => z.id === executorConfig.zoneId);
                                  if (zone) {
                                    zonePrice = zone.price_uah;
                                    deliveryPrice = zonePrice;
                                  }
                                }

                                const { data: executorKmSettings } = await supabase
                                  .from('executors')
                                  .select('km_calculation_enabled, price_per_km, km_graduation_meters')
                                  .eq('id', selectedExecutorForConfig.id)
                                  .maybeSingle();

                                if (executorKmSettings?.km_calculation_enabled && executorKmSettings.price_per_km > 0 && order.distance_km) {
                                  const minDistance = 1;
                                  const graduationKm = (executorKmSettings.km_graduation_meters || 100) / 1000;
                                  let calcDistance = Math.max(order.distance_km, minDistance);

                                  if (graduationKm > 0) {
                                    calcDistance = Math.round(calcDistance / graduationKm) * graduationKm;
                                    calcDistance = Math.max(calcDistance, minDistance);
                                  }

                                  roundedDistanceKm = calcDistance;
                                  distancePrice = Math.round(calcDistance * executorKmSettings.price_per_km);
                                  deliveryPrice = zonePrice + distancePrice;
                                }

                                const orderExecutorUpdateData: Record<string, unknown> = {
                                  zone_id: executorConfig.zoneId || null,
                                  distance_price_uah: distancePrice,
                                  rounded_distance_km: roundedDistanceKm,
                                  total_delivery_price_uah: deliveryPrice
                                };

                                if (configurationsToSend.length > 0) {
                                  for (const config of configurationsToSend) {
                                    await supabase
                                      .from('order_executors')
                                      .update(orderExecutorUpdateData)
                                      .eq('id', config.orderExecutorId);
                                  }
                                } else if (orderExecutor) {
                                  await supabase
                                    .from('order_executors')
                                    .update(orderExecutorUpdateData)
                                    .eq('id', orderExecutor.id);
                                }

                                const { data: orderItemsData } = await supabase
                                  .from('order_items')
                                  .select('*')
                                  .eq('order_id', executorModalOrderId);

                                const orderWithComment = {
                                  ...order,
                                  comment: executorConfig.includeComment ? executorConfig.comment : order.comment
                                };

                                const message = buildExecutorTelegramMessage({
                                  order: orderWithComment,
                                  branch: order.branch,
                                  readinessMinutes: executorConfig.readinessMinutes,
                                  deliveryPrice,
                                  deliveryPayer: executorConfig.deliveryPayer,
                                  paymentMethod,
                                  paymentStatus: order.payment_status,
                                  zonePrice,
                                  distancePrice,
                                  roundedDistanceKm,
                                  distanceKm: order.distance_km
                                });

                                for (const config of configurationsToSend) {
                                  const requestBody: {
                                    bot_token: string;
                                    chat_id: string;
                                    message: string;
                                    message_thread_id?: string;
                                    inline_keyboard?: Array<Array<{ text: string; callback_data: string }>>;
                                  } = {
                                    bot_token: config.botToken,
                                    chat_id: config.chatId,
                                    message
                                  };

                                  if (config.threadId) {
                                    requestBody.message_thread_id = config.threadId;
                                  }

                                  requestBody.inline_keyboard = [[
                                    { text: 'Принять заказ', callback_data: `accept_order:${config.orderExecutorId}` }
                                  ]];

                                  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram-message`, {
                                    method: 'POST',
                                    headers: {
                                      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify(requestBody)
                                  });

                                  const responseData = await response.json();
                                  const messageId = responseData?.telegram_response?.result?.message_id;

                                  if (messageId) {
                                    await supabase
                                      .from('order_executors')
                                      .update({
                                        telegram_message_id: String(messageId),
                                        sent_at: new Date().toISOString()
                                      })
                                      .eq('id', config.orderExecutorId);

                                    setOrderExecutors(prev =>
                                      prev.map(oe => oe.id === config.orderExecutorId ? { ...oe, telegram_message_id: String(messageId), sent_at: new Date().toISOString() } : oe)
                                    );
                                  }

                                  await logger.info(partnerId, 'executors', `Заказ отправлен исполнителю ${selectedExecutorForConfig.name}`, {
                                    orderId: executorModalOrderId,
                                    executorId: selectedExecutorForConfig.id,
                                    branchId: config.branchId,
                                    messageId,
                                    readinessMinutes: executorConfig.readinessMinutes,
                                    orderExecutorId: config.orderExecutorId
                                  });
                                }
                              }

                              await logger.info(partnerId, 'executors', editingOrderExecutorId
                                ? `Исполнитель ${selectedExecutorForConfig.name} обновлён`
                                : `Исполнитель ${selectedExecutorForConfig.name} добавлен к заказу`, {
                                orderId: executorModalOrderId,
                                executorId: selectedExecutorForConfig.id
                              });

                              setSelectedExecutorForConfig(null);
                              setEditingOrderExecutorId(null);
                            } catch (error) {
                              console.error('Error adding executor:', error);
                              await logger.error(partnerId, 'executors', 'Ошибка добавления исполнителя', {
                                orderId: executorModalOrderId,
                                executorId: selectedExecutorForConfig.id,
                                error: String(error)
                              });
                              alert('Ошибка при добавлении исполнителя');
                            }
                          }}
                          className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl transition-all font-semibold shadow-lg"
                        >
                          Отправить
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {(() => {
              const orderExecs = orderExecutors.filter(oe => oe.order_id === executorModalOrderId);
              return orderExecs.length > 0 && (
                <div className="p-6 border-t bg-gray-50">
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      const order = orders.find(o => o.id === executorModalOrderId);
                      if (!order) return;

                      const currentOrderExecs = orderExecutors.filter(oe => oe.order_id === executorModalOrderId);

                      try {
                        for (const oe of currentOrderExecs) {
                          if (oe.telegram_message_id && oe.executor.telegram_bot_token && oe.executor.telegram_chat_id) {
                            let deleteBotToken = oe.executor.telegram_bot_token;
                            let deleteChatId = oe.executor.telegram_chat_id;

                            if (oe.branch_id && oe.executor.distribute_by_branches) {
                              const { data: branchSettings } = await supabase
                                .from('executor_branch_telegram_settings')
                                .select('telegram_bot_token, telegram_chat_id')
                                .eq('executor_id', oe.executor_id)
                                .eq('branch_id', oe.branch_id)
                                .maybeSingle();

                              if (branchSettings) {
                                deleteBotToken = branchSettings.telegram_bot_token || deleteBotToken;
                                deleteChatId = branchSettings.telegram_chat_id || deleteChatId;
                              }
                            }

                            const messageId = parseInt(oe.telegram_message_id, 10);

                            await fetch(`https://api.telegram.org/bot${deleteBotToken}/deleteMessage`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                chat_id: deleteChatId,
                                message_id: messageId
                              })
                            }).catch(err => console.error('Error deleting group message:', err));
                          }

                          if (oe.courier_private_message_id && oe.courier_id) {
                            try {
                              const { data: courier } = await supabase
                                .from('couriers')
                                .select('telegram_user_id')
                                .eq('id', oe.courier_id)
                                .maybeSingle();

                              if (courier && courier.telegram_user_id) {
                                let botToken = oe.executor.telegram_bot_token;

                                if (oe.branch_id && oe.executor.distribute_by_branches) {
                                  const { data: branchSettings } = await supabase
                                    .from('executor_branch_telegram_settings')
                                    .select('telegram_bot_token')
                                    .eq('executor_id', oe.executor_id)
                                    .eq('branch_id', oe.branch_id)
                                    .maybeSingle();

                                  if (branchSettings?.telegram_bot_token) {
                                    botToken = branchSettings.telegram_bot_token;
                                  }
                                }

                                if (botToken) {
                                  await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      chat_id: courier.telegram_user_id,
                                      message_id: parseInt(oe.courier_private_message_id, 10)
                                    })
                                  }).catch(err => console.error('Error deleting courier private message:', err));
                                }
                              }
                            } catch (courierMessageError) {
                              console.error('Error processing courier private message:', courierMessageError);
                            }
                          }

                          const { error: deleteError } = await supabase
                            .from('order_executors')
                            .delete()
                            .eq('id', oe.id);

                          if (deleteError) {
                            console.error('Error deleting order_executor:', deleteError);
                          }
                        }

                        setOrderExecutors(prev => {
                          const updated = prev.filter(oe => oe.order_id !== executorModalOrderId);
                          console.log('Before:', prev.length, 'After:', updated.length);
                          return updated;
                        });

                        await logger.info(partnerId, 'executors', 'Все исполнители отменены', {
                          orderId: executorModalOrderId,
                          count: currentOrderExecs.length
                        });

                        setExecutorModalOrderId(null);
                      } catch (error) {
                        console.error('Error removing all executors:', error);
                        await logger.error(partnerId, 'executors', 'Ошибка отмены всех исполнителей', {
                          orderId: executorModalOrderId,
                          error: String(error)
                        });
                        alert('Ошибка при отмене исполнителей');
                      }
                    }}
                    className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Отменить всех исполнителей
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {statusModalOrderId && (() => {
        const order = orders.find(o => o.id === statusModalOrderId);
        if (!order) return null;

        const activeExecutors = orderExecutors.filter(
          oe => oe.order_id === statusModalOrderId && oe.status !== 'cancelled'
        );

        return (
          <OrderStatusModal
            isOpen={true}
            onClose={() => setStatusModalOrderId(null)}
            currentStatus={order.status}
            onStatusChange={(newStatus, reason) => {
              if (newStatus === 'completed' && order.payment_method?.method_type === 'cashless' && order.payment_status !== 'paid') {
                alert('Невозможно завершить заказ: безналичная оплата не произведена');
                return;
              }
              updateOrderStatus(statusModalOrderId, newStatus, reason);
              if (selectedOrder && selectedOrder.id === statusModalOrderId) {
                setSelectedOrder({
                  ...selectedOrder,
                  status: newStatus
                });
              }
              setStatusModalOrderId(null);
            }}
            canRevertOrderStatus={canRevertOrderStatus}
            canSkipOrderStatus={canSkipOrderStatus}
            isSuperAdmin={isSuperAdmin}
            deliveryType={order.delivery_type}
            orderId={order.id}
            hasCourier={!!order.courier_id && order.courier_id !== 'search_courier'}
            executorsCount={activeExecutors.length}
            isSearchingCourier={order.courier_id === 'search_courier'}
          />
        );
      })()}
    </div>
  );
}
