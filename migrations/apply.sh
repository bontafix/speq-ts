#!/bin/bash
# Скрипт для применения миграций PostgreSQL
# Использование:
#   ./migrations/apply.sh [номер_миграции]
#   или
#   bash migrations/apply.sh [номер_миграции]

set -e

# Загружаем переменные из .env файла (если существует)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  # Загружаем переменные из .env, игнорируя комментарии и пустые строки
  set -a
  source <(grep -v '^#' "$ENV_FILE" | grep -v '^$' | sed 's/^/export /')
  set +a
fi

# Параметры подключения (можно переопределить через переменные окружения)
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-speq_user}"
PGDATABASE="${PGDATABASE:-speq}"

# Если указан PGPASSWORD, используем его, иначе будет запрошен интерактивно
if [ -n "$PGPASSWORD" ]; then
  export PGPASSWORD
  PASSWORD_ARG=""
else
  PASSWORD_ARG="-W"
fi

# Функция для применения миграции
apply_migration() {
  local migration_file=$1
  if [ ! -f "$migration_file" ]; then
    echo "❌ Файл миграции не найден: $migration_file"
    exit 1
  fi
  
  echo "📄 Применение миграции: $migration_file"
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" $PASSWORD_ARG -f "$migration_file"
  
  if [ $? -eq 0 ]; then
    echo "✅ Миграция применена успешно"
  else
    echo "❌ Ошибка при применении миграции"
    exit 1
  fi
}

# Если указан номер миграции, применяем только её
if [ -n "$1" ]; then
  # Форматируем номер миграции с ведущими нулями до 3 цифр (001, 010, 011, ...)
  migration_num=$(printf "%03d" "$1")
  migration_file="migrations/${migration_num}_*.sql"
  if ls $migration_file 1> /dev/null 2>&1; then
    apply_migration $(ls $migration_file | head -1)
  else
    echo "❌ Миграция $1 не найдена (искали: $migration_file)"
    exit 1
  fi
else
  # Применяем все миграции по порядку
  echo "🔄 Применение всех миграций..."
  
  for migration in migrations/00*.sql migrations/01*.sql; do
    if [ -f "$migration" ]; then
      apply_migration "$migration"
      echo ""
    fi
  done
  
  echo "✅ Все миграции применены"
fi

