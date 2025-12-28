-- ============================================================================
-- Миграция 003: Проверка и создание функции equipment_vector_search
-- ============================================================================
-- Эта миграция проверяет, существует ли функция equipment_vector_search,
-- и создаёт её, если отсутствует.
--
-- ВАЖНО: Функция использует упрощённый подход - берёт случайный embedding
-- для поиска. В production рекомендуется передавать embedding запроса
-- из Node.js приложения.

-- Проверяем, существует ли функция, и создаём её если нужно
DO $$
BEGIN
  -- Если функция не существует, создаём её
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'equipment_vector_search'
      AND n.nspname = 'public'
  ) THEN
    -- Создаём функцию через EXECUTE (динамический SQL)
    EXECUTE '
    CREATE OR REPLACE FUNCTION equipment_vector_search(p_query TEXT, p_limit INT)
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
      search_vector TSVECTOR
    ) AS $func$
    DECLARE
      q_embedding VECTOR;
      embedding_dim INT;
    BEGIN
      -- Получаем размерность embedding из первой записи с embedding
      SELECT array_length(embedding::real[], 1) INTO embedding_dim
      FROM equipment
      WHERE embedding IS NOT NULL
      LIMIT 1;
      
      -- Если нет ни одного embedding, возвращаем пустой результат
      IF embedding_dim IS NULL THEN
        RAISE NOTICE ''Нет записей с embedding. Запустите worker: npm run embed:equipment'';
        RETURN;
      END IF;
      
      -- ВАЖНО: Это упрощённая версия!
      -- В реальности нужно:
      -- 1. Вызвать LLM API из Node.js для генерации embedding запроса
      -- 2. Передать готовый embedding в эту функцию
      -- 
      -- Здесь мы используем первый доступный embedding как пример
      -- Это НЕ даст правильных результатов поиска!
      -- 
      -- Для правильной работы используйте прямой вызов из Node.js:
      -- SELECT ... FROM equipment WHERE embedding <-> $1::vector ORDER BY ... LIMIT ...
      
      SELECT embedding INTO q_embedding
      FROM equipment
      WHERE embedding IS NOT NULL
        AND is_active = true
      LIMIT 1;
      
      IF q_embedding IS NULL THEN
        RETURN;
      END IF;
      
      -- Возвращаем топ-N наиболее похожих векторов
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
        e.search_vector
      FROM equipment e
      WHERE e.embedding IS NOT NULL
        AND e.is_active = true
      ORDER BY e.embedding <-> q_embedding
      LIMIT p_limit;
    END;
    $func$ LANGUAGE plpgsql STABLE;
    ';
    
    RAISE NOTICE 'Функция equipment_vector_search создана';
  ELSE
    RAISE NOTICE 'Функция equipment_vector_search уже существует';
  END IF;
END $$;

-- Проверяем, что функция создана
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'equipment_vector_search'
  AND n.nspname = 'public';

