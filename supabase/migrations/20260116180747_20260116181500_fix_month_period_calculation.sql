/*
  # Исправление расчёта месячного периода

  1. Изменения
    - Месячный период: начало + 1 месяц - 1 день (23:59:59)
    - Пример: 17.01.2026 00:00 → 16.02.2026 23:59:59

  2. Логика
    - Период включает полный месяц от даты начала
    - Если начало 17.01, то конец 16.02
    - Если начало 31.01, то конец 28/29.02 (зависит от длины месяца)
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
  v_temp_date timestamp;
BEGIN
  -- Конвертируем в локальную временную зону
  v_local_start := p_start_date AT TIME ZONE p_timezone;
  
  CASE p_period_type
    WHEN 'week' THEN
      -- Добавляем 6 дней (7 дней включая начальный) и устанавливаем время 23:59:59
      v_end_date := ((v_local_start::date + interval '6 days') + time '23:59:59') AT TIME ZONE p_timezone;
      
    WHEN 'month' THEN
      -- Добавляем 1 месяц и вычитаем 1 день (получается начало + месяц - 1 день)
      v_temp_date := v_local_start + interval '1 month' - interval '1 day';
      v_end_date := ((v_temp_date::date) + time '23:59:59') AT TIME ZONE p_timezone;
      
    WHEN 'custom' THEN
      -- Добавляем (N-1) дней (N дней включая начальный) и устанавливаем время 23:59:59
      v_end_date := ((v_local_start::date + ((p_custom_days - 1) || ' days')::interval) + time '23:59:59') AT TIME ZONE p_timezone;
      
    ELSE
      -- По умолчанию месяц
      v_temp_date := v_local_start + interval '1 month' - interval '1 day';
      v_end_date := ((v_temp_date::date) + time '23:59:59') AT TIME ZONE p_timezone;
  END CASE;
  
  RETURN v_end_date;
END;
$$;
