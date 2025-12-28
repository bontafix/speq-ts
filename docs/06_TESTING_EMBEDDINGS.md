# Тестирование заполнения embedding и search_vector

## 🧪 Эксперименты с очисткой и заполнением полей

### 1. Очистка embedding у нескольких записей

```sql
-- Очистить embedding у первых 5 записей
UPDATE equipment 
SET embedding = NULL 
WHERE id IN (
  SELECT id FROM equipment WHERE is_active = true LIMIT 5
);

-- Проверить результат
SELECT id, name, category, embedding IS NULL AS embedding_null
FROM equipment 
WHERE id IN (
  SELECT id FROM equipment WHERE is_active = true LIMIT 5
);
```

### 2. Запуск worker для заполнения embedding

После очистки запустите worker:

```bash
npm run embed:equipment
```

Worker автоматически:
- ✅ Найдёт все записи с `embedding IS NULL`
- ✅ Сгенерирует embeddings через LLM (Ollama/OpenAI)
- ✅ Сохранит их в БД

**Пример вывода:**
```
Запуск worker эмбеддингов: модель=nomic-embed-text, batchSize=32
Обработка batch: 5 записей...
Готово. Всего обработано записей: 5.
```

### 3. Проверка результата

```sql
-- Проверить, что embeddings заполнились
SELECT 
  id, 
  name, 
  category,
  embedding IS NOT NULL AS has_embedding,
  array_length(embedding::real[], 1) AS embedding_dim
FROM equipment 
WHERE id IN (
  SELECT id FROM equipment WHERE is_active = true LIMIT 5
);
```

## 🔄 Очистка search_vector (автоматическое заполнение)

### Важно: search_vector заполняется АВТОМАТИЧЕСКИ!

Если вы очистите `search_vector`, он заполнится автоматически при любом UPDATE:

```sql
-- Очистить search_vector
UPDATE equipment 
SET search_vector = NULL 
WHERE id = 123;

-- Обновить запись (триггер автоматически заполнит search_vector)
UPDATE equipment 
SET name = name  -- или любое другое поле
WHERE id = 123;

-- Проверить результат
SELECT id, name, search_vector IS NOT NULL AS has_search_vector
FROM equipment 
WHERE id = 123;
```

**Или проще - просто обновить любое поле:**

```sql
-- Просто обновить updated_at - триггер пересоздаст search_vector
UPDATE equipment 
SET updated_at = NOW()
WHERE id = 123;
-- search_vector обновится автоматически!
```

## 📊 Полный цикл тестирования

### Шаг 1: Очистить embedding у тестовых записей

```sql
-- Выбрать 3 записи для теста
UPDATE equipment 
SET embedding = NULL 
WHERE id IN (1, 2, 3);
```

### Шаг 2: Проверить, что embedding очищен

```sql
SELECT id, name, embedding IS NULL AS embedding_null
FROM equipment 
WHERE id IN (1, 2, 3);
-- Должно показать embedding_null = true
```

### Шаг 3: Запустить worker

```bash
npm run embed:equipment
```

### Шаг 4: Проверить результат

```sql
SELECT 
  id, 
  name, 
  embedding IS NOT NULL AS has_embedding,
  array_length(embedding::real[], 1) AS embedding_dim
FROM equipment 
WHERE id IN (1, 2, 3);
-- Должно показать has_embedding = true, embedding_dim = 768 (или другая размерность)
```

## ⚠️ Важные замечания

### 1. search_vector заполняется автоматически

**Не нужно** запускать worker для `search_vector` - он заполняется через триггер PostgreSQL при любом INSERT/UPDATE.

### 2. embedding заполняется только через worker

**Нужно** запускать `npm run embed:equipment` для заполнения `embedding`.

### 3. Worker обрабатывает только записи с embedding IS NULL

Worker автоматически пропускает записи, у которых уже есть embedding.

### 4. Размерность embedding

Убедитесь, что все embeddings имеют одинаковую размерность:
- `nomic-embed-text`: 768
- `text-embedding-3-small` (OpenAI): 1536
- `text-embedding-3-large` (OpenAI): 3072

Если размерности не совпадают, векторный поиск не будет работать корректно.

## 🔍 Полезные SQL-запросы для тестирования

### Статистика по embedding

```sql
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE embedding IS NULL) AS without_embedding,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS with_embedding,
  COUNT(DISTINCT array_length(embedding::real[], 1)) AS different_dimensions
FROM equipment
WHERE is_active = true;
```

### Статистика по search_vector

```sql
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE search_vector IS NULL) AS without_search_vector,
  COUNT(*) FILTER (WHERE search_vector IS NOT NULL) AS with_search_vector
FROM equipment
WHERE is_active = true;
-- Обычно without_search_vector должно быть 0 (триггер работает)
```

### Записи для обработки worker'ом

```sql
-- Список записей, которые обработает worker
SELECT id, name, category, brand
FROM equipment
WHERE embedding IS NULL 
  AND is_active = true
ORDER BY id
LIMIT 20;
```

## 🚀 Быстрый тест

```bash
# 1. Очистить embedding у 3 записей
psql -h localhost -p 5432 -U speq_user -d speq -c "
UPDATE equipment 
SET embedding = NULL 
WHERE id IN (
  SELECT id FROM equipment WHERE is_active = true LIMIT 3
);
"

# 2. Запустить worker
npm run embed:equipment

# 3. Проверить результат
psql -h localhost -p 5432 -U speq_user -d speq -c "
SELECT id, name, embedding IS NOT NULL AS has_embedding
FROM equipment 
WHERE id IN (
  SELECT id FROM equipment WHERE is_active = true LIMIT 3
);
"
```

## 📝 Примеры для разных сценариев

### Тест 1: Одна запись

```sql
-- Очистить
UPDATE equipment SET embedding = NULL WHERE id = 100;

-- Запустить worker (в терминале)
npm run embed:equipment

-- Проверить
SELECT id, name, embedding IS NOT NULL FROM equipment WHERE id = 100;
```

### Тест 2: Категория

```sql
-- Очистить все экскаваторы
UPDATE equipment 
SET embedding = NULL 
WHERE category = 'Экскаваторы' AND is_active = true;

-- Запустить worker
npm run embed:equipment

-- Проверить
SELECT COUNT(*) 
FROM equipment 
WHERE category = 'Экскаваторы' 
  AND embedding IS NOT NULL;
```

### Тест 3: Все записи (полный пересчёт)

```sql
-- Сделать бэкап (опционально)
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS embedding_backup VECTOR;
UPDATE equipment SET embedding_backup = embedding WHERE embedding IS NOT NULL;

-- Очистить все
UPDATE equipment SET embedding = NULL WHERE is_active = true;

-- Запустить worker (может занять время!)
npm run embed:equipment

-- Проверить
SELECT COUNT(*) FROM equipment WHERE embedding IS NOT NULL;
```

