-- ============================================================================
-- Миграция 001: Создание таблицы equipment с поддержкой FTS и pgvector
-- ============================================================================

-- 1. Включаем расширение pgvector (если ещё не включено)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Создаём таблицу equipment
CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  
  -- Основные поля
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  brand TEXT,
  region TEXT,
  description TEXT,
  
  -- Цена (может быть числом или текстом "по запросу")
  price NUMERIC,
  
  -- Технические параметры (JSONB для гибкости)
  main_parameters JSONB DEFAULT '{}',
  
  -- Флаг активности
  is_active BOOLEAN DEFAULT true,
  
  -- Full-Text Search вектор (заполняется автоматически триггером)
  search_vector TSVECTOR,
  
  -- Embedding вектор для семантического поиска (заполняется worker'ом)
  -- Размерность 768 для модели nomic-embed-text
  -- Если используете другую модель, измените размерность:
  --   - nomic-embed-text: 768
  --   - text-embedding-3-small (OpenAI): 1536
  --   - text-embedding-3-large (OpenAI): 3072
  embedding VECTOR(768),
  
  -- Метаданные
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Создаём индексы для быстрого поиска

-- Индекс для FTS (GIN)
CREATE INDEX IF NOT EXISTS idx_equipment_search_vector 
  ON equipment USING GIN(search_vector);

-- Индекс для векторного поиска (HNSW - быстрее, но больше памяти)
-- Альтернатива: USING ivfflat (меньше памяти, но медленнее)
CREATE INDEX IF NOT EXISTS idx_equipment_embedding 
  ON equipment USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Индексы для частых фильтров
CREATE INDEX IF NOT EXISTS idx_equipment_category 
  ON equipment(category) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_equipment_brand 
  ON equipment(brand) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_equipment_region 
  ON equipment(region) WHERE is_active = true;

-- Индекс для поиска записей без эмбеддинга (для worker)
CREATE INDEX IF NOT EXISTS idx_equipment_null_embedding 
  ON equipment(id) WHERE embedding IS NULL AND is_active = true;

-- 4. Создаём функцию для автоматического обновления search_vector
CREATE OR REPLACE FUNCTION equipment_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Формируем tsvector из текстовых полей с разными весами:
  -- A - самый важный (название)
  -- B - важный (категория, подкатегория)
  -- C - средний (бренд, регион)
  -- D - менее важный (описание)
  NEW.search_vector :=
    setweight(to_tsvector('russian', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(NEW.category, '')), 'B') ||
    setweight(to_tsvector('russian', coalesce(NEW.subcategory, '')), 'B') ||
    setweight(to_tsvector('russian', coalesce(NEW.brand, '')), 'C') ||
    setweight(to_tsvector('russian', coalesce(NEW.region, '')), 'C') ||
    setweight(to_tsvector('russian', coalesce(NEW.description, '')), 'D');
  
  -- Обновляем timestamp
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Создаём триггер для автоматического заполнения search_vector
DROP TRIGGER IF EXISTS equipment_search_vector_trigger ON equipment;

CREATE TRIGGER equipment_search_vector_trigger
  BEFORE INSERT OR UPDATE ON equipment
  FOR EACH ROW
  EXECUTE FUNCTION equipment_search_vector_update();

-- 6. Создаём функцию для векторного поиска
CREATE OR REPLACE FUNCTION equipment_vector_search(p_query TEXT, p_limit INT)
RETURNS SETOF equipment AS $$
DECLARE
  q_embedding VECTOR(768);
BEGIN
  -- Генерируем embedding для запроса через HTTP вызов к LLM
  -- ВАЖНО: PostgreSQL не может напрямую вызвать Ollama/OpenAI
  -- Поэтому здесь упрощённая версия - берём случайный embedding для примера
  -- В реальности, вызов LLM должен быть на стороне приложения (Node.js)
  
  -- Временное решение: используем первый доступный embedding
  -- В production нужно заменить на:
  -- 1. Вызов HTTP API к Ollama/OpenAI через pl/python или pl/http
  -- 2. Или передавать уже готовый embedding из Node.js
  SELECT embedding INTO q_embedding
  FROM equipment
  WHERE embedding IS NOT NULL
  LIMIT 1;
  
  -- Если нет ни одного embedding, возвращаем пустой результат
  IF q_embedding IS NULL THEN
    RETURN;
  END IF;
  
  -- Возвращаем топ-N наиболее похожих векторов
  -- Используем оператор <-> для косинусного расстояния
  RETURN QUERY
  SELECT e.*
  FROM equipment e
  WHERE e.embedding IS NOT NULL
    AND e.is_active = true
  ORDER BY e.embedding <-> q_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Готово! Теперь можно:
-- 1. Добавлять данные в таблицу equipment (search_vector заполнится автоматически)
-- 2. Запустить worker для генерации embeddings: npm run embed:equipment
-- ============================================================================

