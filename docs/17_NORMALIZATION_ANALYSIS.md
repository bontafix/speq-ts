# Анализ текущей реализации нормализации параметров запроса

## Дата проверки
30 декабря 2025

## Общий вывод

✅ **Алгоритм реализован согласно документации** (16_QUERY_PARAMETER_NORMALIZATION.md)

⚠️ **Обнаружена избыточная двухуровневая нормализация**

## Текущий поток данных

```
Пользовательский запрос
    ↓
[1] SearchEngine.search() (строки 54-78)
    ├─ Проверка загрузки словаря
    ├─ QueryParameterNormalizer.normalizeQuery()
    │   ├─ Разделение параметров по суффиксам (_min, _max)
    │   ├─ ParameterNormalizerService.normalize()
    │   │   ├─ ParameterDictionaryService.findCanonicalKey()
    │   │   ├─ UnitParser.parseValue() (для числовых)
    │   │   └─ EnumMapper.mapEnumValue() (для enum)
    │   └─ Сборка с суффиксами обратно
    └─ normalizedQuery (canonical параметры)
    ↓
[2] EquipmentRepository.fullTextSearch() (строки 183-260)
    ├─ Построение WHERE условий
    ├─ Для каждого параметра:
    │   └─ normalizeParameter() ⚠️ ПОВТОРНАЯ НОРМАЛИЗАЦИЯ!
    │       ├─ Определение суффикса (_min, _max)
    │       ├─ Приоритет: ParameterDictionaryService.findCanonicalKey()
    │       └─ Fallback: ParameterNameMapper.mapParameterName()
    └─ Генерация SQL запроса
```

## Проблемы

### 1. ⚠️ Двойная нормализация

**Где:**
- Первая нормализация: `SearchEngine.search()` → `QueryParameterNormalizer`
- Вторая нормализация: `EquipmentRepository.fullTextSearch()` → `normalizeParameter()`

**Почему это проблема:**
1. **Избыточность**: Параметры, уже нормализованные в SearchEngine, нормализуются повторно в Repository
2. **Потеря производительности**: Двойное обращение к словарю и парсинг единиц
3. **Риск конфликтов**: Если логика нормализации отличается между уровнями

**Пример:**

```typescript
// Входной запрос от пользователя/LLM
{
  "parameters": {
    "Мощность_min": "100 л.с."
  }
}

// ШАГ 1: SearchEngine нормализует
// QueryParameterNormalizer.normalizeQuery()
{
  "parameters": {
    "power_hp_min": 100  // ✅ Уже canonical формат
  }
}

// ШАГ 2: EquipmentRepository СНОВА нормализует
// normalizeParameter("power_hp_min", 100)
// Ищет "power_hp" в словаре ПОВТОРНО ⚠️
// Определяет суффикс "_min" ПОВТОРНО ⚠️
```

### 2. ✅ Корректность алгоритма

Несмотря на двойную нормализацию, алгоритм работает корректно:

**Разделение по суффиксам:**
```typescript
// QueryParameterNormalizer.normalizeQuery(), строки 82-97
for (const [key, value] of Object.entries(query.parameters)) {
  if (key.endsWith("_min")) {
    const baseKey = key.replace("_min", "");
    minParams[baseKey] = value;  // ✅ Суффикс убран для нормализации
  } else if (key.endsWith("_max")) {
    const baseKey = key.replace("_max", "");
    maxParams[baseKey] = value;  // ✅ Суффикс убран для нормализации
  } else {
    regularParams[key] = value;
  }
}
```

**Нормализация базового ключа:**
```typescript
// ParameterNormalizerService.normalize(), строки 26-91
const paramDef = this.dictionaryService.findCanonicalKey(rawKey);  // ✅ Поиск в словаре

if (paramDef.param_type === "number") {
  normalizedValue = this.unitParser.parseValue(rawValue, paramDef.unit);  // ✅ Конверсия единиц
}
```

**Восстановление суффиксов:**
```typescript
// QueryParameterNormalizer.normalizeQuery(), строки 116-123
for (const [key, value] of Object.entries(minResult.normalized)) {
  normalizedParameters[`${key}_min`] = value;  // ✅ Суффикс добавлен обратно
}
```

**SQL построение:**
```typescript
// EquipmentRepository.fullTextSearch(), строки 214-236
const normalized = this.normalizeParameter(key, value);
const { paramKey, value: normalizedValue, operator, sqlCast } = normalized;

whereParts.push(
  `(main_parameters->>$${keyIndex})${sqlCast} ${operator} $${valueIndex}`
);
// ✅ Корректный SQL с >= для _min и <= для _max
```

## Рекомендации

### 1. Устранить двойную нормализацию

**Вариант A: Упростить EquipmentRepository**

Убрать метод `normalizeParameter()` из Repository, так как параметры уже нормализованы:

```typescript
// EquipmentRepository.fullTextSearch()
if (query.parameters && Object.keys(query.parameters).length > 0) {
  for (const [key, value] of Object.entries(query.parameters)) {
    // Параметры УЖЕ в canonical формате (power_hp_min, weight_kg_max)
    let operator: '=' | '>=' | '<=' = '=';
    let sqlCast = '::text';
    let paramKey = key;

    // Определяем оператор из суффикса
    if (key.endsWith('_min')) {
      operator = '>=';
      sqlCast = '::numeric';
      paramKey = key.slice(0, -4);
    } else if (key.endsWith('_max')) {
      operator = '<=';
      sqlCast = '::numeric';
      paramKey = key.slice(0, -4);
    } else if (typeof value === 'number') {
      sqlCast = '::numeric';
    }

    // Валидация
    if (!this.validateParameterKey(paramKey)) continue;

    // Добавляем условие
    values.push(paramKey, value);
    const keyIndex = values.length - 1;
    const valueIndex = values.length;
    
    whereParts.push(
      `(main_parameters->>$${keyIndex})${sqlCast} ${operator} $${valueIndex}`
    );
  }
}
```

