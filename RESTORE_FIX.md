# Решение проблемы "must be owner of extension vector"

## Проблема

При восстановлении бэкапа появляется ошибка:
```
ERROR: must be owner of extension vector
```

Это происходит потому, что пользователь `speq_user` не является владельцем расширения `vector`, и `pg_restore` пытается его удалить/изменить.

## Решение

### Вариант 1: Создать расширение перед восстановлением (рекомендуется)

```bash
# 1. Создайте расширение vector в БД (требуются права суперпользователя)
psql -h localhost -U postgres -d speq_ts -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 2. Восстановите бэкап БЕЗ флага --create (так как БД уже существует)
pg_restore -h localhost -U speq_user -d speq_ts --clean --if-exists --no-owner --no-privileges speq_backup.dump
```

### Вариант 2: Игнорировать ошибки с расширением

Если расширение уже создано, можно игнорировать эти ошибки:

```bash
# Восстановление с фильтрацией ошибок расширения
pg_restore -h localhost -U speq_user -d speq_ts --clean --if-exists --no-owner --no-privileges speq_backup.dump 2>&1 | grep -v "extension vector"
```

### Вариант 3: Использовать скрипт восстановления

Скрипт `restore-database.sh` автоматически обрабатывает эту ситуацию:

```bash
./restore-database.sh speq_backup.dump
```

## Проверка после восстановления

```bash
# Проверьте, что расширение vector создано
psql -h localhost -U speq_user -d speq_ts -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# Проверьте количество записей
psql -h localhost -U speq_user -d speq_ts -c "SELECT COUNT(*) FROM equipment;"

# Проверьте наличие embeddings
psql -h localhost -U speq_user -d speq_ts -c "SELECT COUNT(*) FILTER (WHERE embedding IS NOT NULL) FROM equipment;"
```

## Если расширение не создано

Если расширение `vector` не создано в БД, создайте его от имени суперпользователя:

```bash
psql -h localhost -U postgres -d speq_ts -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Если расширение не установлено в системе PostgreSQL, установите его:

```bash
# Ubuntu/Debian
sudo apt install postgresql-15-pgvector

# Или для другой версии PostgreSQL
sudo apt install postgresql-<версия>-pgvector
```

