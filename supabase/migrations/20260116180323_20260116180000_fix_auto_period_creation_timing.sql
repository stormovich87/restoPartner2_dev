/*
  # Исправление автоматического создания периодов

  1. Изменения
    - Следующий период начинается на следующий день после окончания текущего
    - Cron job запускается в 00:00 каждый день вместо каждого часа
    - Проверка происходит с учётом временной зоны партнёра

  2. Логика
    - Текущий период закрывается в 23:59:59 последнего дня
    - Следующий период начинается в 00:00 следующего дня
    - Проверка выполняется ежедневно в полночь по UTC
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

    -- Проверяем, нужно ли закрыть период
    -- Период закрывается если его дата окончания <= текущей даты в timezone партнёра
    IF date(v_active_period.period_end AT TIME ZONE COALESCE(v_settings.timezone, 'UTC')) <= date(v_local_now) THEN
      -- Определяем фактическую дату закрытия
      -- Если period_end в будущем, закрываем сегодня, иначе используем period_end
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
      -- Следующий период начинается на следующий день после закрытия
      v_next_start := v_actual_end + interval '1 day';
      -- Обнуляем время до 00:00:00
      v_next_start := date_trunc('day', v_next_start);

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

      RAISE NOTICE 'Auto-created next payroll period for partner %. Closed at %, Next starts at %',
        v_active_period.partner_id, v_actual_end, v_next_start;
    END IF;
  END LOOP;
END;
$$;

-- Удаляем старый cron job
SELECT cron.unschedule('auto-create-payroll-periods');

-- Создаём новый cron job для автоматического создания периодов (каждый день в полночь по UTC)
SELECT cron.schedule(
  'auto-create-payroll-periods',
  '0 0 * * *', -- Каждый день в 00:00 UTC
  $$SELECT auto_create_next_payroll_period();$$
);
