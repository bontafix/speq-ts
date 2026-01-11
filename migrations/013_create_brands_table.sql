-- ============================================================================
-- Миграция 013: Создание таблицы brands (бренды оборудования)
-- ============================================================================

-- Создаём таблицу brands
CREATE TABLE IF NOT EXISTS brands (
  -- Уникальный идентификатор
  id SERIAL PRIMARY KEY,
  
  -- Название бренда (уникальное)
  name TEXT NOT NULL UNIQUE,
  
  -- Флаг активности
  is_active BOOLEAN DEFAULT true,
  
  -- Метаданные
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Индекс для быстрого поиска по имени
CREATE INDEX IF NOT EXISTS idx_brands_name 
  ON brands(name);

-- Индекс для фильтрации активных брендов
CREATE INDEX IF NOT EXISTS idx_brands_is_active 
  ON brands(is_active) 
  WHERE is_active = true;

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION brands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS brands_updated_at_trigger ON brands;

CREATE TRIGGER brands_updated_at_trigger
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION brands_updated_at();

-- Комментарии
COMMENT ON TABLE brands IS 'Справочник брендов оборудования';
COMMENT ON COLUMN brands.id IS 'Уникальный идентификатор бренда (автоинкремент)';
COMMENT ON COLUMN brands.name IS 'Название бренда (уникальное)';
COMMENT ON COLUMN brands.is_active IS 'Флаг активности бренда';

-- ============================================================================
-- Готово! Таблица brands создана
-- ============================================================================
