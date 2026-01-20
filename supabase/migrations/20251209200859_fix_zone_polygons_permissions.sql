/*
  # Исправление прав доступа для таблиц полигонов

  1. Изменения
    - Добавить GRANT права для anon и authenticated на courier_zone_polygons
    - Добавить GRANT права для anon и authenticated на performer_zone_polygons
    
  2. Security
    - Права необходимы для работы RLS политик
*/

-- Даем права на courier_zone_polygons
GRANT ALL ON courier_zone_polygons TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Даем права на performer_zone_polygons
GRANT ALL ON performer_zone_polygons TO anon, authenticated;
