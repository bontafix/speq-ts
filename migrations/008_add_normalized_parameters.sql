-- ============================================================================
-- Миграция 008: Добавление поля normalized_parameters в таблицу equipment
-- ============================================================================

-- Добавляем поле для нормализованных параметров
ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS normalized_parameters JSONB DEFAULT '{}'::jsonb;

-- Добавляем поле для версионирования нормализации
ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS normalized_at TIMESTAMP;

-- Индекс GIN для быстрого поиска по JSONB
CREATE INDEX IF NOT EXISTS idx_equipment_normalized_params_gin
ON equipment
USING gin (normalized_parameters jsonb_path_ops)
WHERE is_active = true;

-- B-Tree индексы для часто используемых параметров (создадим после заполнения справочника)
-- Примеры:
-- CREATE INDEX idx_equipment_weight_kg
-- ON equipment (((normalized_parameters->>'weight_kg')::numeric))
-- WHERE is_active = true AND normalized_parameters->>'weight_kg' IS NOT NULL;

-- Комментарии
COMMENT ON COLUMN equipment.normalized_parameters IS 'Нормализованные (canonical) параметры для SQL-фильтрации и поиска';
COMMENT ON COLUMN equipment.normalized_at IS 'Дата последней нормализации параметров';

