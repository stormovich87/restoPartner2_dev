import { useState } from 'react';
import { Send, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface TestNotificationButtonProps {
  partnerId: string;
  employeeId: string;
  employeeName: string;
  telegramId: string | null;
}

export default function TestNotificationButton({
  partnerId,
  employeeId,
  employeeName,
  telegramId
}: TestNotificationButtonProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const sendTestMessage = async () => {
    if (!telegramId) {
      setResult({
        success: false,
        message: 'У сотрудника не указан Telegram ID',
        details: 'Сотрудник должен пройти регистрацию в боте',
      });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/test-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partner_id: partnerId,
          employee_id: employeeId,
          telegram_user_id: telegramId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: 'Тестовое сообщение отправлено успешно!',
          details: `Message ID: ${data.messageId}`,
        });
      } else {
        let message = 'Не удалось отправить сообщение';
        let details = data.error || 'Неизвестная ошибка';

        if (data.error && data.error.includes('chat not found')) {
          message = 'Сотрудник не начал диалог с ботом';
          details = 'Попросите сотрудника найти бота в Telegram и нажать /start';
        } else if (data.error && data.error.includes('bot was blocked')) {
          message = 'Сотрудник заблокировал бота';
          details = 'Попросите сотрудника разблокировать бота в настройках Telegram';
        } else if (data.error && data.error.includes('Unauthorized')) {
          message = 'Неверный токен бота';
          details = 'Проверьте настройки бота сотрудников';
        }

        setResult({
          success: false,
          message,
          details,
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Ошибка при отправке тестового сообщения',
        details: String(error),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={sendTestMessage}
        disabled={testing || !telegramId}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {testing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Отправка...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Отправить тестовое уведомление
          </>
        )}
      </button>

      {!telegramId && (
        <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm">
          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-yellow-800">
            У сотрудника <strong>{employeeName}</strong> не указан Telegram ID.
            Попросите сотрудника пройти регистрацию в боте.
          </div>
        </div>
      )}

      {result && (
        <div
          className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${
            result.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          {result.success ? (
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <div
              className={`font-medium ${
                result.success ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {result.message}
            </div>
            {result.details && (
              <div
                className={`text-xs mt-1 ${
                  result.success ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {result.details}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
