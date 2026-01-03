# Проверка работы MCP сервера PostgreSQL

## Быстрая проверка

### 1. Проверка файлов и конфигурации

```bash
# Проверить наличие конфигурации
test -f .cursor/mcp.json && echo "✅ Конфигурация найдена" || echo "❌ Создайте .cursor/mcp.json"

# Проверить наличие .env
test -f .env && echo "✅ .env найден" || echo "❌ Создайте .env"

# Проверить установку пакета
test -d node_modules/@modelcontextprotocol/server-postgres && echo "✅ Пакет установлен" || echo "❌ Установите: npm install --save-dev @modelcontextprotocol/server-postgres"

# Проверить скрипт
test -x scripts/mcp-postgres.sh && echo "✅ Скрипт исполняемый" || echo "❌ chmod +x scripts/mcp-postgres.sh"
```

### 2. Проверка подключения к базе данных

```bash
# Проверить переменные окружения
cd /home/boris/dev/speq-ts
source .env 2>/dev/null || export $(cat .env | grep -v '^#' | xargs)
echo "PGHOST: $PGHOST"
echo "PGUSER: $PGUSER"
echo "PGDATABASE: $PGDATABASE"

# Проверить подключение к БД
psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT 1;" 2>&1 | head -1
```

### 3. Проверка работы скрипта

```bash
# Тестовый запуск скрипта (должен показать ошибку подключения или запуститься)
cd /home/boris/dev/speq-ts
timeout 2 bash scripts/mcp-postgres.sh 2>&1 | head -5
```

## Проверка в Cursor

### Способ 1: Через панель MCP

1. Откройте Cursor
2. Нажмите `Cmd/Ctrl + Shift + P` (или `F1`)
3. Введите "MCP" и выберите команду для просмотра серверов:
   - "MCP: Show Servers"
   - "MCP: List Servers"
   - "MCP: Show Server Status"
4. Убедитесь, что сервер `postgres` отображается и имеет статус "Connected" или "Active"

### Способ 2: Через чат с AI

Задайте вопросы о базе данных:

1. **Проверка схемы:**
   ```
   Какие таблицы есть в базе данных?
   ```

2. **Проверка структуры таблицы:**
   ```
   Покажи схему таблицы equipment
   ```

3. **Проверка данных:**
   ```
   Сколько записей в таблице equipment?
   ```

4. **Проверка подключения:**
   ```
   Выполни запрос: SELECT COUNT(*) FROM equipment;
   ```

Если AI может ответить на эти вопросы, значит MCP сервер работает корректно.

### Способ 3: Через логи Cursor

1. Откройте панель вывода (View > Output)
2. Выберите канал "MCP" или "PostgreSQL"
3. Проверьте наличие сообщений о подключении

## Устранение проблем

### Сервер не отображается в списке

1. **Проверьте конфигурацию:**
   ```bash
   cat .cursor/mcp.json
   ```

2. **Перезапустите Cursor** - это важно!

3. **Проверьте путь к скрипту:**
   - Убедитесь, что путь `${workspaceFolder}` правильно разрешается
   - Попробуйте указать абсолютный путь в конфигурации

### Ошибки подключения к БД

1. **Проверьте переменные окружения:**
   ```bash
   cd /home/boris/dev/speq-ts
   export $(cat .env | grep -v '^#' | xargs)
   echo "PGHOST=$PGHOST PGPORT=$PGPORT PGUSER=$PGUSER PGDATABASE=$PGDATABASE"
   ```

2. **Проверьте подключение вручную:**
   ```bash
   psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT version();"
   ```

3. **Проверьте права доступа:**
   - Убедитесь, что пользователь БД имеет права на чтение таблиц
   - Проверьте `pg_hba.conf` для локальных подключений

### Скрипт не запускается

1. **Проверьте права на выполнение:**
   ```bash
   ls -l scripts/mcp-postgres.sh
   chmod +x scripts/mcp-postgres.sh
   ```

2. **Проверьте синтаксис:**
   ```bash
   bash -n scripts/mcp-postgres.sh
   ```

3. **Запустите вручную для отладки:**
   ```bash
   cd /home/boris/dev/speq-ts
   bash -x scripts/mcp-postgres.sh
   ```

### Пакет не найден

```bash
# Переустановите пакет
npm install --save-dev @modelcontextprotocol/server-postgres

# Проверьте установку
ls -la node_modules/@modelcontextprotocol/server-postgres
```

## Примеры успешной работы

Если MCP сервер работает, вы должны получить ответы на такие запросы:

**Запрос:** "Какие таблицы есть в базе данных?"

**Ожидаемый ответ:** Список таблиц, например:
- equipment
- parameter_dictionary
- и т.д.

**Запрос:** "Покажи первые 5 записей из таблицы equipment"

**Ожидаемый ответ:** Данные из таблицы equipment

**Запрос:** "Какие колонки есть в таблице equipment?"

**Ожидаемый ответ:** Список колонок с типами данных

## Дополнительная диагностика

Если проблемы остаются, проверьте:

1. **Версию Cursor:** Убедитесь, что используется актуальная версия с поддержкой MCP
2. **Логи Cursor:** Проверьте логи в `~/.config/Cursor/logs/`
3. **Расширения:** Убедитесь, что нет конфликтующих расширений
4. **Переменные окружения системы:** Проверьте, что системные переменные не переопределяют `.env`
