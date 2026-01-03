# Настройка MCP сервера для PostgreSQL

## Быстрый старт (только для этого проекта)

1. Установите пакет (уже установлен): `npm install --save-dev @modelcontextprotocol/server-postgres`
2. Создайте конфигурацию: `cp .cursor/mcp.json.example .cursor/mcp.json`
3. Перезапустите Cursor
4. Готово! MCP сервер будет работать только в этом проекте

## Что такое MCP сервер?

MCP (Model Context Protocol) сервер позволяет AI-ассистенту (в данном случае Cursor) напрямую взаимодействовать с вашей базой данных PostgreSQL. Это дает возможность:
- Выполнять SQL-запросы к базе данных
- Просматривать схему базы данных
- Анализировать данные
- Работать с базой под учетными данными пользователя

## Установка MCP сервера PostgreSQL

### Локальная установка в проект (рекомендуется для workspace-специфичной настройки)

```bash
# Установить в проект как dev-зависимость
npm install --save-dev @modelcontextprotocol/server-postgres
```

Этот вариант позволяет настроить MCP сервер только для этого проекта, не затрагивая другие проекты.

### Глобальная установка (альтернатива)

```bash
# Установить MCP сервер PostgreSQL глобально
npm install -g @modelcontextprotocol/server-postgres
```

## Настройка конфигурации Cursor

### Настройка только для этого проекта (workspace-специфичная)

Чтобы MCP сервер работал только в этом проекте, создайте файл `.cursor/mcp.json` в корне проекта:

```bash
# Создать директорию (если её нет)
mkdir -p .cursor

# Скопировать пример конфигурации
cp .cursor/mcp.json.example .cursor/mcp.json
```

Или создайте файл `.cursor/mcp.json` вручную со следующим содержимым:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "bash",
      "args": [
        "${workspaceFolder}/scripts/mcp-postgres.sh"
      ],
      "env": {}
    }
  }
}
```

**Преимущества workspace-специфичной настройки:**
- MCP сервер работает только при открытии этого проекта
- Использует локальный пакет из `node_modules` проекта
- Автоматически загружает переменные окружения из `.env` проекта
- Не влияет на другие проекты

**Важно:** После создания файла `.cursor/mcp.json` необходимо перезапустить Cursor, чтобы изменения вступили в силу.

### Глобальная настройка (для всех проектов)

Если вы хотите использовать MCP сервер во всех проектах, настройте глобальную конфигурацию:

#### 1. Найти файл конфигурации Cursor

Конфигурация MCP серверов в Cursor обычно находится в одном из следующих мест:

**Linux:**
- `~/.config/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`
- Или через настройки Cursor: `File > Preferences > Settings > Extensions > MCP`

**Альтернативный путь (новые версии Cursor):**
- `~/.cursor/mcp.json`
- Или через UI: `Cursor Settings > Features > MCP Servers`

#### 2. Создать/обновить конфигурацию

Создайте или обновите файл конфигурации MCP серверов. Пример конфигурации:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres"
      ],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}"
      }
    }
  }
}
```

#### 3. Использование переменных окружения из .env

Если вы хотите использовать переменные из файла `.env` проекта, создайте скрипт-обертку:

**Создайте файл `scripts/mcp-postgres.sh`:**

```bash
#!/bin/bash
# Загружаем переменные окружения из .env
export $(cat .env | grep -v '^#' | xargs)
# Запускаем MCP сервер с переменными окружения
npx -y @modelcontextprotocol/server-postgres
```

Сделайте его исполняемым:
```bash
chmod +x scripts/mcp-postgres.sh
```

Затем в конфигурации Cursor укажите:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "/home/boris/dev/speq-ts/scripts/mcp-postgres.sh",
      "env": {
        "PGHOST": "${PGHOST}",
        "PGPORT": "${PGPORT}",
        "PGUSER": "${PGUSER}",
        "PGPASSWORD": "${PGPASSWORD}",
        "PGDATABASE": "${PGDATABASE}"
      }
    }
  }
}
```

#### 4. Альтернативный вариант: прямое указание параметров

Если переменные окружения не работают, можно указать параметры напрямую:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres"
      ],
      "env": {
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_USER": "postgres",
        "POSTGRES_PASSWORD": "your_password",
        "POSTGRES_DATABASE": "equipment_catalog"
      }
    }
  }
}
```

## Проверка подключения

После настройки:

1. Перезапустите Cursor
2. Откройте панель MCP (обычно через команду `Cmd/Ctrl + Shift + P` → "MCP: Show Servers")
3. Убедитесь, что сервер `postgres` отображается как активный
4. Попробуйте задать вопрос о базе данных, например: "Покажи схему таблицы equipment"

## Использование

После настройки вы можете использовать MCP сервер для:

- **Просмотра схемы БД**: "Какие таблицы есть в базе данных?"
- **Выполнения запросов**: "Сколько записей в таблице equipment?"
- **Анализа данных**: "Покажи первые 10 записей из таблицы equipment"
- **Проверки структуры**: "Какие колонки есть в таблице equipment?"

## Безопасность

⚠️ **Важно**: MCP сервер будет иметь доступ к базе данных с теми же правами, что указаны в переменных окружения. Убедитесь, что:

1. Файл `.env` не попадает в git (должен быть в `.gitignore`)
2. Используется пользователь БД с минимально необходимыми правами
3. В production используйте отдельного пользователя только для чтения, если не нужны изменения

## Устранение проблем

### Сервер не запускается

1. Проверьте, что MCP сервер установлен: `npm list -g @modelcontextprotocol/server-postgres`
2. Проверьте переменные окружения: `echo $PGHOST $PGUSER $PGDATABASE`
3. Проверьте подключение к БД: `psql -h $PGHOST -U $PGUSER -d $PGDATABASE`

### Ошибки подключения

1. Убедитесь, что PostgreSQL запущен: `sudo systemctl status postgresql`
2. Проверьте права доступа в `pg_hba.conf`
3. Проверьте, что порт 5432 открыт: `netstat -tuln | grep 5432`

### Переменные окружения не подхватываются

Используйте скрипт-обертку (см. раздел "Использование переменных окружения из .env") или укажите параметры напрямую в конфигурации.

