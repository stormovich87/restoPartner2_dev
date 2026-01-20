/*
  # Исправление функции расчёта конца периода

  1. Изменения
    - Период типа week: начало + 6 дней (23:59:59) вместо +7 дней
    - Период типа custom: начало + (N-1) дней (23:59:59) вместо +N дней
    - Период типа month: без изменений (последний день месяца 23:59:59)

  2. Пример
    - Week: если начало 17.01.2026 00:00, то конец 23.01.2026 23:59:59 (7 дней включая начало)
    - Custom (14 дней): если начало 17.01.2026 00:00, то конец 30.01.2026 23:59:59 (14 дней включая начало)
*/

-- Обновляем функцию для расчёта конца следующего периода
CREATE OR REPLACE FUNCTION calculate_next_period_end(
  p_start_date timestamptz,
  p_period_type text,
  p_custom_days int,
  p_timezone text
) RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
  v_end_date timestamptz;
  v_local_start timestamp;
BEGIN
  -- Конвертируем в локальную временную зону
  v_local_start := p_start_date AT TIME ZONE p_timezone;
  
  CASE p_period_type
    WHEN 'week' THEN
      -- Добавляем 6 дней (7 дней включая начальный) и устанавливаем время 23:59:59
      v_end_date := ((v_local_start::date + interval '6 days') + time '23:59:59') AT TIME ZONE p_timezone;
      
    WHEN 'month' THEN
      -- Добавляем 1 месяц и устанавливаем последний день месяца с 23:59:59
      v_end_date := (date_trunc('month', v_local_start + interval '1 month') + interval '1 month' - interval '1 day' + time '23:59:59') AT TIME ZONE p_timezone;
      
    WHEN 'custom' THEN
      -- Добавляем (N-1) дней (N дней включая начальный) и устанавливаем время 23:59:59
      v_end_date := ((v_local_start::date + ((p_custom_days - 1) || ' days')::interval) + time '23:59:59') AT TIME ZONE p_timezone;
      
    ELSE
      -- По умолчанию месяц
      v_end_date := (date_trunc('month', v_local_start + interval '1 month') + interval '1 month' - interval '1 day' + time '23:59:59') AT TIME ZONE p_timezone;
  END CASE;
  
  RETURN v_end_date;
END;
$$;
