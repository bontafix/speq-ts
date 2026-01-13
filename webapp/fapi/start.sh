#!/bin/bash

# Скрипт для запуска Fastify API сервера

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "📦 Speq Fastify API - Запуск сервера"
echo "======================================"
echo ""

# Проверка .env файла
ENV_FILE="$PROJECT_ROOT/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  Файл .env не найден в $PROJECT_ROOT"
    echo "   Создайте файл .env на основе env.example"
    exit 1
fi

# Проверка переменных окружения
source "$ENV_FILE"

if [ -z "$FAPI_PORT" ]; then
    FAPI_PORT=3002
    echo "ℹ️  FAPI_PORT не указан, используется порт по умолчанию: $FAPI_PORT"
else
    echo "✅ FAPI_PORT: $FAPI_PORT"
fi

if [ -z "$FAPI_HOST" ]; then
    FAPI_HOST="0.0.0.0"
    echo "⚠️  FAPI_HOST не указан, используется: $FAPI_HOST"
    echo "   Рекомендуется использовать 127.0.0.1 для продакшена"
else
    echo "✅ FAPI_HOST: $FAPI_HOST"
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET не указан в .env файле"
    echo "   Добавьте JWT_SECRET=your_secret в .env"
    exit 1
fi

# Проверка зависимостей
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "📦 Установка зависимостей..."
    cd "$SCRIPT_DIR"
    npm install
fi

# Проверка, не запущен ли уже сервер
if lsof -Pi :$FAPI_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Порт $FAPI_PORT уже занят"
    echo "   Остановите другой процесс или измените FAPI_PORT в .env"
    exit 1
fi

# Переход в директорию проекта
cd "$SCRIPT_DIR"

# Запуск сервера
echo ""
echo "🚀 Запуск Fastify API сервера..."
echo "   Порт: $FAPI_PORT"
echo "   Хост: $FAPI_HOST"
echo ""

if [ "$1" == "prod" ] || [ "$NODE_ENV" == "production" ]; then
    echo "📦 Сборка проекта..."
    npm run build
    echo "▶️  Запуск в продакшен режиме..."
    node dist/server.js
else
    echo "▶️  Запуск в режиме разработки..."
    npm run dev
fi
