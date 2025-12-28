-- ============================================================================
-- Миграция 004: Улучшенная версия equipment_vector_search
-- ============================================================================
-- Эта версия принимает готовый embedding вектора запроса,
-- который должен быть рассчитан в Node.js через LLM API.
--
-- Использование из Node.js:
--   1. Сгенерировать embedding для запроса через LLM
--   2. Вызвать функцию с готовым embedding
--
-- Пример:
--   SELECT * FROM equipment_vector_search_by_embedding(
--     '[0.123, -0.456, ...]'::vector,
--     10
--   );

CREATE OR REPLACE FUNCTION equipment_vector_search_by_embedding(
  p_embedding VECTOR,
  p_limit INT
)
RETURNS TABLE (
  id INTEGER,
  url VARCHAR(500),
  name VARCHAR(300),
  category VARCHAR(100),
  subcategory VARCHAR(100),
  brand VARCHAR(100),
  region VARCHAR(100),
  description TEXT,
  main_parameters JSONB,
  additional_parameters JSONB,
  price VARCHAR(100),
  photo_links JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  embedding VECTOR,
  is_active BOOLEAN,
  search_vector TSVECTOR,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.url,
    e.name,
    e.category,
    e.subcategory,
    e.brand,
    e.region,
    e.description,
    e.main_parameters,
    e.additional_parameters,
    e.price,
    e.photo_links,
    e.created_at,
    e.updated_at,
    e.embedding,
    e.is_active,
    e.search_vector,
    -- Косинусное расстояние (1 - cosine similarity)
    -- Чем меньше значение, тем больше похожесть
    1 - (e.embedding <=> p_embedding) AS similarity
  FROM equipment e
  WHERE e.embedding IS NOT NULL
    AND e.is_active = true
  ORDER BY e.embedding <=> p_embedding  -- Косинусное расстояние
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Комментарий к функции
COMMENT ON FUNCTION equipment_vector_search_by_embedding(VECTOR, INT) IS 
'Векторный поиск по готовому embedding. Используйте эту функцию из Node.js после генерации embedding запроса через LLM API.';

