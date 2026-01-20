/*
  # Модуль "Ингредиенты / Полуфабрикаты"

  ## Описание
  Создание системы управления ингредиентами, категориями и полуфабрикатами с интеграцией Poster.
  
  ## Новые таблицы
  
  ### 1. ingredient_categories
  Категории для группировки ингредиентов
  - `id` (uuid, primary key)
  - `partner_id` (uuid) - логическая ссылка на partners
  - `name` (text) - название категории
  - `is_active` (boolean) - статус активности
  - `sort_order` (int) - порядок сортировки
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 2. ingredients
  Справочник ингредиентов с поддержкой синхронизации из Poster
  - `id` (uuid, primary key)
  - `partner_id` (uuid) - логическая ссылка на partners
  - `name` (text) - название ингредиента
  - `category_id` (uuid) - логическая ссылка на ingredient_categories (БЕЗ FK)
  - `unit` (text) - единица измерения (pcs, kg, g, l, ml)
  - `is_active` (boolean) - статус активности
  - `poster_ingredient_id` (int) - ID в Poster
  - `source` (text) - источник создания (poster/manual)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 3. semi_finished_products
  Справочник полуфабрикатов
  - `id` (uuid, primary key)
  - `partner_id` (uuid) - логическая ссылка на partners
  - `name` (text) - название полуфабриката
  - `is_active` (boolean) - статус активности
  - `poster_product_id` (int) - ID продукта в Poster
  - `poster_techcard_id` (int) - ID техкарты в Poster
  - `source` (text) - источник создания (poster/manual)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 4. semi_finished_composition
  Состав полуфабрикатов (связь с ингредиентами)
  - `id` (uuid, primary key)
  - `partner_id` (uuid) - логическая ссылка на partners
  - `semi_finished_id` (uuid) - логическая ссылка на semi_finished_products (БЕЗ FK)
  - `ingredient_id` (uuid) - логическая ссылка на ingredients (БЕЗ FK)
  - `qty` (numeric) - количество
  - `unit` (text) - единица измерения
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 5. ingredients_sync_log
  Лог синхронизаций с Poster
  - `id` (uuid, primary key)
  - `partner_id` (uuid) - логическая ссылка на partners
  - `sync_type` (text) - тип синхронизации (ingredients/semi_finished)
  - `started_at` (timestamptz) - начало синхронизации
  - `completed_at` (timestamptz) - завершение синхронизации
  - `status` (text) - статус (pending/completed/failed)
  - `stats` (jsonb) - статистика синхронизации
  - `error_message` (text) - сообщение об ошибке
  
  ## Views для проверки целостности
  
  - `ingredients_orphan_categories` - ингредиенты без категории
  - `composition_orphan_ingredients` - составы с несуществующими ингредиентами
  - `composition_orphan_semi_finished` - составы с несуществующими полуфабрикатами
  
  ## Безопасность
  - RLS включен для всех таблиц
  - Доступ для authenticated пользователей
  - БЕЗ FOREIGN KEY из-за pg_restore --clean
*/

-- 1. Таблица категорий ингредиентов
CREATE TABLE IF NOT EXISTS ingredient_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ingredient_categories_partner ON ingredient_categories(partner_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_categories_active ON ingredient_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_ingredient_categories_sort ON ingredient_categories(sort_order);

ALTER TABLE ingredient_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on ingredient_categories"
  ON ingredient_categories FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Таблица ингредиентов
CREATE TABLE IF NOT EXISTS ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  name text NOT NULL,
  category_id uuid NOT NULL,
  unit text NOT NULL CHECK (unit IN ('pcs','kg','g','l','ml')),
  is_active boolean DEFAULT true,
  poster_ingredient_id int UNIQUE,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('poster', 'manual')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingredients_partner ON ingredients(partner_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);
CREATE INDEX IF NOT EXISTS idx_ingredients_poster_id ON ingredients(poster_ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_active ON ingredients(is_active);

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on ingredients"
  ON ingredients FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Таблица полуфабрикатов
CREATE TABLE IF NOT EXISTS semi_finished_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  poster_product_id int UNIQUE,
  poster_techcard_id int,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('poster', 'manual')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_semi_finished_partner ON semi_finished_products(partner_id);
CREATE INDEX IF NOT EXISTS idx_semi_finished_name ON semi_finished_products(name);
CREATE INDEX IF NOT EXISTS idx_semi_finished_poster_product ON semi_finished_products(poster_product_id);
CREATE INDEX IF NOT EXISTS idx_semi_finished_active ON semi_finished_products(is_active);

ALTER TABLE semi_finished_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on semi_finished_products"
  ON semi_finished_products FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Таблица составов полуфабрикатов
CREATE TABLE IF NOT EXISTS semi_finished_composition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  semi_finished_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  qty numeric NOT NULL,
  unit text NOT NULL CHECK (unit IN ('pcs','kg','g','l','ml')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(semi_finished_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_composition_partner ON semi_finished_composition(partner_id);
CREATE INDEX IF NOT EXISTS idx_composition_semi_finished ON semi_finished_composition(semi_finished_id);
CREATE INDEX IF NOT EXISTS idx_composition_ingredient ON semi_finished_composition(ingredient_id);

ALTER TABLE semi_finished_composition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on semi_finished_composition"
  ON semi_finished_composition FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Таблица логов синхронизации
CREATE TABLE IF NOT EXISTS ingredients_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  sync_type text NOT NULL CHECK (sync_type IN ('ingredients', 'semi_finished')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  stats jsonb,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_sync_log_partner ON ingredients_sync_log(partner_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_type ON ingredients_sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_started ON ingredients_sync_log(started_at);

ALTER TABLE ingredients_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on ingredients_sync_log"
  ON ingredients_sync_log FOR ALL
  USING (true)
  WITH CHECK (true);

-- Views для проверки целостности (битые ссылки)

-- Ингредиенты, у которых нет категории
CREATE OR REPLACE VIEW ingredients_orphan_categories AS
SELECT 
  i.id,
  i.partner_id,
  i.name,
  i.category_id
FROM ingredients i
WHERE NOT EXISTS (
  SELECT 1 FROM ingredient_categories ic 
  WHERE ic.id = i.category_id
);

-- Составы с несуществующими ингредиентами
CREATE OR REPLACE VIEW composition_orphan_ingredients AS
SELECT 
  c.id,
  c.partner_id,
  c.semi_finished_id,
  c.ingredient_id
FROM semi_finished_composition c
WHERE NOT EXISTS (
  SELECT 1 FROM ingredients i 
  WHERE i.id = c.ingredient_id
);

-- Составы с несуществующими полуфабрикатами
CREATE OR REPLACE VIEW composition_orphan_semi_finished AS
SELECT 
  c.id,
  c.partner_id,
  c.semi_finished_id,
  c.ingredient_id
FROM semi_finished_composition c
WHERE NOT EXISTS (
  SELECT 1 FROM semi_finished_products sf 
  WHERE sf.id = c.semi_finished_id
);

-- Enable realtime для отслеживания изменений
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ingredient_categories;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ingredients;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE semi_finished_products;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE semi_finished_composition;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ingredients_sync_log;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
