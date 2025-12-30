# Преобразование JSON запроса от LLM в SQL

## Обзор

Когда LLM возвращает структурированный запрос `SearchQuery` с параметрами в произвольном формате (например, `"Мощность": "132 л.с."`), система автоматически нормализует их в canonical формат (например, `"power_hp": 132`) и преобразует в SQL условия для поиска по нормализованным параметрам.

## Архитектура

```
LLM → SearchQuery (JSON)
    ↓
QueryParameterNormalizer
    ├─ Нормализация параметров через ParameterDictionaryService
    ├─ Преобразование единиц измерения
    ├─ Маппинг enum значений
    └─ Обработка диапазонов (_min, _max)
    ↓
Нормализованный SearchQuery (canonical параметры)
    ↓
EquipmentRepository.fullTextSearch()
    ├─ Построение SQL условий WHERE
    └─ Выполнение запроса к PostgreSQL
```

## Примеры преобразования

### Пример 1: Простые параметры

**Входной запрос от LLM:**
```json
{
  "text": "экскаватор",
  "parameters": {
    "Мощность": "132 л.с.",
    "Рабочий вес": "13500 кг",
    "Тип питания": "Дизельный"
  }
}
```

**Нормализованный запрос:**
```json
{
  "text": "экскаватор",
  "parameters": {
    "power_hp": 132,
    "weight_kg": 13500,
    "fuel_type": "diesel"
  }
}
```

**SQL условия:**
```sql
WHERE (main_parameters->>'power_hp')::numeric = 132
  AND (main_parameters->>'weight_kg')::numeric = 13500
  AND main_parameters->>'fuel_type' = 'diesel'::text
```

### Пример 2: Диапазоны значений

**Входной запрос от LLM:**
```json
{
  "text": "экскаватор",
  "parameters": {
    "Мощность_min": "100 л.с.",
    "Рабочий вес_max": "25000 кг"
  }
}
```

**Пошаговое преобразование:**

#### Шаг 1: Разделение параметров по суффиксам

**Сервис/Функция:** `QueryParameterNormalizer.normalizeQuery()` (строки 82-97)

Система анализирует ключи параметров и разделяет их на три группы:

```typescript
// Исходные параметры
{
  "Мощность_min": "100 л.с.",
  "Рабочий вес_max": "25000 кг"
}

// Разделение:
regularParams = {}  // обычные параметры (без суффиксов)
minParams = {
  "Мощность": "100 л.с."  // убран суффикс _min
}
maxParams = {
  "Рабочий вес": "25000 кг"  // убран суффикс _max
}
```

#### Шаг 2: Нормализация базовых ключей

**Сервис:** `ParameterNormalizerService.normalize()` (строки 26-91)

Для каждой группы параметров выполняется нормализация через словарь. Процесс включает несколько подшагов:

**2.1. Поиск canonical ключа в словаре**
- **Функция:** `ParameterDictionaryService.findCanonicalKey()` (строки 88-115)
- Ищет соответствие по ключу или алиасам в словаре параметров
- Возвращает `ParameterDictionary` с метаданными параметра

**2.2. Парсинг единиц измерения (для числовых параметров)**
- **Класс:** `UnitParser`
- **Функция:** `UnitParser.parseValue()` (строки 8-27)
  - Извлекает число из строки
  - **Вспомогательная функция:** `UnitParser.detectUnit()` (строки 32-64) - определяет единицу измерения
  - **Вспомогательная функция:** `UnitParser.convertUnit()` (строки 69-100) - конвертирует единицы

**2.3. Маппинг enum значений (для категориальных параметров)**
- **Класс:** `EnumMapper`
- **Функция:** `EnumMapper.mapEnumValue()` (строки 10-34)
  - Преобразует текстовое значение в canonical enum значение

**Для minParams:**
- Ключ `"Мощность"` → ищется в словаре по алиасам
- Найдено соответствие: `"Мощность"` → canonical key `"power_hp"`
- Значение `"100 л.с."` → парсится через `UnitParser`
  - Извлекается число: `100`
  - Определяется единица: `"л.с."` → `"hp"`
  - Целевая единица из словаря: `"hp"` (совпадает)
  - Результат: `100`