**Вариант B: Сохранить fallback в Repository**

Если нужно поддерживать случаи, когда SearchEngine НЕ выполнил нормализацию (словарь недоступен), можно добавить проверку:

```typescript
// Проверяем, нормализованы ли параметры
const isNormalized = query.parameters && Object.keys(query.parameters).every(key => {
  // Canonical ключи содержат только латиницу, цифры и _
  return /^[a-z0-9_]+$/i.test(key);
});

if (!isNormalized) {
  // Применяем fallback нормализацию
  const normalized = this.normalizeParameter(key, value);
  // ...
} else {
  // Параметры уже нормализованы, просто строим SQL
  // ...
}
```

### 2. Добавить флаг нормализации

Добавить в `SearchQuery` флаг, показывающий, что параметры нормализованы:

```typescript
export interface SearchQuery {
  text?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  region?: string;
  parameters?: Record<string, string | number>;
  limit?: number;
  _normalized?: boolean;  // ← Новый флаг
}
```

Тогда в Repository:

```typescript
if (query._normalized) {
  // Пропускаем нормализацию, параметры уже готовы
} else {
  // Применяем нормализацию
}
```

### 3. Документировать контракт

Четко задокументировать, что `EquipmentRepository` ожидает:
- **Вариант 1**: Всегда canonical параметры (ответственность SearchEngine)
- **Вариант 2**: Любые параметры (Repository сам нормализует)

Текущая реализация смешивает оба подхода.

## Тестовые сценарии

### Сценарий 1: Нормализация диапазона

**Входной запрос:**
```json
{
  "text": "экскаватор",
  "parameters": {
    "Мощность_min": "100 л.с.",
    "Рабочий вес_max": "25000 кг"
  }
}
```

**Шаг 1 - SearchEngine нормализует:**
```json
{
  "text": "экскаватор",
  "parameters": {
    "power_hp_min": 100,
    "weight_kg_max": 25000
  }
}
```

**Шаг 2 - Repository строит SQL:**
```sql
WHERE (main_parameters->>'power_hp')::numeric >= 100
  AND (main_parameters->>'weight_kg')::numeric <= 25000
```

✅ **Результат корректный**, но нормализация выполнена дважды

### Сценарий 2: Конверсия единиц

**Входной запрос:**
```json
{
  "parameters": {
    "Мощность": "97 кВт",
    "Масса": "20 тонн"
  }
}
```

**Шаг 1 - SearchEngine нормализует:**
```json
{
  "parameters": {
    "power_kw": 97,
    "weight_kg": 20000
  }
}
```

✅ **UnitParser** корректно конвертирует тонны в килограммы

### Сценарий 3: Enum значения

**Входной запрос:**
```json
{
  "parameters": {
    "Тип питания": "Дизельный"
  }
}
```

**Шаг 1 - SearchEngine нормализует:**
```json
{
  "parameters": {
    "fuel_type": "diesel"
  }
}
```

✅ **EnumMapper** корректно маппит текстовые значения

## Совместимость с документацией

| Компонент | Документация | Реализация | Статус |
|-----------|--------------|------------|--------|
| QueryParameterNormalizer | Строки 82-124 | query-parameter-normalizer.ts:64-154 | ✅ Соответствует |
| Разделение суффиксов | Строки 82-97 | query-parameter-normalizer.ts:82-97 | ✅ Соответствует |
| ParameterNormalizerService | Строки 100-153 | parameter-normalizer.service.ts:26-91 | ✅ Соответствует |
| UnitParser | Строки 109-137 | unit-parser.ts:8-100 | ✅ Соответствует |
| EnumMapper | Строки 116-119 | enum-mapper.ts:10-34 | ✅ Соответствует |
| SQL построение | Строки 186-231 | equipment.repository.ts:214-236 | ⚠️ Дублирование |
| Интеграция SearchEngine | Строки 350-365 | search.engine.ts:54-78 | ✅ Соответствует |

## Итоговая оценка

**Плюсы:**
- ✅ Алгоритм реализован полностью согласно документации
- ✅ Все компоненты работают корректно
- ✅ Поддержка диапазонов (_min, _max)
- ✅ Конверсия единиц измерения
- ✅ Маппинг enum значений
- ✅ Статистика нормализации
- ✅ Обработка ошибок (graceful degradation)

**Минусы:**
- ⚠️ Двойная нормализация (избыточность)
- ⚠️ Неявный контракт между SearchEngine и Repository
- ⚠️ Fallback маппер (ParameterNameMapper) может конфликтовать со словарем

**Рекомендации:**
1. Устранить двойную нормализацию
2. Добавить флаг `_normalized` в SearchQuery
3. Документировать контракт между слоями
4. Рассмотреть удаление ParameterNameMapper (после полной миграции на словарь)

## См. также

- `docs/16_QUERY_PARAMETER_NORMALIZATION.md` - Документация алгоритма
- `src/normalization/query-parameter-normalizer.ts` - Основной нормализатор
- `src/search/search.engine.ts` - Интеграция с поиском
- `src/repository/equipment.repository.ts` - SQL построение

