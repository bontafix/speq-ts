# Бэкап и восстановление базы данных

## Быстрый старт

### Создание бэкапа

```bash
# Использует параметры из .env файла
./backup-database.sh

# Или с явным указанием переменных окружения
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=password PGDATABASE=equipment_catalog ./backup-database.sh
```

Бэкап сохраняется в папку `backups/` в двух форматах:
- **SQL дамп** (`.sql`) - текстовый формат, можно просматривать и редактировать
- **Custom дамп** (`.dump`) - сжатый формат, быстрее восстанавливается (рекомендуется)

### Восстановление на новом сервере

#### Шаг 1: Подготовка нового сервера

```bash
# Установите PostgreSQL с расширением pgvector
sudo apt install postgresql-15 postgresql-15-pgvector

# Или через Docker
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=equipment_catalog \
  pgvector/pgvector:pg16
```

#### Шаг 2: Скопируйте файл бэкапа на новый сервер

```bash
# Через scp
scp backups/backup_equipment_catalog_20240101_120000.dump user@new-server:/path/to/backups/

# Или через rsync
rsync -avz backups/backup_equipment_catalog_20240101_120000.dump user@new-server:/path/to/backups/
```

#### Шаг 3: Восстановите базу данных

```bash
# На новом сервере, в директории проекта
# Обновите .env с параметрами нового сервера
PGHOST=new-server-host PGPORT=5432 PGUSER=postgres PGPASSWORD=new_password ./restore-database.sh backups/backup_equipment_catalog_20240101_120000.dump

# Если нужно удалить существующую БД перед восстановлением
./restore-database.sh backups/backup_equipment_catalog_20240101_120000.dump --drop-existing
```

## Детальная инструкция

### Что включает бэкап

- ✅ Все таблицы и их структура
- ✅ Все данные
- ✅ Индексы
- ✅ Триггеры и функции
- ✅ Последовательности (sequences)
- ✅ Расширения (включая pgvector)
- ⚠️ Права доступа (owner/privileges) - исключены для переносимости

### Ручное создание бэкапа (без скрипта)

```bash
# SQL формат
pg_dump -h localhost -U postgres -d equipment_catalog \
  --clean --if-exists --create --format=plain \
  > backup.sql

# Custom формат (рекомендуется)
pg_dump -h localhost -U postgres -d equipment_catalog \
  --clean --if-exists --create --format=custom \
  -f backup.dump
```

### Ручное восстановление (без скрипта)

**⚠️ Важно:** Если вы используете обычного пользователя (не суперпользователя), создайте расширение `vector` вручную перед восстановлением:

```bash
# 1. Создайте базу данных (если её нет)
psql -h new-server -U postgres -d postgres -c "CREATE DATABASE speq_ts;"

# 2. Создайте расширение vector в новой БД (требуются права суперпользователя)
# Если вы используете обычного пользователя, попросите администратора выполнить:
psql -h new-server -U postgres -d speq_ts -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 3. Восстановите бэкап (БЕЗ флага --create, так как БД уже создана)
pg_restore -h new-server -U speq_user -d speq_ts \
  --clean --if-exists \
  --no-owner --no-privileges \
  backup.dump

# Или если используете SQL дамп:
psql -h new-server -U speq_user -d speq_ts -f backup.sql
```

**Решение проблемы "must be owner of extension vector":**

Если при восстановлении появляется ошибка:
```
ERROR: must be owner of extension vector
```

Это происходит потому, что `pg_restore` пытается удалить/изменить расширение, но у обычного пользователя нет прав. Решение:

1. **Вариант 1 (рекомендуется):** Создайте расширение ДО восстановления:
   ```bash
   # От имени суперпользователя
   psql -h localhost -U postgres -d speq_ts -c "CREATE EXTENSION IF NOT EXISTS vector;"
   
   # Затем восстановите БЕЗ флага --create
   pg_restore -h localhost -U speq_user -d speq_ts --clean --if-exists speq_backup.dump
   ```

2. **Вариант 2:** Игнорируйте ошибки с расширением (если оно уже создано):
   ```bash
   pg_restore -h localhost -U speq_user -d speq_ts --clean --if-exists speq_backup.dump 2>&1 | grep -v "extension vector"
   ```

3. **Вариант 3:** Используйте скрипт `restore-database.sh`, который автоматически обрабатывает эту ситуацию.

## Проверка после восстановления

```bash
# Подключитесь к восстановленной БД
psql -h new-server -U postgres -d equipment_catalog

# Проверьте количество записей
SELECT COUNT(*) FROM equipment;

# Проверьте наличие расширения pgvector
SELECT * FROM pg_extension WHERE extname = 'vector';

# Проверьте наличие функции векторного поиска
SELECT proname FROM pg_proc WHERE proname = 'equipment_vector_search';

# Проверьте embeddings
SELECT 
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS with_embedding,
  COUNT(*) FILTER (WHERE embedding IS NULL) AS without_embedding
FROM equipment;
```

## Важные замечания

1. **Размер бэкапа**: Бэкап может быть большим из-за векторных данных (embeddings). Убедитесь, что на диске достаточно места.

2. **Время восстановления**: Восстановление может занять время в зависимости от размера БД. Custom формат восстанавливается быстрее.

3. **Права доступа**: Скрипты используют `--no-owner --no-privileges` для переносимости. После восстановления может потребоваться настроить права доступа вручную.

4. **Расширения**: 
   - Убедитесь, что на новом сервере установлено расширение `pgvector` перед восстановлением
   - Если используете обычного пользователя (не суперпользователя), создайте расширение `vector` вручную перед восстановлением
   - Ошибки "must be owner of extension vector" можно игнорировать, если расширение уже создано

5. **Версии PostgreSQL**: Рекомендуется использовать одинаковые или совместимые версии PostgreSQL на обоих серверах.

6. **Пользователь БД**: Если вы используете обычного пользователя БД (не `postgres`), убедитесь, что:
   - Расширение `vector` создано в БД (требуются права суперпользователя)
   - Пользователь имеет права на создание объектов в БД

## Автоматизация бэкапов

Для регулярных бэкапов можно добавить в crontab:

```bash
# Ежедневный бэкап в 2:00 ночи
0 2 * * * cd /path/to/project && ./backup-database.sh

# Еженедельный бэкап с удалением старых (старше 30 дней)
0 3 * * 0 cd /path/to/project && ./backup-database.sh && find backups/ -name "*.dump" -mtime +30 -delete
```

