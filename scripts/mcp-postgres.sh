#!/bin/bash
# Скрипт-обертка для запуска MCP сервера PostgreSQL
# Загружает переменные окружения из .env файла проекта

# Получаем директорию скрипта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Переходим в директорию проекта
cd "$PROJECT_DIR" || exit 1

# Загружаем переменные окружения из .env
NODE_ENV="${NODE_ENV:-development}"
if [ -f ".env.${NODE_ENV}" ]; then
  export $(cat ".env.${NODE_ENV}" | grep -v '^#' | grep -v '^$' | xargs)
  echo "✅ Loaded env from .env.${NODE_ENV}"
elif [ -f .env ]; then
  export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
  echo "✅ Loaded env from .env"
else
  echo "⚠️  Файл .env не найден в $PROJECT_DIR"
  echo "Используются переменные окружения системы"
fi

# Поддержка унифицированных переменных БД
PGHOST="${DB_HOST:-${PGHOST}}"
PGPORT="${DB_PORT:-${PGPORT:-5432}}"
PGUSER="${DB_USER:-${PGUSER}}"
PGPASSWORD="${DB_PASS:-${DB_PASSWORD:-${PGPASSWORD}}}"
PGDATABASE="${DB_NAME:-${DB_DATABASE:-${PGDATABASE}}}"

# Проверяем наличие необходимых переменных
if [ -z "$PGHOST" ] || [ -z "$PGUSER" ] || [ -z "$PGDATABASE" ]; then
  echo "❌ Ошибка: не заданы необходимые переменные окружения"
  echo "Требуются: DB_HOST (или PGHOST), DB_USER (или PGUSER), DB_NAME (или PGDATABASE)"
  exit 1
fi

# Формируем строку подключения для MCP сервера PostgreSQL
# Формат: postgresql://[user[:password]@][host][:port][/database]
# MCP сервер принимает строку подключения как аргумент командной строки
if [ -n "$PGPASSWORD" ]; then
  CONNECTION_STRING="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}"
else
  CONNECTION_STRING="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
fi

# Запускаем MCP сервер PostgreSQL из локального node_modules
# Используем локальный пакет из проекта, а не глобальный
# npx сначала ищет в локальном node_modules, затем в глобальном
# Передаём строку подключения как аргумент командной строки
if [ -d "node_modules/@modelcontextprotocol/server-postgres" ]; then
  exec npx --yes @modelcontextprotocol/server-postgres "$CONNECTION_STRING"
else
  echo "❌ Ошибка: @modelcontextprotocol/server-postgres не найден в node_modules"
  echo "Установите пакет: npm install --save-dev @modelcontextprotocol/server-postgres"
  exit 1
fi

