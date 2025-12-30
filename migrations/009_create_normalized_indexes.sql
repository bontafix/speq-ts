-- ============================================================================
-- Миграция 009: Создание индексов для normalized_parameters
-- ============================================================================
-- 
-- Создает B-Tree индексы на часто используемые параметры в normalized_parameters
-- для ускорения поиска по численным параметрам.
--
-- ВАЖНО: Запускать ПОСЛЕ заполнения normalized_parameters!
-- Иначе индексы будут пустыми.
--
-- Запуск:
-- psql -d equipment_catalog -f migrations/009_create_normalized_indexes.sql
-- ============================================================================

-- Индекс на вес (operating_weight_t)
CREATE INDEX IF NOT EXISTS idx_equipment_weight_normalized
ON equipment (((normalized_parameters->>'operating_weight_t')::numeric))
WHERE is_active = true 
  AND normalized_parameters->>'operating_weight_t' IS NOT NULL;

-- Индекс на мощность (engine_power_kw)
CREATE INDEX IF NOT EXISTS idx_equipment_power_normalized
ON equipment (((normalized_parameters->>'engine_power_kw')::numeric))
WHERE is_active = true 
  AND normalized_parameters->>'engine_power_kw' IS NOT NULL;

-- Индекс на грузоподъемность (lifting_capacity_t)
CREATE INDEX IF NOT EXISTS idx_equipment_lifting_capacity_normalized
ON equipment (((normalized_parameters->>'lifting_capacity_t')::numeric))
WHERE is_active = true 
  AND normalized_parameters->>'lifting_capacity_t' IS NOT NULL;

-- Индекс на глубину копания (excavation_depth_mm)
CREATE INDEX IF NOT EXISTS idx_equipment_excavation_depth_normalized
ON equipment (((normalized_parameters->>'excavation_depth_mm')::numeric))
WHERE is_active = true 
  AND normalized_parameters->>'excavation_depth_mm' IS NOT NULL;

-- Индекс на объем ковша (bucket_capacity_m3)
CREATE INDEX IF NOT EXISTS idx_equipment_bucket_capacity_normalized
ON equipment (((normalized_parameters->>'bucket_capacity_m3')::numeric))
WHERE is_active = true 
  AND normalized_parameters->>'bucket_capacity_m3' IS NOT NULL;

-- Индекс на высоту подъема (lifting_height_m)
CREATE INDEX IF NOT EXISTS idx_equipment_lifting_height_normalized
ON equipment (((normalized_parameters->>'lifting_height_m')::numeric))
WHERE is_active = true 
  AND normalized_parameters->>'lifting_height_m' IS NOT NULL;

-- Индекс на вылет стрелы (boom_reach_m)
CREATE INDEX IF NOT EXISTS idx_equipment_boom_reach_normalized
ON equipment (((normalized_parameters->>'boom_reach_m')::numeric))
WHERE is_active = true 
  AND normalized_parameters->>'boom_reach_m' IS NOT NULL;

-- Составной индекс для популярных комбинаций запросов
-- (вес + мощность - часто запрашивается вместе)
CREATE INDEX IF NOT EXISTS idx_equipment_weight_power_normalized
ON equipment (
  ((normalized_parameters->>'operating_weight_t')::numeric),
  ((normalized_parameters->>'engine_power_kw')::numeric)
)
WHERE is_active = true 
  AND normalized_parameters->>'operating_weight_t' IS NOT NULL
  AND normalized_parameters->>'engine_power_kw' IS NOT NULL;

-- Комментарии
COMMENT ON INDEX idx_equipment_weight_normalized IS 'B-Tree индекс для быстрого поиска по весу в normalized_parameters';
COMMENT ON INDEX idx_equipment_power_normalized IS 'B-Tree индекс для быстрого поиска по мощности в normalized_parameters';
COMMENT ON INDEX idx_equipment_lifting_capacity_normalized IS 'B-Tree индекс для быстрого поиска по грузоподъемности в normalized_parameters';
COMMENT ON INDEX idx_equipment_excavation_depth_normalized IS 'B-Tree индекс для быстрого поиска по глубине копания в normalized_parameters';
COMMENT ON INDEX idx_equipment_bucket_capacity_normalized IS 'B-Tree индекс для быстрого поиска по объему ковша в normalized_parameters';
COMMENT ON INDEX idx_equipment_lifting_height_normalized IS 'B-Tree индекс для быстрого поиска по высоте подъема в normalized_parameters';
COMMENT ON INDEX idx_equipment_boom_reach_normalized IS 'B-Tree индекс для быстрого поиска по вылету стрелы в normalized_parameters';
COMMENT ON INDEX idx_equipment_weight_power_normalized IS 'Составной индекс для поиска по весу и мощности одновременно';

-- Статистика по индексам
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE tablename = 'equipment'
  AND indexname LIKE '%normalized%'
ORDER BY indexname;

-- Проверка использования индексов
-- Раскомментируйте для тестирования:
-- EXPLAIN ANALYZE
-- SELECT * FROM equipment
-- WHERE (normalized_parameters->>'operating_weight_t')::numeric <= 25
--   AND is_active = true;

