/*
  # Удаление telegram_bot_token из филиалов

  ## Изменения
  - Удаляется поле `telegram_bot_token` из таблицы `branches`
  - Теперь используется единый бот из `partner_settings.courier_bot_token` для всех филиалов

  ## Обоснование
  Один бот может работать с несколькими группами через разные chat_id.
  Это упрощает настройку и управление ботами.
*/

-- Удаляем поле telegram_bot_token из таблицы branches
ALTER TABLE branches DROP COLUMN IF EXISTS telegram_bot_token;
