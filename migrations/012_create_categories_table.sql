-- ============================================================================
-- Миграция 012: Создание таблицы categories (категории с иерархией)
-- ============================================================================

-- Создаём таблицу categories
CREATE TABLE IF NOT EXISTS categories (
  -- Уникальный идентификатор
  id SERIAL PRIMARY KEY,
  
  -- Название категории (уникальное)
  name TEXT NOT NULL UNIQUE,
  
  -- Родительская категория (для иерархии)
  -- NULL означает корневую категорию
  parent_id INTEGER,
  
  -- Флаг активности
  is_active BOOLEAN DEFAULT true,
  
  -- Метаданные
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Внешний ключ на родительскую категорию
  CONSTRAINT fk_categories_parent 
    FOREIGN KEY (parent_id) 
    REFERENCES categories(id) 
    ON DELETE SET NULL
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_categories_parent_id 
  ON categories(parent_id) 
  WHERE parent_id IS NOT NULL;

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS categories_updated_at_trigger ON categories;

CREATE TRIGGER categories_updated_at_trigger
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION categories_updated_at();

-- Комментарии
COMMENT ON TABLE categories IS 'Иерархическая структура категорий оборудования';
COMMENT ON COLUMN categories.id IS 'Уникальный идентификатор категории (автоинкремент)';
COMMENT ON COLUMN categories.name IS 'Название категории (уникальное)';
COMMENT ON COLUMN categories.parent_id IS 'Идентификатор родительской категории (NULL для корневых)';
COMMENT ON COLUMN categories.is_active IS 'Флаг активности категории';

-- ============================================================================
-- Готово! Таблица categories создана с поддержкой иерархии
-- ============================================================================