**Для maxParams:**
- Ключ `"Рабочий вес"` → ищется в словаре по алиасам
- Найдено соответствие: `"Рабочий вес"` → canonical key `"weight_kg"`
- Значение `"25000 кг"` → парсится через `UnitParser`
  - Извлекается число: `25000`
  - Определяется единица: `"кг"` → `"kg"`
  - Целевая единица из словаря: `"kg"` (совпадает)
  - Результат: `25000`

**Результат нормализации:**
```typescript
minResult = {
  normalized: {
    "power_hp": 100  // canonical ключ + нормализованное значение
  },
  unresolved: {}
}

maxResult = {
  normalized: {
    "weight_kg": 25000  // canonical ключ + нормализованное значение
  },
  unresolved: {}
}
```

#### Шаг 3: Сборка нормализованных параметров с суффиксами

**Сервис/Функция:** `QueryParameterNormalizer.normalizeQuery()` (строки 108-124)

Система добавляет суффиксы обратно к нормализованным ключам:

```typescript
normalizedParameters = {}

// Из minResult: добавляем _min к ключам
for (key, value) in minResult.normalized:
  normalizedParameters["power_hp_min"] = 100

// Из maxResult: добавляем _max к ключам
for (key, value) in maxResult.normalized:
  normalizedParameters["weight_kg_max"] = 25000
```

**Нормализованный запрос:**
```json
{
  "text": "экскаватор",
  "parameters": {
    "power_hp_min": 100,
    "weight_kg_max": 25000
  }
}
```

#### Шаг 4: Преобразование в SQL условия

**Сервис/Функция:** `EquipmentRepository.fullTextSearch()` (строки 115-151)

В `EquipmentRepository.fullTextSearch()` параметры преобразуются в SQL. Альтернативно можно использовать:
- **Функция:** `QueryParameterNormalizer.buildSQLConditions()` (строки 176-226) - вспомогательный метод для построения SQL условий

**Для `power_hp_min: 100`:**
```typescript
// Обнаружен суффикс _min
const paramKey = "power_hp_min".replace("_min", "")  // → "power_hp"
const numValue = 100

// Добавляем в values для параметризованного запроса
values.push("power_hp", 100)  // [..., "power_hp", 100]
const keyIndex = values.length - 1    // индекс "power_hp"
const valueIndex = values.length      // индекс 100

// Создаем SQL условие
WHERE (main_parameters->>'power_hp')::numeric >= 100
```

**Для `weight_kg_max: 25000`:**
```typescript
// Обнаружен суффикс _max
const paramKey = "weight_kg_max".replace("_max", "")  // → "weight_kg"
const numValue = 25000

// Добавляем в values
values.push("weight_kg", 25000)  // [..., "weight_kg", 25000]
const keyIndex = values.length - 1    // индекс "weight_kg"
const valueIndex = values.length      // индекс 25000

// Создаем SQL условие
WHERE (main_parameters->>'weight_kg')::numeric <= 25000
```

**Итоговый SQL запрос:**
```sql
SELECT id, name, category, brand, price, main_parameters
FROM equipment
WHERE is_active = true
  AND (main_parameters->>'power_hp')::numeric >= $1  -- $1 = 100
  AND (main_parameters->>'weight_kg')::numeric <= $2  -- $2 = 25000
ORDER BY ts_rank(...) DESC, name ASC
LIMIT $3
```

**Визуальная схема процесса:**

```
Входной запрос от LLM:
┌─────────────────────────────────────┐
│ "Мощность_min": "100 л.с."          │
│ "Рабочий вес_max": "25000 кг"        │
└─────────────────────────────────────┘
              │
              ▼
    [Разделение по суффиксам]
              │
    ┌─────────┴─────────┐
    ▼                   ▼
┌─────────┐         ┌─────────┐
│ minParams│         │maxParams│
│ "Мощность"│        │"Рабочий│
│ "100 л.с."│        │вес"    │
│          │        │"25000 кг"│
└─────────┘         └─────────┘
    │                   │
    ▼                   ▼
[Нормализация через словарь]
    │                   │
    ▼                   ▼
┌─────────┐         ┌─────────┐
│power_hp:│         │weight_kg:│
│   100   │         │  25000   │
└─────────┘         └─────────┘
    │                   │
    ▼                   ▼
[Добавление суффиксов]
    │                   │
    ▼                   ▼
┌─────────┐         ┌─────────┐
│power_hp_│         │weight_kg│
│   min   │         │  _max   │
│   100   │         │  25000   │
└─────────┘         └─────────┘
              │
              ▼
    [Построение SQL]
              │
              ▼
┌─────────────────────────────────────┐
│ WHERE                                │
│   (main_parameters->>'power_hp')    │
│     ::numeric >= 100                 │
│   AND                                │
│   (main_parameters->>'weight_kg')    │
│     ::numeric <= 25000               │
└─────────────────────────────────────┘
```

