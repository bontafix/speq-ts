-- ============================================================================
-- Миграция 007: Создание справочника параметров parameter_dictionary
-- ============================================================================

-- Создаём таблицу справочника параметров
CREATE TABLE IF NOT EXISTS parameter_dictionary (
  -- Уникальный ключ параметра (canonical)
  key TEXT PRIMARY KEY,
  
  -- Человекочитаемое название (для отображения)
  label_ru TEXT NOT NULL,
  label_en TEXT,
  
  -- Описание параметра на русском
  description_ru TEXT,
  
  -- Категория параметра (для группировки)
  category TEXT NOT NULL,
  -- Примеры категорий:
  -- 'weight' - масса, вес
  -- 'power' - мощность
  -- 'dimensions' - размеры
  -- 'performance' - производительность
  -- 'fuel' - топливо, энергия
  -- 'drive' - ходовая часть
  -- 'environment' - экология, выбросы
  -- 'capacity' - грузоподъёмность, объём
  -- 'other' - прочее
  
  -- Тип параметра
  param_type TEXT NOT NULL CHECK (param_type IN ('number', 'enum', 'boolean')),
  
  -- Единица измерения (только для number)
  unit TEXT,
  
  -- Для number: допустимые значения (диапазон)
  min_value NUMERIC,
  max_value NUMERIC,
  
  -- Для enum: возможные значения с описаниями
  enum_values JSONB,
  -- Формат: {"diesel": "дизель", "petrol": "бензин"}
  
  -- Алиасы (варианты названий из исходных данных)
  aliases JSONB DEFAULT '[]'::jsonb,
  
  -- SQL выражение для доступа к значению
  sql_expression TEXT NOT NULL,
  
  -- Метаданные
  is_searchable BOOLEAN DEFAULT true,
  is_filterable BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- приоритет для отображения (0 = самый важный)
  
  -- Версионирование
  version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_parameter_dictionary_aliases
ON parameter_dictionary
USING gin (aliases);

CREATE INDEX IF NOT EXISTS idx_parameter_dictionary_type
ON parameter_dictionary (param_type);

CREATE INDEX IF NOT EXISTS idx_parameter_dictionary_category
ON parameter_dictionary (category);

-- Комментарии к таблице
COMMENT ON TABLE parameter_dictionary IS 'Справочник параметров оборудования - единый источник истины для нормализации';
COMMENT ON COLUMN parameter_dictionary.key IS 'Canonical ключ параметра (латиница, snake_case)';
COMMENT ON COLUMN parameter_dictionary.label_ru IS 'Название параметра на русском для отображения';
COMMENT ON COLUMN parameter_dictionary.description_ru IS 'Описание параметра на русском';
COMMENT ON COLUMN parameter_dictionary.category IS 'Категория параметра для группировки';
COMMENT ON COLUMN parameter_dictionary.param_type IS 'Тип параметра: number, enum, boolean';
COMMENT ON COLUMN parameter_dictionary.aliases IS 'Массив алиасов (вариантов названий) для поиска';
COMMENT ON COLUMN parameter_dictionary.sql_expression IS 'SQL выражение для доступа к значению в normalized_parameters';

