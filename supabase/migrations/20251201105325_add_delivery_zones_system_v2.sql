/*
  # Система зон доставки

  1. Новые таблицы
    - `courier_delivery_zones` - общие зоны доставки для курьеров компании
    - `performer_delivery_zones` - персональные зоны доставки исполнителей
    - `performer_distance_rules` - правила расчёта по дистанции для исполнителей

  2. Изменения в существующих таблицах
    - `partner_settings` - добавить courier_no_zone_message
    - `executors` - добавить delivery_zone_mode и no_zone_message
    - `orders` - добавить поля для отслеживания назначения и цены доставки

  3. Security
    - Enable RLS на новых таблицах
    - Политики настроены для anon доступа (для внутренней CRM)
*/

-- Таблица зон доставки курьеров (общие для компании)
CREATE TABLE IF NOT EXISTS courier_delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  price_uah numeric(10, 2) NOT NULL DEFAULT 0,
  polygon jsonb NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE courier_delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on courier zones"
  ON courier_delivery_zones FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Таблица зон доставки исполнителей (персональные)
CREATE TABLE IF NOT EXISTS performer_delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performer_id uuid NOT NULL REFERENCES executors(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#10B981',
  price_uah numeric(10, 2) NOT NULL DEFAULT 0,
  polygon jsonb NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE performer_delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on performer zones"
  ON performer_delivery_zones FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Таблица правил расчёта по дистанции для исполнителей
CREATE TABLE IF NOT EXISTS performer_distance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performer_id uuid NOT NULL REFERENCES executors(id) ON DELETE CASCADE,
  max_distance_km numeric(10, 2) NOT NULL,
  price_uah numeric(10, 2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE performer_distance_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on distance rules"
  ON performer_distance_rules FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Добавить поля в partner_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_settings' AND column_name = 'courier_no_zone_message'
  ) THEN
    ALTER TABLE partner_settings ADD COLUMN courier_no_zone_message text DEFAULT 'Адрес вне зоны доставки';
  END IF;
END $$;

-- Добавить поля в executors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'executors' AND column_name = 'delivery_zone_mode'
  ) THEN
    ALTER TABLE executors ADD COLUMN delivery_zone_mode text DEFAULT 'distance';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'executors' AND column_name = 'no_zone_message'
  ) THEN
    ALTER TABLE executors ADD COLUMN no_zone_message text DEFAULT 'Адрес вне зоны доставки исполнителя';
  END IF;
END $$;

-- Добавить поля в orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_price_uah'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_price_uah numeric(10, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_price_manual'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_price_manual boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'executor_type'
  ) THEN
    ALTER TABLE orders ADD COLUMN executor_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'executor_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN executor_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'assignment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN assignment_status text DEFAULT 'searching';
  END IF;
END $$;

-- Добавить те же поля в archived_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'delivery_price_uah'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN delivery_price_uah numeric(10, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'delivery_price_manual'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN delivery_price_manual boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'executor_type'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN executor_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'executor_id'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN executor_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'archived_orders' AND column_name = 'assignment_status'
  ) THEN
    ALTER TABLE archived_orders ADD COLUMN assignment_status text DEFAULT 'searching';
  END IF;
END $$;

-- Создать индексы
CREATE INDEX IF NOT EXISTS idx_courier_delivery_zones_partner ON courier_delivery_zones(partner_id);
CREATE INDEX IF NOT EXISTS idx_performer_delivery_zones_performer ON performer_delivery_zones(performer_id);
CREATE INDEX IF NOT EXISTS idx_performer_distance_rules_performer ON performer_distance_rules(performer_id);
CREATE INDEX IF NOT EXISTS idx_orders_assignment_status ON orders(assignment_status);
CREATE INDEX IF NOT EXISTS idx_orders_executor_type ON orders(executor_type);
CREATE INDEX IF NOT EXISTS idx_orders_executor_id ON orders(executor_id);