**Сводная таблица функций и сервисов:**

| Шаг | Сервис/Класс | Метод | Файл | Строки |
|-----|--------------|-------|------|--------|
| **1. Разделение** | `QueryParameterNormalizer` | `normalizeQuery()` | `src/normalization/query-parameter-normalizer.ts` | 82-97 |
| **2.1. Поиск ключа** | `ParameterDictionaryService` | `findCanonicalKey()` | `src/normalization/parameter-dictionary.service.ts` | 88-115 |
| **2.2. Парсинг единиц** | `UnitParser` | `parseValue()` | `src/normalization/unit-parser.ts` | 8-27 |
| **2.2.1. Определение единицы** | `UnitParser` | `detectUnit()` (private) | `src/normalization/unit-parser.ts` | 32-64 |
| **2.2.2. Конвертация единиц** | `UnitParser` | `convertUnit()` (private) | `src/normalization/unit-parser.ts` | 69-100 |
| **2.3. Маппинг enum** | `EnumMapper` | `mapEnumValue()` | `src/normalization/enum-mapper.ts` | 10-34 |
| **2. Нормализация** | `ParameterNormalizerService` | `normalize()` | `src/normalization/parameter-normalizer.service.ts` | 26-91 |
| **3. Сборка** | `QueryParameterNormalizer` | `normalizeQuery()` | `src/normalization/query-parameter-normalizer.ts` | 108-124 |
| **4. SQL построение** | `EquipmentRepository` | `fullTextSearch()` | `src/repository/equipment.repository.ts` | 115-151 |
| **4. SQL построение (alt)** | `QueryParameterNormalizer` | `buildSQLConditions()` | `src/normalization/query-parameter-normalizer.ts` | 176-226 |

**Важные детали:**

1. **Сохранение суффиксов**: Суффиксы `_min` и `_max` сохраняются в нормализованном запросе, чтобы `EquipmentRepository` мог правильно обработать их при построении SQL.

2. **Нормализация базового ключа**: Суффикс удаляется **до** нормализации, чтобы найти canonical ключ в словаре. Например, `"Мощность_min"` → `"Мощность"` → поиск в словаре → `"power_hp"`.

3. **Восстановление суффикса**: После нормализации суффикс добавляется обратно: `"power_hp"` → `"power_hp_min"`.

4. **SQL операторы**: 
   - `_min` → SQL оператор `>=` (больше или равно)
   - `_max` → SQL оператор `<=` (меньше или равно)

5. **Типизация в SQL**: Все числовые параметры с `_min`/`_max` приводятся к типу `numeric` для корректного сравнения.

6. **Обработка единиц измерения**: Если единицы в исходном значении отличаются от целевых (например, `"20 тонн"` → `weight_kg`), происходит автоматическая конвертация через `UnitParser`.

### Пример 3: Смешанные единицы измерения

**Входной запрос от LLM:**
```json
{
  "parameters": {
    "Мощность": "97 кВт",
    "Масса": "20 тонн"
  }
}
```

**Нормализованный запрос:**
```json
{
  "parameters": {
    "power_kw": 97,
    "weight_kg": 20000
  }
}
```

**Что произошло:**
- `"97 кВт"` → `power_kw: 97` (единица уже в ключе)
- `"20 тонн"` → `weight_kg: 20000` (конвертация тонн в килограммы)

## Использование

### Автоматическая нормализация

Нормализация происходит автоматически в `SearchEngine.search()`:

```typescript
// В SearchEngine
async search(query: SearchQuery): Promise<CatalogSearchResult> {
  // Автоматическая нормализация параметров
  let normalizedQuery = query;
  if (this.queryNormalizer && query.parameters) {
    await this.dictionaryService!.loadDictionary();
    const result = this.queryNormalizer.normalizeQuery(query);
    normalizedQuery = result.normalizedQuery;
  }
  
  // Поиск с нормализованными параметрами
  const ftsResults = await this.equipmentRepository.fullTextSearch(normalizedQuery, limit);
  // ...
}
```

### Ручная нормализация

Если нужно нормализовать параметры вручную:

