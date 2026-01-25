#!/bin/bash
# Скрипт для пересоздания search_vector и embedding

set -e

# Параметры подключения (из .env или переменные окружения)
NODE_ENV="${NODE_ENV:-development}"
if [ -f ".env.${NODE_ENV}" ]; then
    export $(cat ".env.${NODE_ENV}" | grep -v '^#' | xargs)
elif [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

PGHOST="${DB_HOST:-${PGHOST:-localhost}}"
PGPORT="${DB_PORT:-${PGPORT:-5432}}"
PGUSER="${DB_USER:-${PGUSER:-postgres}}"
PGPASSWORD="${DB_PASS:-${DB_PASSWORD:-${PGPASSWORD:-}}}"
PGDATABASE="${DB_NAME:-${DB_DATABASE:-${PGDATABASE:-equipment_catalog}}}"

# Если указан PGPASSWORD, экспортируем его
if [ -n "$PGPASSWORD" ]; then
  export PGPASSWORD
fi

# Опция для автоматического выполнения без подтверждения
AUTO_YES="${AUTO_YES:-false}"

echo "🔄 Пересоздание search_vector и embedding..."
echo ""

# Проверка подключения
echo "📊 Проверка текущего состояния..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" ${PGPASSWORD:+-w} -c "
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE search_vector IS NOT NULL) AS with_search_vector,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS with_embedding
FROM equipment
WHERE is_active = true;
"

echo ""
if [ "$AUTO_YES" != "true" ]; then
  printf "Продолжить? (y/n) "
  read REPLY
  if [ "$REPLY" != "y" ] && [ "$REPLY" != "Y" ]; then
    echo "Отменено"
    exit 1
  fi
fi

# Пересоздание search_vector
echo "🔄 Пересоздание search_vector..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" ${PGPASSWORD:+-w} -c "
UPDATE equipment 
SET updated_at = NOW()
WHERE is_active = true;
"

echo "✅ search_vector пересоздан"

# Очистка embedding
echo "🔄 Очистка embedding..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" ${PGPASSWORD:+-w} -c "
UPDATE equipment 
SET embedding = NULL
WHERE is_active = true;
"

echo "✅ embedding очищен"
echo ""
echo "📊 Текущее состояние:"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" ${PGPASSWORD:+-w} -c "
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE search_vector IS NOT NULL) AS with_search_vector,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS with_embedding
FROM equipment
WHERE is_active = true;
"

echo ""
echo "✅ Готово!"
echo ""
echo "Теперь запустите worker для заполнения embedding:"
echo "  npm run embed:equipment"
