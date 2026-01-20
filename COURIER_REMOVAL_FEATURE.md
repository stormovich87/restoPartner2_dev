# Функция "Без курьера"

## Описание
Реализована функция снятия назначенного курьера с заказа через кнопку "Без курьера" в модальном окне выбора курьера.

## Логика работы

### Условия активации кнопки
Кнопка "Без курьера" активна только если:
- У заказа есть назначенный курьер (`courier_id` не null)
- Сохранён `courier_message_id` (ID сообщения в личке курьера)
- Не идёт активный поиск курьера (`courier_search_started_at` = null)

### Процесс снятия курьера

1. **Получение данных заказа**
   - Находится заказ по ID
   - Извлекаются: `courier.telegram_user_id`, `courier_message_id`, `partner_settings.courier_bot_token`

2. **Удаление Telegram-сообщения курьера**
   - Удаляется **ТОЛЬКО** личное сообщение курьера (из `courier_message_id`)
   - Сообщения в группе филиала НЕ трогаются
   - Если все три значения существуют, вызывается edge-функция `delete-telegram-message`
   - URL: `/functions/v1/delete-telegram-message`
   - Метод: POST
   - Body:
     ```json
     {
       "bot_token": "<courier_bot_token>",
       "chat_id": "<courier.telegram_user_id>",
       "message_id": <courier_message_id (преобразуется в число)>
     }
     ```
   - Ошибки удаления не блокируют обновление заказа (логируются)

3. **Обновление заказа в базе данных**
   Независимо от результата удаления сообщения, обновляются поля:
   - `courier_id` = null
   - `courier_message_id` = null
   - `executor_id` = null
   - `executor_type` = null
   - `assignment_status` = null
   - `telegram_message_id` = null
   - `courier_search_started_at` = null

4. **Обновление UI**
   - Кнопка возвращается в состояние "Найти курьера"
   - Модальное окно закрывается

## Логирование

### Успешное удаление сообщения
```
Уровень: INFO
Секция: telegram
Сообщение: "Удалено личное сообщение у курьера при снятии с заказа"
Детали: orderId, courierId, courierName, messageId
```

### Ошибка удаления сообщения
```
Уровень: WARNING
Секция: telegram
Сообщение: "Не удалось удалить личное сообщение у курьера при снятии с заказа"
Детали: orderId, courierId, courierName, error
```

### Успешное снятие курьера
```
Уровень: INFO
Секция: orders
Сообщение: "Курьер снят с заказа через кнопку 'Без курьера'"
Детали: orderId, orderNumber, removedCourierId, removedCourierName
```

## Файлы изменений
- `/src/pages/partner/Orders.tsx` - основная логика и UI кнопки

## Используемые edge-функции
- `delete-telegram-message` - удаление сообщения в Telegram (без изменений)

## Отладка

Добавлены детальные console.log для отладки процесса удаления:
- `updateOrderCourier conditions:` - показывает все условия перед проверкой
- `✅ All conditions met` - все условия выполнены, начинается удаление
- `Delete message response status:` - HTTP статус ответа от edge-функции
- `Delete message result:` - полный результат удаления
- `✅ Successfully deleted` - сообщение успешно удалено
- `❌ Failed to delete` - ошибка при удалении
- `⚠️ Skipping message deletion` - показывает, какие данные отсутствуют

## Исправленные проблемы

### Проблема: telegram_user_id не загружался
**Причина:** В функции `loadData()` при загрузке заказов из БД не загружалось поле `telegram_user_id` курьера.

**Было:**
```typescript
courier:couriers(id, name, phone)
```

**Стало:**
```typescript
courier:couriers(id, name, lastname, phone, telegram_username, telegram_user_id, vehicle_type)
```

Теперь при загрузке заказов полная информация о курьере доступна для удаления личного сообщения.