```typescript
import { ParameterDictionaryService } from "../normalization";
import { QueryParameterNormalizer } from "../normalization";

const dictionaryService = new ParameterDictionaryService();
await dictionaryService.loadDictionary();

const normalizer = new QueryParameterNormalizer(dictionaryService);

const query: SearchQuery = {
  text: "экскаватор",
  parameters: {
    "Мощность": "132 л.с.",
    "Рабочий вес_max": "25000 кг"
  }
};

const result = normalizer.normalizeQuery(query);
console.log(result.normalizedQuery);
// {
//   text: "экскаватор",
//   parameters: {
//     power_hp: 132,
//     weight_kg_max: 25000
//   }
// }
```

## Компоненты

### QueryParameterNormalizer

Основной сервис для нормализации параметров в запросах.

**Методы:**
- `normalizeQuery(query: SearchQuery): QueryNormalizationResult` - нормализует параметры в SearchQuery
- `buildSQLConditions(normalizedParameters, values): string[]` - создает SQL условия (вспомогательный метод)

### Интеграция с SearchEngine

`SearchEngine` автоматически использует нормализацию, если передан `ParameterDictionaryService`:

```typescript
const dictionaryService = new ParameterDictionaryService();
await dictionaryService.loadDictionary();

const searchEngine = new SearchEngine(repository, dictionaryService);
```

Если словарь не передан, нормализация пропускается, и система работает с параметрами "как есть" (обратная совместимость).

## Требования

### Словарь параметров

Для работы нормализации необходимо:

1. **Загрузить словарь параметров** в БД (таблица `parameter_dictionary`)
2. **Инициализировать ParameterDictionaryService** и вызвать `loadDictionary()`
3. **Передать сервис в SearchEngine** при создании

### Формат параметров в словаре

Словарь должен содержать записи с:
- `key` - canonical ключ (например, `power_hp`)
- `aliases` - варианты названий (например, `["Мощность", "мощность", "power"]`)
- `param_type` - тип (`number`, `enum`, `boolean`)
- `unit` - единица измерения (для `number`)
- `enum_values` - возможные значения (для `enum`)
- `sql_expression` - SQL выражение для доступа к значению

## Обработка ошибок

Если нормализация не удалась:

1. **Словарь не загружен** - используется исходный запрос без нормализации
2. **Параметр не найден в словаре** - параметр пропускается, но запрос выполняется
3. **Ошибка конвертации единиц** - параметр пропускается с предупреждением

Все ошибки логируются, но не прерывают выполнение поиска.

## Статистика нормализации

`QueryNormalizationResult` содержит статистику:

```typescript
{
  normalizedQuery: SearchQuery,
  stats: {
    total: number,        // Всего параметров
    normalized: number,  // Успешно нормализовано
    unresolved: number,  // Не удалось нормализовать
    confidence: number   // Доля успешно нормализованных (0-1)
  }
}
```

## Примеры использования в коде

### CLI

В `src/cli/index.ts` нормализация инициализируется автоматически:

```typescript
const dictionaryService = new ParameterDictionaryService();
try {
  await dictionaryService.loadDictionary();
  console.log("Словарь параметров загружен для нормализации запросов.");
} catch (error) {
  console.warn("Не удалось загрузить словарь параметров. Нормализация параметров отключена.");
}

const searchEngine = new SearchEngine(repository, dictionaryService);
```

### HTTP API

В `src/http/server.ts` словарь загружается при старте сервера:

```typescript
const dictionaryService = new ParameterDictionaryService();
dictionaryService.loadDictionary().catch((error) => {
  console.warn("Не удалось загрузить словарь параметров. Нормализация параметров отключена.");
});

const searchEngine = new SearchEngine(repository, dictionaryService);
```

## Рекомендации

1. **Всегда загружайте словарь** перед использованием поиска
2. **Проверяйте статистику нормализации** для отладки
3. **Добавляйте новые параметры в словарь** по мере необходимости
4. **Используйте canonical ключи** в параметрах запроса, если они уже известны (нормализация все равно пройдет, но быстрее)

## См. также

- `docs/09_PARAMETER_NORMALIZATION.md` - общая концепция нормализации
- `docs/11_CANONICAL_PARAMETERS_EXAMPLES.md` - примеры canonical параметров
- `docs/13_PARAMETER_DICTIONARY_GENERATION.md` - создание словаря параметров

