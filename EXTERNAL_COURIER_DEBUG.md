# Отладка принятия заказов сторонними курьерами

## Проблема
Сторонний курьер зарегистрирован и отображается в разделе "Сторонние курьеры", но при нажатии кнопки "Принять заказ" ничего не происходит.

## Что было исправлено

1. **Добавлена поддержка внешних курьеров** - функция `external-courier-accept-order` теперь проверяет флаг `allow_external_couriers` у исполнителя
2. **Использование данных из Telegram** - если курьер не найден в базе данных, используются данные из профиля Telegram
3. **Детальное логирование** - добавлено логирование на каждом этапе обработки

## Проверка конфигурации

### 1. Проверьте исполнителя
Откройте раздел **Настройки → Исполнители** и убедитесь:
- ✅ У исполнителя включен чекбокс "Разрешить сторонних курьеров"
- ✅ Заполнено поле "Telegram Bot Token"
- ✅ Webhook настроен (происходит автоматически при сохранении)

### 2. Проверьте webhook
Webhook должен быть настроен на URL:
```
https://[your-supabase-url]/functions/v1/external-courier-accept-order?token=[bot_token]
```

Можно проверить через Telegram API:
```bash
curl https://api.telegram.org/bot[YOUR_BOT_TOKEN]/getWebhookInfo
```

### 3. Проверьте курьера
Откройте раздел **Курьеры → Сторонние курьеры** и убедитесь:
- ✅ Курьер отображается в списке
- ✅ Статус курьера "Активен"
- ✅ `telegram_user_id` заполнен

## Тестирование

### Шаг 1: Отправьте заказ исполнителю
1. Создайте новый заказ
2. В модальном окне "Назначить исполнителя" выберите исполнителя со сторонними курьерами
3. Заказ должен появиться в Telegram группе исполнителя с кнопкой "Принять заказ"

### Шаг 2: Примите заказ
1. Сторонний курьер нажимает кнопку "Принять заказ"
2. Курьер должен получить уведомление "Заказ принят!"
3. Курьер должен получить личное сообщение с деталями заказа

### Шаг 3: Проверьте логи
Логи функции можно посмотреть в Supabase Dashboard:
1. Откройте https://supabase.com/dashboard/project/[project-id]/functions
2. Найдите функцию `external-courier-accept-order`
3. Откройте вкладку "Logs"
4. Посмотрите последние записи

## Ожидаемые логи

```
=== EXTERNAL COURIER ACCEPT ORDER WEBHOOK CALLED ===
Received Telegram update: {...}
Bot token from URL: present
Callback data: accept_order:[order_executor_id]
=== EXTERNAL COURIER ACCEPT ORDER ===
Order executor ID: [uuid]
Telegram user ID: [user_id]
User data: {...}
Order executor found: { id: ..., status: 'searching', ... }
Searching for courier with telegram_user_id: [user_id] partner_id: [partner_id]
Courier search result: { courier: {...} or null }
Updating order_executor: { ... }
Order executor updated successfully
...
```

## Возможные проблемы и решения

### Проблема 1: Webhook не вызывается
**Симптомы:** Нет логов в Supabase Functions
**Решение:**
- Пересохраните исполнителя в интерфейсе
- Проверьте webhook через `getWebhookInfo`
- Убедитесь, что бот не заблокирован

### Проблема 2: Курьер не найден
**Симптомы:** В логах "Courier not found and external couriers not allowed"
**Решение:**
- Убедитесь, что `allow_external_couriers = true` у исполнителя
- Проверьте, что `telegram_user_id` совпадает с ID курьера в Telegram

### Проблема 3: Заказ не обновляется
**Симптомы:** В логах "Error updating order executor"
**Решение:**
- Проверьте, что статус заказа = 'searching'
- Проверьте права доступа в базе данных
- Убедитесь, что `order_executor_id` правильный

## Контакты для помощи
Если проблема не решена, предоставьте:
1. Скриншот настроек исполнителя
2. Логи из Supabase Functions
3. Скриншот Telegram сообщения с кнопкой
