/*
  # Поддержка множественных полигонов в зонах доставки

  1. Новые таблицы
    - `courier_zone_polygons` - полигоны для зон курьеров (одна зона может иметь несколько полигонов)
    - `performer_zone_polygons` - полигоны для зон исполнителей (одна зона может иметь несколько полигонов)

  2. Миграция данных
    - Перенести существующие полигоны из courier_delivery_zones в courier_zone_polygons
    - Перенести существующие полигоны из performer_delivery_zones в performer_zone_polygons
    - Удалить колонку polygon из основных таблиц

  3. Security
    - Enable RLS на новых таблицах
    - Политики настроены для anon доступа (для внутренней CRM)
*/

-- Таблица полигонов для зон курьеров
CREATE TABLE IF NOT EXISTS courier_zone_polygons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES courier_delivery_zones(id) ON DELETE CASCADE,
  polygon jsonb NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE courier_zone_polygons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on courier zone polygons"
  ON courier_zone_polygons FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_courier_zone_polygons_zone ON courier_zone_polygons(zone_id);

-- Таблица полигонов для зон исполнителей
CREATE TABLE IF NOT EXISTS performer_zone_polygons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES performer_delivery_zones(id) ON DELETE CASCADE,
  polygon jsonb NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE performer_zone_polygons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on performer zone polygons"
  ON performer_zone_polygons FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_performer_zone_polygons_zone ON performer_zone_polygons(zone_id);

-- Миграция существующих данных из courier_delivery_zones
DO $$
DECLARE
  zone_record RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courier_delivery_zones' AND column_name = 'polygon'
  ) THEN
    FOR zone_record IN
      SELECT id, polygon FROM courier_delivery_zones WHERE polygon IS NOT NULL
    LOOP
      INSERT INTO courier_zone_polygons (zone_id, polygon, display_order)
      VALUES (zone_record.id, zone_record.polygon, 0);
    END LOOP;

    ALTER TABLE courier_delivery_zones DROP COLUMN IF EXISTS polygon;
  END IF;
END $$;

-- Миграция существующих данных из performer_delivery_zones
DO $$
DECLARE
  zone_record RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performer_delivery_zones' AND column_name = 'polygon'
  ) THEN
    FOR zone_record IN
      SELECT id, polygon FROM performer_delivery_zones WHERE polygon IS NOT NULL
    LOOP
      INSERT INTO performer_zone_polygons (zone_id, polygon, display_order)
      VALUES (zone_record.id, zone_record.polygon, 0);
    END LOOP;

    ALTER TABLE performer_delivery_zones DROP COLUMN IF EXISTS polygon;
  END IF;
END $$;