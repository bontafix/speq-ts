speq-ts — MVP поиска по каталогу оборудования с LLM (Node.js + TypeScript + PostgreSQL)

## Краткое описание

- **Назначение**: консольное приложение, которое принимает запрос на русском языке, парсит его через LLM в `SearchQuery`, ищет оборудование в PostgreSQL (FTS + pgvector) и возвращает релевантный список.
- **Архитектура**: доменный слой `CatalogService`, LLM-слой (`QuestionParser`, `AnswerGenerator`), движок поиска (`SearchEngine`), репозиторий с «голым» SQL (без ORM), PostgreSQL + pgvector.
- **LLM провайдеры**: поддержка Ollama (локально), Groq (облако, быстро), OpenAI (облако, качественно) с автоматическим fallback.

## Быстрый запуск

### 0. Настроить базу данных

**Если у вас уже есть БД с таблицей equipment:**
📖 **Инструкция для существующей БД:** [EXISTING_DATABASE.md](EXISTING_DATABASE.md)

**Если БД нет, создайте новую:**
📖 **Подробная инструкция:** [migrations/README.md](migrations/README.md)

```bash
# Создать БД
createdb -U postgres equipment_catalog

# Применить миграции
psql -U postgres -d equipment_catalog -f migrations/001_create_equipment_table.sql
psql -U postgres -d equipment_catalog -f migrations/002_sample_data.sql
```

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить доступ к PostgreSQL и LLM провайдерам через `.env` (в корне репозитория)

```bash
# Скопируйте шаблон конфигурации
cp env.example .env

# Отредактируйте .env под ваши нужды
```

Минимальная конфигурация для локальной работы:

```env
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_password
PGDATABASE=equipment_catalog

# Используем локальный Ollama (бесплатно)
LLM_CHAT_PROVIDER=ollama
LLM_EMBEDDINGS_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
LLM_MODEL=qwen2.5:7b-instruct-q4_K_M
EMBED_MODEL=nomic-embed-text
```

Для работы с облачными провайдерами (быстрее и качественнее):

```env
# Groq для быстрого парсинга (почти бесплатно)
LLM_CHAT_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key
LLM_MODEL=llama-3.3-70b-versatile

# Ollama для embeddings (бесплатно)
LLM_EMBEDDINGS_PROVIDER=ollama
EMBED_MODEL=nomic-embed-text

# Fallback на Ollama если Groq недоступен
LLM_FALLBACK_PROVIDERS=ollama
```

3. Поднять LLM провайдер:

**Вариант A: Ollama (локально, бесплатно)**

```bash
# Установить Ollama: https://ollama.ai
# Загрузить модели:
ollama pull qwen2.5:7b-instruct-q4_K_M
ollama pull nomic-embed-text
```

**Вариант B: Groq (облако, быстро)**

- Зарегистрироваться на https://console.groq.com
- Получить API ключ
- Добавить в `.env`: `GROQ_API_KEY=your_key`

**Вариант C: OpenAI (облако, качественно)**

- Получить API ключ на https://platform.openai.com/api-keys
- Добавить в `.env`: `OPENAI_API_KEY=your_key`

4. Собрать и запустить CLI:

```bash
npm run build
node dist/cli/index.js
```

или в режиме разработки:

```bash
npm start
```

После запуска в консоли ввести естественный запрос, например:

> Нужен гусеничный экскаватор для карьера до 25 тонн

Приложение выведет структурированный `SearchQuery`, стратегию поиска (FTS / mixed) и список найденного оборудования.

### 5. (Опционально) Заполнить embeddings для векторного поиска

```bash
# Убедитесь, что модель загружена
ollama pull nomic-embed-text

# Запустите worker
npm run embed:equipment

# Включите векторный поиск в .env
echo "ENABLE_VECTOR_SEARCH=true" >> .env
```

## 📚 Документация

- [LLM_PROVIDERS.md](LLM_PROVIDERS.md) — выбор и настройка LLM провайдеров (Ollama, Groq, OpenAI)
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — схема БД и работа с search_vector/embedding
- [migrations/README.md](migrations/README.md) — настройка PostgreSQL и применение миграций
