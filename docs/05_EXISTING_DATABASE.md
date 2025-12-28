# Работа с существующей базой данных

Ваша база данных уже создана и содержит данные. Этот документ описывает, что нужно сделать для интеграции с проектом.

## ✅ Что уже есть в БД

- ✅ Таблица `equipment` с полями:
  - `id` (serial4) - автоинкремент integer
  - `url`, `name`, `category`, `subcategory`, `brand`, `region`, `description`
  - `main_parameters`, `additional_parameters` (JSONB)
  - `price` (varchar)
  - `photo_links` (JSONB)
  - `embedding` (vector) - для векторного поиска
  - `search_vector` (tsvector) - для Full-Text Search
  - `is_active` (boolean)

- ✅ Триггер `equipment_search_vector_trigger` - автоматически заполняет `search_vector`
- ✅ Индексы для быстрого поиска (FTS, vector, категории, бренды)
- ✅ Данные в таблице

## 🔧 Что нужно сделать

### 1. Проверить функцию equipment_vector_search

Проверьте, существует ли функция `equipment_vector_search`:

```sql
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'equipment_vector_search'
  AND n.nspname = 'public';
```

**Если функции нет** - примените миграцию:

```bash
# Вариант 1: С указанием хоста и пароля через переменную окружения
PGPASSWORD=your_password psql -h localhost -p 5432 -U speq_user -d speq -f migrations/003_check_and_create_vector_search_function.sql

# Вариант 2: С запросом пароля интерактивно
psql -h localhost -p 5432 -U speq_user -d speq -f migrations/003_check_and_create_vector_search_function.sql

# Вариант 3: Если PostgreSQL на том же хосте и используется peer authentication
psql -U speq_user -d speq -f migrations/003_check_and_create_vector_search_function.sql
```

### 2. Обновить код проекта

Код уже обновлён для работы с вашей схемой:
- ✅ `id` конвертируется из integer в string при чтении
- ✅ Поддержка всех полей вашей таблицы
- ✅ Работа с `price` как varchar

### 3. Заполнить embeddings (если ещё не заполнены)

Проверьте, сколько записей без embeddings:

```sql
SELECT 
  COUNT(*) FILTER (WHERE embedding IS NULL) AS without_embedding,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS with_embedding,
  COUNT(*) AS total
FROM equipment
WHERE is_active = true;
```

Если есть записи без embeddings, запустите worker:

```bash
# Убедитесь, что LLM провайдер доступен
ollama pull nomic-embed-text

# Запустите worker
npm run embed:equipment
```

Worker обработает все записи, у которых `embedding IS NULL`.

### 4. Настроить .env

Создайте `.env` файл на основе `env.example`:

```bash
cp env.example .env
```

Укажите параметры подключения к вашей БД:

```env
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_password
PGDATABASE=your_database_name
```

## 🧪 Тестирование

### Проверка FTS (должно работать сразу)

```bash
npm start
# Введите: "Нужен гусеничный экскаватор"
# Должен найти результаты через Full-Text Search
```

### Проверка Vector Search (после заполнения embeddings)

```bash
# В .env добавьте:
echo "ENABLE_VECTOR_SEARCH=true" >> .env

# Перезапустите
npm start
# Теперь работает гибридный поиск (FTS + vector)
```

## 📊 Различия между схемой проекта и вашей БД

| Параметр | Проект (миграция) | Ваша БД | Статус |
|----------|-------------------|---------|--------|
| `id` | TEXT | serial4 (integer) | ✅ Обновлено в коде |
| `price` | NUMERIC | VARCHAR(100) | ✅ Работает (конвертация) |
| `url` | Нет | VARCHAR(500) | ✅ Игнорируется в коде |
| `photo_links` | Нет | JSONB | ✅ Игнорируется в коде |
| `additional_parameters` | Нет | JSONB | ✅ Игнорируется в коде |
| `search_vector` | TSVECTOR | TSVECTOR | ✅ Работает |
| `embedding` | VECTOR(768) | VECTOR | ✅ Работает (любая размерность) |

## 🔍 SQL-запросы для проверки

### Проверка структуры таблицы

```sql
\d equipment
```

### Проверка триггера

```sql
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgrelid = 'equipment'::regclass
  AND tgname = 'equipment_search_vector_trigger';
```

### Проверка индексов

```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'equipment'
ORDER BY indexname;
```

### Проверка search_vector (должен заполняться автоматически)

```sql
SELECT 
  id,
  name,
  search_vector IS NOT NULL AS has_search_vector,
  length(search_vector::text) AS vector_length
FROM equipment
WHERE is_active = true
LIMIT 5;
```

### Проверка embeddings

```sql
SELECT 
  id,
  name,
  embedding IS NOT NULL AS has_embedding,
  CASE 
    WHEN embedding IS NOT NULL 
    THEN array_length(embedding::real[], 1)
    ELSE NULL
  END AS embedding_dimension
FROM equipment
WHERE is_active = true
LIMIT 5;
```

### Статистика по данным

```sql
SELECT 
  COUNT(*) AS total_records,
  COUNT(*) FILTER (WHERE is_active = true) AS active,
  COUNT(*) FILTER (WHERE search_vector IS NOT NULL) AS with_fts,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS with_embedding,
  COUNT(DISTINCT category) AS categories_count,
  COUNT(DISTINCT brand) AS brands_count
FROM equipment;
```

## 🚀 Быстрый старт

1. **Проверьте функцию vector search:**
   ```bash
   # С указанием хоста (если нужно подключение через TCP/IP)
   PGPASSWORD=your_password psql -h localhost -p 5432 -U speq_user -d speq -f migrations/003_check_and_create_vector_search_function.sql
   
   # Или без хоста (если используется peer authentication)
   psql -U speq_user -d speq -f migrations/003_check_and_create_vector_search_function.sql
   ```

2. **Настройте .env:**
   ```bash
   cp env.example .env
   # Отредактируйте параметры подключения к БД
   ```

3. **Запустите приложение:**
   ```bash
   npm start
   ```

4. **(Опционально) Заполните embeddings:**
   ```bash
   npm run embed:equipment
   ```

## ⚠️ Важные замечания

1. **Размерность embedding**: Ваша БД использует `VECTOR` без указания размерности. Это нормально, но убедитесь, что все embeddings имеют одинаковую размерность (обычно 768 для nomic-embed-text или 1536 для OpenAI).

2. **Функция equipment_vector_search**: Текущая реализация использует упрощённый подход (берёт случайный embedding). Для правильной работы рекомендуется:
   - Генерировать embedding запроса в Node.js через LLM
   - Использовать прямой SQL запрос с оператором `<->` для поиска

3. **Обновление search_vector**: При обновлении записей через ваш код (не через триггер), убедитесь, что триггер срабатывает. Если нужно обновить search_vector вручную:
   ```sql
   UPDATE equipment SET name = name; -- Триггер обновит search_vector
   ```

## 📝 Дополнительные миграции (опционально)

Если хотите улучшить векторный поиск, примените:

```bash
# С указанием хоста
PGPASSWORD=your_password psql -h localhost -p 5432 -U speq_user -d speq -f migrations/004_improve_vector_search.sql

# Или без хоста (peer authentication)
psql -U speq_user -d speq -f migrations/004_improve_vector_search.sql
```

Это создаст функцию `equipment_vector_search_by_embedding`, которая принимает готовый embedding и работает быстрее.

