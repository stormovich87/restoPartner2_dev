/*
  # Корректировка автоматического закрытия периода

  1. Изменения
    - Период закрывается в 23:59:59 последнего дня
    - Следующий период начинается в 00:00 следующего дня
    - Проверка происходит после полуночи дня окончания периода

  2. Пример
    - Текущий период: 16.01.2026 - 16.02.2026
    - Автоматически закроется: 16.02.2026 в 23:59:59
    - Следующий период начнётся: 17.02.2026 в 00:00
    - Проверка произойдёт: 17.02.2026 в 00:00
*/

-- Обновляем функцию для автоматического создания следующего периода
CREATE OR REPLACE FUNCTION auto_create_next_payroll_period()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_active_period record;
  v_settings record;
  v_today timestamptz;
  v_local_now timestamp;
  v_period_end_date date;
  v_current_date date;
  v_actual_end timestamptz;
  v_next_start timestamptz;
  v_next_end timestamptz;
  v_next_order int;
BEGIN
  -- Находим все активные периоды
  FOR v_active_period IN
    SELECT * FROM kpi_payroll_periods
    WHERE status = 'active'
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

    -- Получаем текущее время в timezone партнёра
    v_local_now := now() AT TIME ZONE COALESCE(v_settings.timezone, 'UTC');
    v_today := now();

    -- Получаем даты для сравнения
    v_period_end_date := date(v_active_period.period_end AT TIME ZONE COALESCE(v_settings.timezone, 'UTC'));
    v_current_date := date(v_local_now);

    -- Проверяем, нужно ли закрыть период
    -- Период закрывается если текущая дата > даты окончания периода
    -- То есть закрытие происходит на следующий день после даты окончания
    IF v_current_date > v_period_end_date THEN
      -- Определяем фактическую дату закрытия с временем 23:59:59
      -- Берём дату окончания периода и устанавливаем время 23:59:59
      v_actual_end := (v_period_end_date + time '23:59:59') AT TIME ZONE COALESCE(v_settings.timezone, 'UTC');
      
      -- Если actual_end получился в будущем, используем текущее время
      IF v_actual_end > v_today THEN
        v_actual_end := v_today;
      END IF;

      -- Закрываем текущий период
      UPDATE kpi_payroll_periods
      SET
        status = 'closed',
        closed_at = v_today,
        period_end = v_actual_end
      WHERE id = v_active_period.id;

      -- Рассчитываем даты следующего периода
      -- Следующий период начинается в 00:00 следующего дня после даты окончания
      v_next_start := (v_period_end_date + interval '1 day') AT TIME ZONE COALESCE(v_settings.timezone, 'UTC');
      
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

      RAISE NOTICE 'Auto-created next payroll period for partner %. Closed at % (23:59:59), Next starts at % (00:00:00)',
        v_active_period.partner_id, v_period_end_date, v_period_end_date + interval '1 day';
    END IF;
  END LOOP;
END;
$$;
