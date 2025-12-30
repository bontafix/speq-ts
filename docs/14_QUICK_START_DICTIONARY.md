# Быстрый старт: Создание справочника параметров

## Шаг 1: Настроить переменные окружения

Создайте файл `.env` в корне проекта (если его ещё нет) на основе `env.example`:

```bash
cp env.example .env
```

Отредактируйте `.env` и укажите параметры подключения к PostgreSQL:

```bash
# База данных PostgreSQL
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_password
PGDATABASE=equipment_catalog
```

**Важно**: Файл `.env` уже должен быть в `.gitignore`, чтобы не попасть в репозиторий.

## Шаг 2: Применить миграции

### Вариант 1: Через скрипт миграций (рекомендуется)

```bash
# Применить все миграции
cd migrations && ./apply.sh

# Или применить конкретные миграции
cd migrations && ./apply.sh 7
cd migrations && ./apply.sh 8
```

### Вариант 2: Напрямую через psql

```bash
# Загрузить переменные из .env
export $(cat .env | grep -v '^#' | xargs)

# Применить миграции
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f migrations/007_create_parameter_dictionary.sql
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f migrations/008_add_normalized_parameters.sql
```

### Вариант 3: Если используете DATABASE_URL

Если у вас есть переменная `DATABASE_URL` в формате:
```
postgresql://user:password@host:port/database
```

То можно использовать:
```bash
psql $DATABASE_URL -f migrations/007_create_parameter_dictionary.sql
psql $DATABASE_URL -f migrations/008_add_normalized_parameters.sql
```

## Шаг 3: Анализ существующих параметров

```bash
npm run analyze:parameters
```

**Что делает**:
- Анализирует все параметры из `main_parameters` в таблице `equipment`
- Находит уникальные ключи параметров
- Анализирует типы значений (число/строка/enum)
- Определяет единицы измерения
- Сохраняет результаты в `parameter-analysis.json`

**Результат**:
- Выводит в консоль топ-30 параметров
- Сохраняет полный анализ в `parameter-analysis.json`

## Шаг 4: Генерация справочника через LLM

```bash
npm run generate:dictionary
```

**Что делает**:
- Загружает результаты анализа из `parameter-analysis.json`
- Генерирует записи справочника через LLM для топ-50 параметров
- Сохраняет записи в таблицу `parameter_dictionary`

**Настройки** (через переменные окружения):
- `MIN_PARAM_FREQUENCY=3` - минимальная частота использования параметра
- `MAX_PARAMS_TO_GENERATE=50` - максимальное количество параметров для генерации
- `LLM_MODEL=qwen2.5:7b-instruct-q4_K_M` - модель LLM

**Результат**:
- Записи в таблице `parameter_dictionary`
- Статистика: успешно/ошибок

## Шаг 5: Проверка и корректировка

```sql
-- Просмотреть все записи справочника
SELECT 
  key,
  label_ru,
  category,
  param_type,
  unit,
  priority
FROM parameter_dictionary
ORDER BY priority, key;

-- Проверить критичные параметры
SELECT * FROM parameter_dictionary WHERE priority = 0;
```

**Рекомендуется**:
- Проверить критичные параметры (priority = 0)
- Скорректировать категории, единицы измерения
- Добавить недостающие алиасы
- Проверить enum значения

## Шаг 6: Нормализация параметров

После создания справочника можно запустить нормализацию:

```bash
# (Скрипт будет создан позже)
npm run normalize:parameters
```

## Примеры использования

### Просмотр анализа

```bash
# После анализа
cat parameter-analysis.json | jq '.[0:5]'
```

### Проверка справочника

```sql
-- Количество записей
SELECT COUNT(*) FROM parameter_dictionary;

-- Параметры по категориям
SELECT category, COUNT(*) 
FROM parameter_dictionary 
GROUP BY category 
ORDER BY COUNT(*) DESC;

-- Числовые параметры
SELECT key, label_ru, unit, min_value, max_value
FROM parameter_dictionary
WHERE param_type = 'number'
ORDER BY priority;
```

## Устранение проблем

### Ошибка: "Файл parameter-analysis.json не найден"
**Решение**: Сначала запустите `npm run analyze:parameters`

### Ошибка: "Ни один LLM провайдер не доступен"
**Решение**: 
- Проверьте, что Ollama запущен: `curl http://localhost:11434/api/tags`
- Или настройте API ключи для Groq/OpenAI в `.env`

### LLM генерирует некорректные данные
**Решение**:
- Проверьте записи в БД
- Скорректируйте вручную критичные параметры
- Можно перегенерировать конкретный параметр через SQL UPDATE

## Следующие шаги

1. ✅ Справочник создан
2. ⏭ Создать сервис нормализации параметров
3. ⏭ Запустить нормализацию существующих данных
4. ⏭ Обновить поиск для использования normalized_parameters

