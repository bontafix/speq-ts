# Пересоздание search_vector и embedding

Инструкция по полному пересозданию полей `search_vector` и `embedding` для всех существующих записей.

## 🔄 Быстрый способ (рекомендуется)

### Шаг 1: Пересоздать search_vector

```sql
-- Просто обновить updated_at - триггер автоматически пересоздаст search_vector
UPDATE equipment 
SET updated_at = NOW()
WHERE is_active = true;
```

**Проверка:**
```sql
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE search_vector IS NOT NULL) AS with_search_vector
FROM equipment
WHERE is_active = true;
-- with_search_vector должно равняться total
```

### Шаг 2: Очистить embedding

```sql
-- Очистить все embeddings
UPDATE equipment 
SET embedding = NULL
WHERE is_active = true;
```

**Проверка:**
```sql
SELECT 
  COUNT(*) FILTER (WHERE embedding IS NULL) AS without_embedding
FROM equipment
WHERE is_active = true;
-- Должно быть равно общему количеству записей
```

### Шаг 3: Запустить worker для embedding

```bash
npm run embed:equipment
```

Worker обработает все записи с `embedding IS NULL` и заполнит их.

**Проверка после worker:**
```sql
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS with_embedding
FROM equipment
WHERE is_active = true;
-- with_embedding должно равняться total
```

## 📋 Полный скрипт (одной командой)

### Вариант 1: Через SQL файл

```bash
# Применить миграцию
PGPASSWORD=your_password psql -h localhost -p 5432 -U speq_user -d speq \
  -f migrations/006_recreate_search_vector_and_embedding.sql

# Запустить worker
npm run embed:equipment
```

### Вариант 2: Через psql интерактивно

```bash
psql -h localhost -p 5432 -U speq_user -d speq
```

```sql
-- Пересоздать search_vector
UPDATE equipment SET updated_at = NOW() WHERE is_active = true;

-- Очистить embedding
UPDATE equipment SET embedding = NULL WHERE is_active = true;

-- Выйти
\q
```

```bash
# Запустить worker
npm run embed:equipment
```

## 🔒 Безопасный способ (с бэкапом)

Если хотите сохранить старые embeddings на случай проблем:

```sql
-- 1. Создать колонку для бэкапа
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS embedding_backup VECTOR;

-- 2. Сохранить текущие embeddings
UPDATE equipment 
SET embedding_backup = embedding 
WHERE embedding IS NOT NULL;

-- 3. Пересоздать search_vector
UPDATE equipment 
SET updated_at = NOW()
WHERE is_active = true;

-- 4. Очистить embedding
UPDATE equipment 
SET embedding = NULL
WHERE is_active = true;
```

```bash
# 5. Запустить worker
npm run embed:equipment
```

```sql
-- 6. После проверки можно удалить бэкап
ALTER TABLE equipment DROP COLUMN embedding_backup;
```

## 📊 Проверка результатов

### До пересоздания

```sql
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE search_vector IS NOT NULL) AS with_search_vector,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS with_embedding
FROM equipment
WHERE is_active = true;
```

### После пересоздания search_vector

```sql
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE search_vector IS NOT NULL) AS with_search_vector
FROM equipment
WHERE is_active = true;
-- with_search_vector должно быть = total
```

### После worker (embedding)

```sql
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS with_embedding,
  COUNT(*) FILTER (WHERE embedding IS NULL) AS without_embedding
FROM equipment
WHERE is_active = true;
-- with_embedding должно быть = total
-- without_embedding должно быть = 0
```

## ⚡ Оптимизация для больших таблиц

Если у вас много записей (тысячи/миллионы), можно делать пакетами:

### Пакетная обработка search_vector

```sql
-- Обработать по 1000 записей за раз
DO $$
DECLARE
  batch_size INT := 1000;
  processed INT;
BEGIN
  LOOP
    UPDATE equipment 
    SET updated_at = NOW()
    WHERE id IN (
      SELECT id 
      FROM equipment 
      WHERE is_active = true 
        AND updated_at < NOW() - INTERVAL '1 second'
      LIMIT batch_size
    );
    
    GET DIAGNOSTICS processed = ROW_COUNT;
    EXIT WHEN processed = 0;
    
    RAISE NOTICE 'Обработано % записей', processed;
    COMMIT;
  END LOOP;
END $$;
```

