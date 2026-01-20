import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface OrderStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStatus: string;
  onStatusChange: (status: 'in_progress' | 'en_route' | 'completed', reason?: string) => void;
  disabled?: boolean;
  canRevertOrderStatus?: boolean;
  canSkipOrderStatus?: boolean;
  isSuperAdmin?: boolean;
  deliveryType?: 'delivery' | 'pickup';
  orderId?: string;
  hasCourier?: boolean;
  executorsCount?: number;
  isSearchingCourier?: boolean;
}

export default function OrderStatusModal({
  isOpen,
  onClose,
  currentStatus,
  onStatusChange,
  disabled = false,
  canRevertOrderStatus = true,
  canSkipOrderStatus = true,
  isSuperAdmin = true,
  deliveryType = 'delivery',
  orderId,
  hasCourier = false,
  executorsCount = 0,
  isSearchingCourier = false
}: OrderStatusModalProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [showExecutorWarning, setShowExecutorWarning] = useState(false);
  const [showSearchCourierWarning, setShowSearchCourierWarning] = useState(false);
  const [reason, setReason] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'in_progress' | 'en_route' | 'completed' | null>(null);

  if (!isOpen) return null;

  const isPickup = deliveryType === 'pickup';

  const allStatuses = [
    { value: 'in_progress', label: 'В работе', emoji: '🟡', color: 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300 text-yellow-700' },
    { value: 'en_route', label: 'В дороге', emoji: '🔵', color: 'bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-700' },
    { value: 'completed', label: 'Выполнен', emoji: '🟢', color: 'bg-green-100 hover:bg-green-200 border-green-300 text-green-700' },
  ] as const;

  const statuses = isPickup
    ? allStatuses.filter(s => s.value !== 'en_route')
    : allStatuses;

  const statusOrder = { 'in_progress': 0, 'en_route': 1, 'completed': 2 };

  const isStatusChangeAllowed = (targetStatus: 'in_progress' | 'en_route' | 'completed'): boolean => {
    if (isSuperAdmin) return true;

    const currentOrder = statusOrder[currentStatus as keyof typeof statusOrder];
    const targetOrder = statusOrder[targetStatus];

    if (targetOrder > currentOrder) {
      if (isPickup && targetStatus === 'completed') {
        return true;
      }
      return canSkipOrderStatus;
    }

    if (targetOrder < currentOrder) {
      return canRevertOrderStatus;
    }

    return true;
  };

  const handleStatusClick = (status: 'in_progress' | 'en_route' | 'completed') => {
    if (!isStatusChangeAllowed(status)) return;

    // Check if there are multiple executors or courier + executors when completing
    if (status === 'completed') {
      // For pickup orders, skip courier/executor checks
      if (!isPickup) {
        if (executorsCount > 1) {
          setShowExecutorWarning(true);
          return;
        }

        if (hasCourier && executorsCount > 0) {
          setShowExecutorWarning(true);
          return;
        }

        const totalPerformers = (hasCourier ? 1 : 0) + executorsCount;

        if (totalPerformers > 1) {
          setShowExecutorWarning(true);
          return;
        }

        // Check if courier/executor is assigned for non-pickup orders
        if (totalPerformers === 0) {
          setShowSearchCourierWarning(true);
          return;
        }
      }

      if (!isSuperAdmin && !isPickup) {
        setSelectedStatus(status);
        setShowWarning(true);
        return;
      }
    }

    onStatusChange(status);
    onClose();
  };

  const handleConfirmManualCompletion = async () => {
    if (!reason.trim() || !selectedStatus) return;

    console.log('Ручной перевод заказа в статус "Выполнен". Причина:', reason);

    onStatusChange(selectedStatus, reason);
    setShowWarning(false);
    setReason('');
    setSelectedStatus(null);
    onClose();
  };

  const handleCancelWarning = () => {
    setShowWarning(false);
    setReason('');
    setSelectedStatus(null);
  };

  const handleCloseExecutorWarning = () => {
    setShowExecutorWarning(false);
  };

  const handleCloseSearchCourierWarning = () => {
    setShowSearchCourierWarning(false);
  };

  if (showSearchCourierWarning) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-bold text-gray-900">Необходимо назначить исполнителя</h2>
            </div>
            <button
              onClick={handleCloseSearchCourierWarning}
              className="text-gray-500 hover:text-gray-700 transition-colors p-1 hover:bg-white/50 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-800 font-medium mb-2">
                  Курьер или исполнитель не назначен!
                </p>
                <p className="text-sm text-orange-700">
                  Невозможно завершить заказ без назначенного курьера или исполнителя. Перед завершением заказа необходимо выбрать кого-то, кто доставит/доставил этот заказ.
                </p>
              </div>

              <button
                onClick={handleCloseSearchCourierWarning}
                className="w-full px-6 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-colors"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showExecutorWarning) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-bold text-gray-900">Необходимо выбрать исполнителя</h2>
            </div>
            <button
              onClick={handleCloseExecutorWarning}
              className="text-gray-500 hover:text-gray-700 transition-colors p-1 hover:bg-white/50 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-800 font-medium mb-2">
                  В заказе назначено несколько исполнителей и/или курьер!
                </p>
                <p className="text-sm text-orange-700">
                  Перед завершением заказа необходимо оставить только одного исполнителя или курьера, который выполнил заказ.
                </p>
                <p className="text-sm text-orange-700 mt-2">
                  Отмените лишних исполнителей и попробуйте снова.
                </p>
              </div>

              <button
                onClick={handleCloseExecutorWarning}
                className="w-full px-6 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-colors"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showWarning) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">Предупреждение</h2>
            </div>
            <button
              onClick={handleCancelWarning}
              className="text-gray-500 hover:text-gray-700 transition-colors p-1 hover:bg-white/50 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 font-medium">
                  Вы меняете статус заказа вручную в экстренных случаях!
                </p>
                <p className="text-xs text-red-700 mt-2">
                  Пожалуйста, укажите причину ручного перевода заказа в статус "Выполнен":
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Причина ручного перевода
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
                  rows={4}
                  placeholder="Например: Технический сбой, особые обстоятельства..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleConfirmManualCompletion}
                  disabled={!reason.trim()}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Подтвердить изменение
                </button>
                <button
                  onClick={handleCancelWarning}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
          <h2 className="text-xl font-bold text-gray-900">Изменить статус заказа</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-1 hover:bg-white/50 rounded-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-3">
            {statuses.map((status) => {
              const isAllowed = isStatusChangeAllowed(status.value);
              const isDisabled = !isAllowed;

              return (
                <div key={status.value}>
                  <button
                    onClick={() => handleStatusClick(status.value)}
                    disabled={isDisabled}
                    className={`w-full px-6 py-4 rounded-xl text-base font-bold transition-all border-2 flex items-center gap-3 ${
                      currentStatus === status.value
                        ? `${status.color} ring-2 ring-offset-2 ring-blue-400`
                        : `${status.color} opacity-70`
                    } ${isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                  >
                    <span className="text-2xl">{status.emoji}</span>
                    <span className="flex-1 text-left">{status.label}</span>
                    {currentStatus === status.value && (
                      <span className="text-xs px-2 py-1 bg-white/50 rounded-full">Текущий</span>
                    )}
                  </button>
                  {!isAllowed && !isSuperAdmin && (
                    <p className="text-xs text-red-600 mt-1 ml-2">
                      {statusOrder[status.value] < statusOrder[currentStatus as keyof typeof statusOrder]
                        ? 'У вас нет разрешения откатывать статусы обратно'
                        : 'У вас нет разрешения переводить статусы вперед'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
