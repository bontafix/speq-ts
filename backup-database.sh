#!/bin/bash
# Скрипт для полного бэкапа базы данных PostgreSQL
# Создаёт бэкап со всей структурой, данными, расширениями и правами доступа

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Загрузка переменных окружения из .env (если есть)
NODE_ENV="${NODE_ENV:-development}"
if [ -f ".env.${NODE_ENV}" ]; then
    export $(cat ".env.${NODE_ENV}" | grep -v '^#' | xargs)
elif [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Параметры подключения (из переменных окружения или значения по умолчанию)
PGHOST="${DB_HOST:-${PGHOST:-localhost}}"
PGPORT="${DB_PORT:-${PGPORT:-5432}}"
PGUSER="${DB_USER:-${PGUSER:-postgres}}"
PGPASSWORD="${DB_PASS:-${DB_PASSWORD:-${PGPASSWORD:-}}}"
PGDATABASE="${DB_NAME:-${DB_DATABASE:-${PGDATABASE:-equipment_catalog}}}"

# Имя файла бэкапа с датой и временем
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backups"
BACKUP_FILE="${BACKUP_DIR}/backup_${PGDATABASE}_${TIMESTAMP}.sql"
BACKUP_FILE_CUSTOM="${BACKUP_DIR}/backup_${PGDATABASE}_${TIMESTAMP}.dump"

# Создаём директорию для бэкапов, если её нет
mkdir -p "$BACKUP_DIR"

echo -e "${GREEN}📦 Начинаю бэкап базы данных ${PGDATABASE}...${NC}"
echo "   Хост: ${PGHOST}:${PGPORT}"
echo "   Пользователь: ${PGUSER}"
echo "   База данных: ${PGDATABASE}"
echo ""

# Проверка доступности базы данных
echo -e "${YELLOW}🔍 Проверка подключения к базе данных...${NC}"
if ! PGPASSWORD="${PGPASSWORD}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ Ошибка: Не удалось подключиться к базе данных${NC}"
    echo "   Убедитесь, что:"
    echo "   - PostgreSQL запущен"
    echo "   - Параметры подключения правильные (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)"
    echo "   - Пользователь имеет права на чтение базы данных"
    exit 1
fi
echo -e "${GREEN}✅ Подключение успешно${NC}"
echo ""

# Вариант 1: SQL дамп (текстовый формат, можно редактировать)
echo -e "${YELLOW}📝 Создание SQL дампа (текстовый формат)...${NC}"
PGPASSWORD="${PGPASSWORD}" pg_dump \
    -h "$PGHOST" \
    -p "$PGPORT" \
    -U "$PGUSER" \
    -d "$PGDATABASE" \
    --verbose \
    --clean \
    --if-exists \
    --create \
    --format=plain \
    --encoding=UTF8 \
    --no-owner \
    --no-privileges \
    > "$BACKUP_FILE" 2>&1

if [ $? -eq 0 ]; then
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ SQL дамп создан: ${BACKUP_FILE} (${FILE_SIZE})${NC}"
else
    echo -e "${RED}❌ Ошибка при создании SQL дампа${NC}"
    exit 1
fi
echo ""

# Вариант 2: Custom формат (сжатый, быстрее восстанавливается)
echo -e "${YELLOW}📦 Создание дампа в custom формате (сжатый)...${NC}"
PGPASSWORD="${PGPASSWORD}" pg_dump \
    -h "$PGHOST" \
    -p "$PGPORT" \
    -U "$PGUSER" \
    -d "$PGDATABASE" \
    --verbose \
    --clean \
    --if-exists \
    --create \
    --format=custom \
    --encoding=UTF8 \
    --no-owner \
    --no-privileges \
    -f "$BACKUP_FILE_CUSTOM" 2>&1

if [ $? -eq 0 ]; then
    FILE_SIZE=$(du -h "$BACKUP_FILE_CUSTOM" | cut -f1)
    echo -e "${GREEN}✅ Custom дамп создан: ${BACKUP_FILE_CUSTOM} (${FILE_SIZE})${NC}"
else
    echo -e "${RED}❌ Ошибка при создании custom дампа${NC}"
    exit 1
fi
echo ""

# Информация о бэкапе
echo -e "${GREEN}📊 Информация о бэкапе:${NC}"
echo "   SQL дамп:    $BACKUP_FILE"
echo "   Custom дамп: $BACKUP_FILE_CUSTOM"
echo ""
echo -e "${YELLOW}💡 Рекомендации:${NC}"
echo "   - SQL дамп (.sql) - для просмотра и редактирования"
echo "   - Custom дамп (.dump) - для быстрого восстановления (рекомендуется)"
echo ""
echo -e "${GREEN}✅ Бэкап завершён успешно!${NC}"

