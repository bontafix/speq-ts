# Настройка переменных окружения

## Где сохранить переменные окружения

Проект поддерживает автоматическую загрузку файлов в зависимости от `NODE_ENV`:
1. `.env.${NODE_ENV}.local`
2. `.env.${NODE_ENV}`
3. `.env.local`
4. `.env`

Например, если `NODE_ENV=production`, будет предпринята попытка загрузить `.env.production`.

## Быстрый старт

### 1. Создать файл окружения

```bash
# Для разработки
cp env.example .env.development

# Для продакшена
cp env.example .env.production
```

### 2. Настроить подключение к PostgreSQL

Используйте унифицированные переменные (рекомендуется):

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=your_password
DB_NAME=equipment_catalog
```

Проект также поддерживает старые форматы `PG*`, `POSTGRES_*` и `FAPI_PG*` для обратной совместимости.

### 3. Настроить LLM провайдеры (опционально)

```bash
# Для локального использования (Ollama)
LLM_CHAT_PROVIDER=ollama
LLM_EMBEDDINGS_PROVIDER=ollama
LLM_MODEL=qwen2.5:7b-instruct-q4_K_M
EMBED_MODEL=nomic-embed-text

# Или для облачного использования (Groq)
# LLM_CHAT_PROVIDER=groq
# GROQ_API_KEY=your_groq_api_key
# LLM_MODEL=llama-3.3-70b-versatile
```

## Формат переменных

### Отдельные переменные (используется в проекте)

Проект использует отдельные переменные для подключения к PostgreSQL:

```bash
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_password
PGDATABASE=equipment_catalog
```

Эти переменные используются в `src/db/pg.ts`.

### DATABASE_URL (альтернатива)

Если у вас есть переменная `DATABASE_URL` в формате:

```
postgresql://user:password@host:port/database
```

То можно использовать её напрямую в командах `psql`:

```bash
psql $DATABASE_URL -f migrations/007_create_parameter_dictionary.sql
```

Но в коде приложения всё равно используются отдельные переменные (`PGHOST`, `PGPORT` и т.д.).

## Проверка настроек

### Проверить, что переменные загружены

```bash
# В bash/zsh
source .env
echo $PGHOST
echo $PGDATABASE

# Или через export
export $(cat .env | grep -v '^#' | xargs)
echo $PGHOST
```

### Проверить подключение к БД

```bash
# Загрузить переменные
export $(cat .env | grep -v '^#' | xargs)

# Проверить подключение
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "SELECT version();"
```

## Безопасность

### ⚠️ Важно

1. **Файл `.env` должен быть в `.gitignore`**
   - Не коммитьте файл `.env` в репозиторий
   - В репозитории должен быть только `env.example`

2. **Не храните пароли в открытом виде**
   - Используйте сильные пароли
   - В production используйте секреты/менеджеры паролей

3. **Проверьте `.gitignore`**

```bash
# Убедитесь, что .env в .gitignore
cat .gitignore | grep -E "^\.env$"
```

## Примеры конфигураций

### Локальная разработка

```bash
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=equipment_catalog

LLM_CHAT_PROVIDER=ollama
LLM_EMBEDDINGS_PROVIDER=ollama
LLM_MODEL=qwen2.5:7b-instruct-q4_K_M
```

### Production (пример)

```bash
PGHOST=db.example.com
PGPORT=5432
PGUSER=app_user
PGPASSWORD=secure_password_from_secrets_manager
PGDATABASE=equipment_catalog

LLM_CHAT_PROVIDER=groq
GROQ_API_KEY=your_groq_key
LLM_MODEL=llama-3.3-70b-versatile
```

## Использование в скриптах

### В Node.js/TypeScript

Переменные автоматически загружаются через `dotenv`:

```typescript
import "dotenv/config";
// Теперь доступны process.env.PGHOST, process.env.PGPASSWORD и т.д.
```

### В bash скриптах

```bash
#!/bin/bash
# Загрузить переменные из .env
export $(cat .env | grep -v '^#' | xargs)

# Использовать переменные
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f script.sql
```

## Устранение проблем

### Ошибка: "переменная не найдена"

**Решение**: Убедитесь, что файл `.env` существует и переменные указаны правильно:

```bash
# Проверить наличие файла
ls -la .env

# Проверить содержимое (без паролей)
cat .env | grep -v PASSWORD
```

### Ошибка подключения к БД

**Решение**: Проверьте параметры подключения:

```bash
# Проверить, что PostgreSQL запущен
pg_isready -h localhost -p 5432

# Проверить подключение
psql -h localhost -U postgres -d equipment_catalog -c "SELECT 1;"
```

### Переменные не загружаются в скриптах

**Решение**: В bash скриптах нужно явно загружать переменные:

```bash
# В начале скрипта
export $(cat .env | grep -v '^#' | xargs)
```

Или использовать `source`:

```bash
source .env
```

