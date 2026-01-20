/*
  # Добавление общего Telegram бота для всех филиалов

  ## Изменения
  1. Добавляется поле `main_telegram_bot_token` в таблицу `partner_settings`
    - Это будет единый бот для всех филиалов партнера
    - Используется для отправки уведомлений о заказах в групповые чаты филиалов
  
  2. Разделение ботов:
    - `courier_bot_token` - бот для регистрации курьеров (уже существует)
    - `main_telegram_bot_token` - общий бот для работы со всеми филиалами и уведомлений

  ## Обоснование
  Один общий бот для всех филиалов упрощает настройку и управление.
  Бот может работать с разными группами через разные chat_id.
*/

-- Добавляем поле для общего Telegram бота
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'main_telegram_bot_token'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN main_telegram_bot_token text;
  END IF;
END $$;