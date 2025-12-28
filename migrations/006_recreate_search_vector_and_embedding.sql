-- ============================================================================
-- Миграция 006: Пересоздание search_vector и embedding для существующих данных
-- ============================================================================
-- Этот скрипт пересоздаёт search_vector и очищает embedding для всех записей
--
-- ВАЖНО: После выполнения этого скрипта нужно запустить worker для embedding:
--   npm run embed:equipment

-- ============================================================================
-- 1. Пересоздание search_vector (автоматически через триггер)
-- ============================================================================

-- Вариант 1: Просто обновить updated_at - триггер пересоздаст search_vector
UPDATE equipment 
SET updated_at = NOW()
WHERE is_active = true;

-- Вариант 2: Явно обнулить и обновить (если нужно)
-- UPDATE equipment 
-- SET search_vector = NULL, updated_at = NOW()
-- WHERE is_active = true;

-- Проверка результата
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE search_vector IS NOT NULL) AS with_search_vector,
  COUNT(*) FILTER (WHERE search_vector IS NULL) AS without_search_vector
FROM equipment
WHERE is_active = true;

-- ============================================================================
-- 2. Очистка embedding (для последующего пересчёта через worker)
-- ============================================================================

-- ВАЖНО: Сначала сделайте бэкап, если нужно сохранить старые embeddings!
-- ALTER TABLE equipment ADD COLUMN IF NOT EXISTS embedding_backup VECTOR;
-- UPDATE equipment SET embedding_backup = embedding WHERE embedding IS NOT NULL;

-- Очистить все embeddings
UPDATE equipment 
SET embedding = NULL
WHERE is_active = true;

-- Проверка результата
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS with_embedding,
  COUNT(*) FILTER (WHERE embedding IS NULL) AS without_embedding
FROM equipment
WHERE is_active = true;
-- Должно показать: without_embedding = total (все очищены)

-- ============================================================================
-- 3. После выполнения этого скрипта:
-- ============================================================================
-- 
-- 1. search_vector уже пересоздан (триггер сработал автоматически)
-- 
-- 2. Для embedding запустите worker:
--    npm run embed:equipment
-- 
-- 3. Проверьте результат:
--    SELECT COUNT(*) FROM equipment WHERE embedding IS NOT NULL;
--
-- ============================================================================