### Пакетная очистка embedding

```sql
-- Очистить embedding пакетами
DO $$
DECLARE
  batch_size INT := 1000;
  processed INT;
BEGIN
  LOOP
    UPDATE equipment 
    SET embedding = NULL
    WHERE id IN (
      SELECT id 
      FROM equipment 
      WHERE is_active = true 
        AND embedding IS NOT NULL
      LIMIT batch_size
    );
    
    GET DIAGNOSTICS processed = ROW_COUNT;
    EXIT WHEN processed = 0;
    
    RAISE NOTICE 'Очищено % записей', processed;
    COMMIT;
  END LOOP;
END $$;
```

## 🎯 Частичное пересоздание

### Только для определённых записей

```sql
-- Только для категории "Экскаваторы"
UPDATE equipment 
SET updated_at = NOW(), embedding = NULL
WHERE category = 'Экскаваторы' AND is_active = true;
```

### Только для записей без search_vector

```sql
-- Пересоздать search_vector только там, где его нет
UPDATE equipment 
SET updated_at = NOW()
WHERE search_vector IS NULL AND is_active = true;
```

### Только для записей без embedding

```sql
-- Очистить embedding только там, где он есть (для пересчёта)
UPDATE equipment 
SET embedding = NULL
WHERE embedding IS NOT NULL AND is_active = true;
```

## ⏱️ Время выполнения

| Операция | Время (1000 записей) | Время (10000 записей) |
|----------|---------------------|----------------------|
| Пересоздание search_vector | ~1-2 секунды | ~10-20 секунд |
| Очистка embedding | ~0.5 секунды | ~5 секунд |
| Worker (embedding через Ollama) | ~2-5 минут | ~20-50 минут |
| Worker (embedding через OpenAI) | ~30 секунд | ~5-10 минут |

## 🔍 Диагностика проблем

### search_vector не пересоздаётся

```sql
-- Проверить, что триггер существует
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgrelid = 'equipment'::regclass
  AND tgname = 'equipment_search_vector_trigger';

-- Если триггера нет, создайте его (см. миграцию 001)
```

### Worker не обрабатывает записи

```sql
-- Проверить, сколько записей без embedding
SELECT COUNT(*) 
FROM equipment 
WHERE embedding IS NULL AND is_active = true;

-- Если 0, значит все уже обработаны
-- Если > 0, проверьте логи worker
```

### Embedding не сохраняется

```sql
-- Проверить размерность embedding в БД
SELECT 
  array_length(embedding::real[], 1) AS dimension,
  COUNT(*) AS count
FROM equipment
WHERE embedding IS NOT NULL
GROUP BY dimension;

-- Все должны иметь одинаковую размерность (768, 1536, и т.д.)
```

## 📝 Пример полного цикла

```bash
# 1. Подключиться к БД
psql -h localhost -p 5432 -U speq_user -d speq

# 2. Пересоздать search_vector
UPDATE equipment SET updated_at = NOW() WHERE is_active = true;

# 3. Проверить search_vector
SELECT COUNT(*) FILTER (WHERE search_vector IS NOT NULL) 
FROM equipment WHERE is_active = true;

# 4. Очистить embedding
UPDATE equipment SET embedding = NULL WHERE is_active = true;

# 5. Выйти
\q

# 6. Запустить worker
npm run embed:equipment

# 7. Проверить embedding
psql -h localhost -p 5432 -U speq_user -d speq -c "
SELECT COUNT(*) FILTER (WHERE embedding IS NOT NULL) 
FROM equipment WHERE is_active = true;
"
```

## ✅ Чеклист

- [ ] Пересоздан search_vector (UPDATE с updated_at)
- [ ] Проверено, что search_vector заполнен у всех записей
- [ ] Очищен embedding (UPDATE SET embedding = NULL)
- [ ] Запущен worker (npm run embed:equipment)
- [ ] Проверено, что embedding заполнен у всех записей
- [ ] Протестирован поиск (npm start)

