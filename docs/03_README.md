# Миграции базы данных

Инструкции по настройке PostgreSQL для проекта speq-ts.

## Предварительные требования

1. **PostgreSQL 15+** установлен и запущен
2. **Расширение pgvector** установлено

### Установка pgvector

#### Ubuntu/Debian
```bash
sudo apt install postgresql-15-pgvector
```

#### macOS (Homebrew)
```bash
brew install pgvector
```

#### Docker
```bash
docker run -d \
  --name speq-postgres \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=equipment_catalog \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

#### Из исходников
```bash
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

## Применение миграций

### Способ 1: Через psql (рекомендуется)

```bash
# Подключитесь к PostgreSQL
psql -U postgres -d equipment_catalog

# Выполните миграции по порядку
\i migrations/001_create_equipment_table.sql
\i migrations/002_sample_data.sql

# Проверьте результат
\dt equipment
\df equipment_*
```

### Способ 2: Через командную строку

```bash
# Создайте базу данных (если ещё не создана)
createdb -U postgres equipment_catalog

# Примените миграции
psql -U postgres -d equipment_catalog -f migrations/001_create_equipment_table.sql
psql -U postgres -d equipment_catalog -f migrations/002_sample_data.sql
```

### Способ 3: Через Docker

```bash
# Скопируйте миграции в контейнер
docker cp migrations/001_create_equipment_table.sql speq-postgres:/tmp/
docker cp migrations/002_sample_data.sql speq-postgres:/tmp/

# Выполните миграции
docker exec -i speq-postgres psql -U postgres -d equipment_catalog -f /tmp/001_create_equipment_table.sql
docker exec -i speq-postgres psql -U postgres -d equipment_catalog -f /tmp/002_sample_data.sql
```

## Проверка установки

### 1. Проверьте расширение pgvector

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

Должно вернуть запись с `extname = 'vector'`.

### 2. Проверьте таблицу equipment

```sql
\d equipment
```

Должны быть колонки:
- `id`, `name`, `category`, `brand` и др.
- ✅ `search_vector` (tsvector)
- ✅ `embedding` (vector(768))

### 3. Проверьте триггер

```sql
SELECT tgname, tgtype, tgenabled 
FROM pg_trigger 
WHERE tgrelid = 'equipment'::regclass;
```

Должен быть триггер `equipment_search_vector_trigger`.

### 4. Проверьте функции

```sql
\df equipment_*
```

Должны быть:
- `equipment_search_vector_update()`
- `equipment_vector_search(text, int)`

## Заполнение данных

### 1. search_vector (автоматически)

При добавлении/обновлении записи `search_vector` заполняется АВТОМАТИЧЕСКИ через триггер:

```sql
INSERT INTO equipment (id, name, category, brand) 
VALUES ('test-001', 'Тестовый экскаватор', 'Экскаваторы', 'Test');

-- search_vector заполнится автоматически!
SELECT id, name, search_vector FROM equipment WHERE id = 'test-001';
```

### 2. embedding (через worker)

Embeddings нужно заполнить через Node.js worker:

```bash
# 1. Убедитесь, что LLM провайдер доступен
# Для Ollama:
ollama pull nomic-embed-text

# Для OpenAI: добавьте API ключ в .env
# OPENAI_API_KEY=sk-...

# 2. Запустите worker
npm run embed:equipment

# Worker обработает все записи, у которых embedding IS NULL
# Прогресс будет виден в консоли:
# "Обработка batch: 10 записей..."
# "Готово. Всего обработано записей: 10."
```

### 3. Проверка embeddings

```sql
-- Сколько записей без embeddings?
SELECT COUNT(*) FROM equipment WHERE embedding IS NULL;

-- Сколько записей с embeddings?
SELECT COUNT(*) FROM equipment WHERE embedding IS NOT NULL;

-- Проверка размерности вектора
SELECT id, name, array_length(embedding::real[], 1) AS embedding_dim
FROM equipment 
WHERE embedding IS NOT NULL 
LIMIT 5;
-- Должно быть embedding_dim = 768 (для nomic-embed-text)
```

## Тестирование поиска

### Full-Text Search (работает сразу)

```sql
SELECT id, name, category, brand
FROM equipment
WHERE search_vector @@ plainto_tsquery('russian', 'гусеничный экскаватор')
ORDER BY ts_rank(search_vector, plainto_tsquery('russian', 'гусеничный экскаватор')) DESC
LIMIT 5;
```

### Vector Search (работает после заполнения embeddings)

```sql
-- Через функцию (упрощённая версия)
SELECT id, name, category, brand
FROM equipment_vector_search('экскаватор для карьера', 5);

-- Или напрямую (если знаете embedding запроса)
SELECT id, name, category, brand
FROM equipment
WHERE embedding IS NOT NULL
ORDER BY embedding <-> '[0.1, 0.2, ...]'::vector(768)
LIMIT 5;
```

## Переиндексация embeddings

Если нужно пересчитать все embeddings (например, сменили модель):

```sql
-- 1. Создайте бэкап (опционально)
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS embedding_backup vector(768);
UPDATE equipment SET embedding_backup = embedding WHERE embedding IS NOT NULL;

-- 2. Обнулите embeddings
UPDATE equipment SET embedding = NULL;

-- 3. Запустите worker
-- npm run embed:equipment

-- 4. После проверки удалите бэкап
-- ALTER TABLE equipment DROP COLUMN embedding_backup;
```

## Решение проблем

### Ошибка: "type vector does not exist"

Расширение pgvector не установлено. См. раздел "Установка pgvector".

### Ошибка: "function equipment_vector_search does not exist"

Миграция 001 не применена. Выполните:
```bash
psql -U postgres -d equipment_catalog -f migrations/001_create_equipment_table.sql
```

### Worker не может подключиться к БД

Проверьте `.env`:
```env
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_password
PGDATABASE=equipment_catalog
```

### Worker не может подключиться к Ollama

```bash
# Проверьте, что Ollama запущен
curl http://127.0.0.1:11434/

# Проверьте, что модель загружена
ollama list | grep nomic-embed-text

# Если нет - загрузите
ollama pull nomic-embed-text
```

### Размерность embedding не совпадает

Если используете другую модель, измените размерность в миграции:

```sql
-- В файле 001_create_equipment_table.sql найдите строки с VECTOR(768)
-- и замените на нужную размерность:

-- Для text-embedding-3-small (OpenAI):
embedding VECTOR(1536)

-- Для text-embedding-3-large (OpenAI):
embedding VECTOR(3072)

-- Затем пересоздайте таблицу или используйте ALTER TABLE
```

## Полезные SQL-запросы

```sql
-- Статистика по данным
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE search_vector IS NOT NULL) AS with_fts,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS with_embedding,
  COUNT(*) FILTER (WHERE is_active) AS active
FROM equipment;

-- Топ категорий
SELECT category, COUNT(*) AS cnt
FROM equipment
WHERE is_active = true
GROUP BY category
ORDER BY cnt DESC;

-- Топ брендов
SELECT brand, COUNT(*) AS cnt
FROM equipment
WHERE is_active = true
GROUP BY brand
ORDER BY cnt DESC;

-- Самые популярные параметры
SELECT 
  jsonb_object_keys(main_parameters) AS parameter,
  COUNT(*) AS usage_count
FROM equipment
WHERE is_active = true
GROUP BY parameter
ORDER BY usage_count DESC;
```

