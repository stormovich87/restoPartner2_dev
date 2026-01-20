import { X, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { useBinotel } from '../contexts/BinotelContext';
import { useState } from 'react';

export default function IncomingCallsWidget() {
  const {
    incomingCalls,
    outgoingCalls,
    missedCalls,
    dismissIncomingCall,
    dismissOutgoingCall,
    openClientDrawer,
    markMissedCallSeen,
  } = useBinotel();

  const [showMissedCallsPanel, setShowMissedCallsPanel] = useState(false);

  return (
    <>
      <div className="fixed top-4 right-4 z-30 flex flex-col gap-3 max-w-sm">
        {missedCalls.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowMissedCallsPanel(!showMissedCallsPanel)}
              className="flex items-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg shadow-lg hover:bg-red-600 transition-colors"
            >
              <PhoneMissed className="w-5 h-5" />
              <span className="font-medium">Пропущенные звонки</span>
              <span className="ml-2 px-2 py-0.5 bg-white text-red-600 rounded-full text-sm font-bold">
                {missedCalls.length}
              </span>
            </button>

            {showMissedCallsPanel && (
              <div className="absolute top-full mt-2 right-0 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-96 overflow-y-auto">
                <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Пропущенные звонки</h3>
                  <button
                    onClick={() => setShowMissedCallsPanel(false)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {missedCalls.map((call) => (
                    <div key={call.id} className="p-3 hover:bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {call.client_name || 'Неизвестный'}
                          </p>
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {call.phone}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(call.created_at).toLocaleString('ru', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            markMissedCallSeen(call.id);
                          }}
                          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        >
                          Закрыть
                        </button>
                        <button
                          onClick={() => {
                            openClientDrawer(
                              call.phone,
                              call.client_id,
                              call.client_name || null,
                              call.branch_id,
                              call.general_call_id || null
                            );
                            markMissedCallSeen(call.id);
                            setShowMissedCallsPanel(false);
                          }}
                          className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          Создать заказ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {outgoingCalls.map((call) => (
          <div
            key={call.id}
            className="flex items-center gap-3 px-4 py-3 bg-blue-500 text-white rounded-lg shadow-lg cursor-pointer hover:bg-blue-600 transition-colors"
            onClick={() => {
              openClientDrawer(
                call.phone,
                call.client_id,
                call.client_name || null,
                call.branch_id,
                call.general_call_id || null
              );
              dismissOutgoingCall(call.id);
            }}
          >
            <PhoneOutgoing className="w-5 h-5" />
            <div className="flex-1">
              <p className="font-medium">
                {call.client_name || call.phone}
              </p>
              {call.client_name && (
                <p className="text-sm opacity-90">{call.phone}</p>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissOutgoingCall(call.id);
              }}
              className="p-1 hover:bg-blue-700 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {incomingCalls.map((call) => (
          <div
            key={call.id}
            className={`flex items-center gap-3 px-4 py-3 text-white rounded-lg shadow-lg cursor-pointer transition-colors ${
              call.is_missed
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-green-500 hover:bg-green-600 animate-pulse'
            }`}
            onClick={() => {
              openClientDrawer(
                call.phone,
                call.client_id,
                call.client_name || null,
                call.branch_id,
                call.general_call_id || null
              );
              if (call.is_missed) {
                dismissIncomingCall(call.id);
              }
            }}
          >
            {call.is_missed ? (
              <PhoneMissed className="w-5 h-5" />
            ) : (
              <PhoneIncoming className="w-5 h-5" />
            )}
            <div className="flex-1">
              <p className="font-medium">
                {call.is_missed ? 'Пропущенный звонок' : 'Входящий звонок'}
              </p>
              <p className="text-sm">
                {call.client_name || call.phone}
              </p>
              {call.client_name && (
                <p className="text-xs opacity-90">{call.phone}</p>
              )}
              {call.is_missed && (
                <p className="text-xs opacity-90 mt-1">
                  {new Date(call.created_at).toLocaleString('ru', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissIncomingCall(call.id);
              }}
              className={`p-1 rounded ${call.is_missed ? 'hover:bg-red-700' : 'hover:bg-green-700'}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
