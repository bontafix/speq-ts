#!/bin/bash
# Скрипт для восстановления базы данных PostgreSQL из бэкапа
# Восстанавливает структуру, данные, расширения и права доступа

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка аргументов
if [ $# -lt 1 ]; then
    echo -e "${RED}❌ Ошибка: Укажите путь к файлу бэкапа${NC}"
    echo ""
    echo "Использование:"
    echo "  $0 <путь_к_бэкапу> [--drop-existing]"
    echo ""
    echo "Примеры:"
    echo "  $0 backups/backup_equipment_catalog_20240101_120000.dump"
    echo "  $0 backups/backup_equipment_catalog_20240101_120000.sql"
    echo "  $0 backups/backup_equipment_catalog_20240101_120000.dump --drop-existing"
    echo ""
    exit 1
fi

BACKUP_FILE="$1"
DROP_EXISTING="${2:-}"

# Проверка существования файла бэкапа
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Ошибка: Файл бэкапа не найден: ${BACKUP_FILE}${NC}"
    exit 1
fi

# Загрузка переменных окружения из .env (если есть)
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Параметры подключения к ЦЕЛЕВОМУ серверу
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"

# Определение имени базы данных из имени файла или переменной окружения
if [[ "$BACKUP_FILE" =~ backup_([^_]+)_[0-9]+\.(sql|dump)$ ]]; then
    TARGET_DB="${BASH_REMATCH[1]}"
else
    TARGET_DB="${PGDATABASE:-equipment_catalog}"
fi

echo -e "${GREEN}🔄 Начинаю восстановление базы данных...${NC}"
echo "   Файл бэкапа: ${BACKUP_FILE}"
echo "   Хост: ${PGHOST}:${PGPORT}"
echo "   Пользователь: ${PGUSER}"
echo "   Целевая БД: ${TARGET_DB}"
echo ""

# Проверка подключения к PostgreSQL
echo -e "${YELLOW}🔍 Проверка подключения к PostgreSQL...${NC}"
if ! PGPASSWORD="${PGPASSWORD}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ Ошибка: Не удалось подключиться к PostgreSQL${NC}"
    echo "   Убедитесь, что:"
    echo "   - PostgreSQL запущен на целевом сервере"
    echo "   - Параметры подключения правильные (PGHOST, PGPORT, PGUSER, PGPASSWORD)"
    echo "   - Пользователь имеет права на создание баз данных"
    exit 1
fi
echo -e "${GREEN}✅ Подключение успешно${NC}"
echo ""

# Удаление существующей базы данных (если указан флаг)
if [ "$DROP_EXISTING" = "--drop-existing" ]; then
    echo -e "${YELLOW}⚠️  Удаление существующей базы данных ${TARGET_DB}...${NC}"
    PGPASSWORD="${PGPASSWORD}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres \
        -c "DROP DATABASE IF EXISTS \"${TARGET_DB}\";" 2>&1
    echo -e "${GREEN}✅ База данных удалена${NC}"
    echo ""
fi

# Проверка и создание расширения vector (если нужно)
echo -e "${YELLOW}🔍 Проверка расширения pgvector...${NC}"
VECTOR_EXISTS=$(PGPASSWORD="${PGPASSWORD}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres \
    -t -c "SELECT EXISTS(SELECT 1 FROM pg_available_extensions WHERE name = 'vector');" 2>/dev/null | xargs)

if [ "$VECTOR_EXISTS" = "t" ]; then
    echo -e "${GREEN}✅ Расширение vector доступно${NC}"
else
    echo -e "${YELLOW}⚠️  Расширение vector не найдено в системе${NC}"
    echo "   Убедитесь, что pgvector установлен на сервере"
    echo "   Для Ubuntu/Debian: sudo apt install postgresql-15-pgvector"
fi
echo ""

# Определение формата бэкапа и восстановление
if [[ "$BACKUP_FILE" == *.dump ]] || [[ "$BACKUP_FILE" == *.custom ]]; then
    # Custom формат - используем pg_restore
    echo -e "${YELLOW}📦 Восстановление из custom формата...${NC}"
    echo -e "${YELLOW}   (Ошибки с расширением vector можно игнорировать, если оно уже создано)${NC}"
    
    # Сначала создаём базу данных, если её нет
    DB_EXISTS=$(PGPASSWORD="${PGPASSWORD}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres \
        -t -c "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = '${TARGET_DB}');" 2>/dev/null | xargs)
    
    if [ "$DB_EXISTS" != "t" ]; then
        echo -e "${YELLOW}   Создание базы данных ${TARGET_DB}...${NC}"
        PGPASSWORD="${PGPASSWORD}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres \
            -c "CREATE DATABASE \"${TARGET_DB}\";" 2>&1
        
        # Создаём расширение vector в новой БД (если доступно)
        if [ "$VECTOR_EXISTS" = "t" ]; then
            echo -e "${YELLOW}   Создание расширения vector в базе данных...${NC}"
            PGPASSWORD="${PGPASSWORD}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TARGET_DB" \
                -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>&1 || echo -e "${YELLOW}   ⚠️  Не удалось создать расширение (может потребоваться права суперпользователя)${NC}"
        fi
    fi
    
    # Восстанавливаем в существующую БД (не используем --create, чтобы избежать проблем с расширениями)
    echo -e "${YELLOW}   Восстановление данных...${NC}"
    RESTORE_OUTPUT=$(PGPASSWORD="${PGPASSWORD}" pg_restore \
        -h "$PGHOST" \
        -p "$PGPORT" \
        -U "$PGUSER" \
        -d "$TARGET_DB" \
        --verbose \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        --exit-on-error \
        "$BACKUP_FILE" 2>&1) || RESTORE_EXIT_CODE=$?
    
    # Фильтруем ошибки, связанные с расширением vector (они не критичны, если расширение уже создано)
    if [ -n "$RESTORE_OUTPUT" ]; then
        echo "$RESTORE_OUTPUT" | grep -v "ERROR.*extension vector" || true
        CRITICAL_ERRORS=$(echo "$RESTORE_OUTPUT" | grep -v "ERROR.*extension vector" | grep "ERROR" || true)
        
        if [ -n "$CRITICAL_ERRORS" ] && [ "$RESTORE_EXIT_CODE" != "0" ]; then
            echo -e "${RED}❌ Критические ошибки при восстановлении:${NC}"
            echo "$CRITICAL_ERRORS"
            exit 1
        fi
    fi
    
    # Проверяем, что расширение vector существует в восстановленной БД
    if [ "$VECTOR_EXISTS" = "t" ]; then
        VECTOR_IN_DB=$(PGPASSWORD="${PGPASSWORD}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TARGET_DB" \
            -t -c "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector');" 2>/dev/null | xargs)
        
        if [ "$VECTOR_IN_DB" != "t" ]; then
            echo -e "${YELLOW}   Создание расширения vector в восстановленной БД...${NC}"
            PGPASSWORD="${PGPASSWORD}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TARGET_DB" \
                -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>&1 || echo -e "${YELLOW}   ⚠️  Не удалось создать расширение (может потребоваться права суперпользователя)${NC}"
        fi
    fi
    
    echo -e "${GREEN}✅ База данных восстановлена успешно!${NC}"
    
elif [[ "$BACKUP_FILE" == *.sql ]]; then
    # SQL формат - используем psql
    echo -e "${YELLOW}📝 Восстановление из SQL дампа...${NC}"
    
    PGPASSWORD="${PGPASSWORD}" psql \
        -h "$PGHOST" \
        -p "$PGPORT" \
        -U "$PGUSER" \
        -d postgres \
        -f "$BACKUP_FILE" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ База данных восстановлена успешно!${NC}"
    else
        echo -e "${RED}❌ Ошибка при восстановлении${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Неизвестный формат файла бэкапа${NC}"
    echo "   Поддерживаются форматы: .sql, .dump, .custom"
    exit 1
fi

echo ""
echo -e "${GREEN}📊 Проверка восстановленной базы данных...${NC}"

# Проверка подключения к восстановленной БД
if PGPASSWORD="${PGPASSWORD}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TARGET_DB" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Подключение к восстановленной БД работает${NC}"
    
    # Статистика
    RECORD_COUNT=$(PGPASSWORD="${PGPASSWORD}" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TARGET_DB" -t -c "SELECT COUNT(*) FROM equipment;" 2>/dev/null | xargs)
    if [ ! -z "$RECORD_COUNT" ]; then
        echo "   Записей в таблице equipment: ${RECORD_COUNT}"
    fi
else
    echo -e "${YELLOW}⚠️  Не удалось подключиться к восстановленной БД для проверки${NC}"
fi

echo ""
echo -e "${GREEN}✅ Восстановление завершено!${NC}"
echo ""
echo -e "${YELLOW}💡 Следующие шаги:${NC}"
echo "   1. Обновите .env файл с параметрами подключения к новой БД"
echo "   2. Проверьте работу приложения: npm start"
echo "   3. Если использовались embeddings, убедитесь, что они восстановлены корректно"
echo ""
echo -e "${YELLOW}📝 Примечание:${NC}"
echo "   Если при восстановлении были ошибки с расширением vector,"
echo "   это нормально, если расширение уже создано в БД."
echo "   Проверьте наличие расширения:"
echo "   psql -h ${PGHOST} -U ${PGUSER} -d ${TARGET_DB} -c \"SELECT * FROM pg_extension WHERE extname = 'vector';\""

