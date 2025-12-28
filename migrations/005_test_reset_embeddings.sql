-- ============================================================================
-- Миграция 005: Тестовая очистка embedding и search_vector
-- ============================================================================
-- Этот файл содержит примеры SQL-запросов для тестирования
-- заполнения полей embedding и search_vector
--
-- ВНИМАНИЕ: Это тестовые запросы, не применяйте их напрямую!
-- Используйте их как примеры для своих экспериментов.

-- ============================================================================
-- 1. Очистка embedding у нескольких записей (для тестирования worker)
-- ============================================================================

-- Пример 1: Очистить embedding у первых 10 записей
-- UPDATE equipment 
-- SET embedding = NULL 
-- WHERE id IN (
--   SELECT id FROM equipment WHERE is_active = true LIMIT 10
-- );

-- Пример 2: Очистить embedding у записей определённой категории
-- UPDATE equipment 
-- SET embedding = NULL 
-- WHERE category = 'Экскаваторы' AND is_active = true;

-- Пример 3: Очистить embedding у конкретной записи по ID
-- UPDATE equipment 
-- SET embedding = NULL 
-- WHERE id = 123;

-- ============================================================================
-- 2. Очистка search_vector (заполнится автоматически при UPDATE)
-- ============================================================================

-- Пример: Очистить search_vector и обновить запись (триггер заполнит автоматически)
-- UPDATE equipment 
-- SET search_vector = NULL, name = name
-- WHERE id = 123;
-- -- После этого search_vector заполнится автоматически через триггер!

-- Или просто обновить любое поле - триггер пересоздаст search_vector:
-- UPDATE equipment 
-- SET updated_at = NOW()
-- WHERE id = 123;
-- -- search_vector обновится автоматически

-- ============================================================================
-- 3. Проверка записей без embedding (для worker)
-- ============================================================================

-- Сколько записей без embedding?
-- SELECT COUNT(*) 
-- FROM equipment 
-- WHERE embedding IS NULL AND is_active = true;

-- Список записей без embedding:
-- SELECT id, name, category, brand
-- FROM equipment 
-- WHERE embedding IS NULL AND is_active = true
-- ORDER BY id
-- LIMIT 20;

-- ============================================================================
-- 4. Проверка записей без search_vector (должно быть 0, т.к. триггер)
-- ============================================================================

-- SELECT COUNT(*) 
-- FROM equipment 
-- WHERE search_vector IS NULL AND is_active = true;

-- ============================================================================
-- 5. Полная очистка всех embeddings (для полного пересчёта)
-- ============================================================================

-- ВНИМАНИЕ: Это очистит ВСЕ embeddings! Используйте с осторожностью.
-- 
-- Сначала сделайте бэкап (опционально):
-- ALTER TABLE equipment ADD COLUMN IF NOT EXISTS embedding_backup VECTOR;
-- UPDATE equipment SET embedding_backup = embedding WHERE embedding IS NOT NULL;
--
-- Затем очистите:
-- UPDATE equipment SET embedding = NULL WHERE is_active = true;
--
-- После этого запустите worker:
-- npm run embed:equipment
--
-- После проверки можно удалить бэкап:
-- ALTER TABLE equipment DROP COLUMN embedding_backup;

