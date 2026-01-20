/*
  # Автоматическое создание периодов выплат

  1. Функция
    - `auto_create_next_payroll_period()` - автоматически создаёт следующий период при окончании текущего
    
  2. Логика
    - Проверяет активные периоды, у которых дата окончания уже прошла
    - Закрывает текущий период (если конец > сегодня, устанавливает конец = сегодня)
    - Создаёт следующий период на основе настроек типа периода партнёра
    
  3. Cron Job
    - Запускается каждый час
    - Проверяет все партнёры и создаёт периоды при необходимости
*/

-- Функция для расчёта конца следующего периода
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
      -- Добавляем 7 дней
      v_end_date := (v_local_start + interval '7 days') AT TIME ZONE p_timezone;
      
    WHEN 'month' THEN
      -- Добавляем 1 месяц и устанавливаем последний день месяца
      v_end_date := (date_trunc('month', v_local_start + interval '1 month') + interval '1 month' - interval '1 day' + time '23:59:59') AT TIME ZONE p_timezone;
      
    WHEN 'custom' THEN
      -- Добавляем пользовательское количество дней
      v_end_date := (v_local_start + (p_custom_days || ' days')::interval) AT TIME ZONE p_timezone;
      
    ELSE
      -- По умолчанию месяц
      v_end_date := (date_trunc('month', v_local_start + interval '1 month') + interval '1 month' - interval '1 day' + time '23:59:59') AT TIME ZONE p_timezone;
  END CASE;
  
  RETURN v_end_date;
END;
$$;

-- Функция для автоматического создания следующего периода
CREATE OR REPLACE FUNCTION auto_create_next_payroll_period()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_active_period record;
  v_settings record;
  v_today timestamptz;
  v_actual_end timestamptz;
  v_next_start timestamptz;
  v_next_end timestamptz;
  v_next_order int;
BEGIN
  v_today := now();
  
  -- Находим все активные периоды, у которых дата окончания уже прошла
  FOR v_active_period IN
    SELECT * FROM kpi_payroll_periods
    WHERE status = 'active'
    AND period_end <= v_today
  LOOP
    -- Получаем настройки партнёра
    SELECT 
      kpi_payroll_period_type,
      kpi_payroll_custom_days,
      timezone
    INTO v_settings
    FROM partner_settings
    WHERE partner_id = v_active_period.partner_id;
    
    -- Пропускаем если настройки не найдены
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    
    -- Определяем фактическую дату закрытия (не может быть больше сегодня)
    IF v_active_period.period_end > v_today THEN
      v_actual_end := v_today;
    ELSE
      v_actual_end := v_active_period.period_end;
    END IF;
    
    -- Закрываем текущий период
    UPDATE kpi_payroll_periods
    SET 
      status = 'closed',
      closed_at = v_today,
      period_end = v_actual_end
    WHERE id = v_active_period.id;
    
    -- Рассчитываем даты следующего периода
    v_next_start := v_actual_end;
    v_next_end := calculate_next_period_end(
      v_next_start,
      v_settings.kpi_payroll_period_type,
      v_settings.kpi_payroll_custom_days,
      COALESCE(v_settings.timezone, 'UTC')
    );
    v_next_order := v_active_period.period_order + 1;
    
    -- Создаём следующий период
    INSERT INTO kpi_payroll_periods (
      partner_id,
      period_start,
      period_end,
      period_type,
      status,
      is_first,
      period_order,
      snapshot_data
    ) VALUES (
      v_active_period.partner_id,
      v_next_start,
      v_next_end,
      v_settings.kpi_payroll_period_type,
      'active',
      false,
      v_next_order,
      '{}'::jsonb
    );
    
    RAISE NOTICE 'Auto-created next payroll period for partner %', v_active_period.partner_id;
  END LOOP;
END;
$$;

-- Создаём cron job для автоматического создания периодов (каждый час)
SELECT cron.schedule(
  'auto-create-payroll-periods',
  '0 * * * *', -- Каждый час в начале часа
  $$SELECT auto_create_next_payroll_period();$$
);