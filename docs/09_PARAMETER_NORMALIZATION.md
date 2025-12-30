# Нормализация параметров оборудования

## Ключевые идеи из архитектуры MVP бота

### 1. Двухслойное хранение параметров

**Проблема**: Исходные данные из разных источников имеют разный формат, единицы измерения и названия полей.

**Решение**: Разделить хранение на два слоя:

- **`raw_parameters`** (jsonb) - исходные данные "как пришли"
  - Все строки, любые единицы, ошибки источника, локализация
  - Используется для: отображения карточки, отладки, повторной нормализации
  
- **`main_parameters`** (jsonb) - нормализованные параметры (canonical)
  - ТОЛЬКО известные ключи, ТОЛЬКО числовые/enum значения, стандартные единицы
  - Используется для: SQL фильтров, сортировки, индексации

**Пример**:
```json
// raw_parameters
{
  "Мощность": "132 л.с.",
  "Рабочий вес": "13500 кг",
  "Тип питания": "Дизельный"
}

// main_parameters (canonical)
{
  "power_hp": 132,
  "weight_kg": 13500,
  "fuel_type": "diesel"
}
```

### 2. Нормализация только важных параметров

**Правило**: Нормализовать только 20-30% параметров, по которым реально ищут и фильтруют.

**Критические параметры** (обязательно нормализовать):
- Масса/вес (`weight_kg`)
- Мощность (`power_hp`, `power_kw`)
- Грузоподъёмность (`capacity_kg`, `capacity_t`)
- Производительность (`capacity_tph`, `capacity_m3h`)
- Размеры (ширина, длина, высота)
- Глубина копания (`dig_depth_m`)
- Тип хода (`drive_type`: "crawler" | "wheeled")

**Enum/категориальные** (нормализовать):
- Тип питания (`fuel_type`: "diesel" | "petrol" | "electric")
- Экологический класс (`emission_class`: "Tier II" | "Tier III" | "Tier IV")

**Остальное** (хранить как есть в `additional_parameters`):
- Модель двигателя
- Серийный номер
- Артикул
- URL
- Дата создания

### 3. Словарь параметров (Parameter Dictionary)

**Единый источник истины** для всех преобразований:

```typescript
const PARAMS = {
  weight_kg: {
    label: "Масса",
    unit: "кг",
    type: "number",
    aliases: ["масса", "вес", "weight", "рабочий вес", "вес при транспортировке"],
    sql: "main_parameters->>'weight_kg'",
  },
  power_hp: {
    label: "Мощность",
    unit: "л.с.",
    type: "number",
    aliases: ["мощность", "power", "л.с.", "hp"],
    sql: "main_parameters->>'power_hp'",
  },
  fuel_type: {
    label: "Тип питания",
    type: "enum",
    values: {
      diesel: "дизель",
      petrol: "бензин",
      electric: "электрический",
    },
    aliases: ["тип питания", "fuel", "топливо"],
  },
};
```

### 4. EmbeddingTextBuilder

**Задача**: Преобразовать canonical JSON в человекочитаемый текст для embedding.

**Структура текста**:
```
[IDENTITY]
[CAPABILITIES]
[PARAMETERS (NORMALIZED)]
```

**Пример**:
```
Экскаватор CAT 320.
Тип оборудования: экскаватор.
Подтип: гусеничный экскаватор.
Производитель: Caterpillar.

Назначение: земляные и строительные работы.
Подходит для рытья котлованов, траншей, погрузки грунта.

Технические характеристики:
Масса: 21 тонна.
Мощность двигателя: 110 киловатт.
Тип хода: гусеничный.
```

**Правила**:
- ✅ Человеческий язык (не JSON)
- ✅ Единицы измерения обязательны
- ✅ Преобразование названий параметров (JSON key → читаемый текст)
- ✅ Только важные параметры
- ❌ Без шума (серийные номера, артикулы)

### 5. JSON Schema для валидации

**Зачем**:
- Гарантия формы данных
- Защита от галлюцинаций LLM
- Безопасный re-normalization

**Пример**:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "power_hp": {
      "type": "number",
      "minimum": 0,
      "maximum": 10000
    },
    "weight_kg": {
      "type": "number",
      "minimum": 100,
      "maximum": 1000000
    },
    "fuel_type": {
      "type": "string",
      "enum": ["diesel", "petrol", "electric", "hybrid"]
    }
  }
}
```

### 6. Индексы PostgreSQL

**GIN индекс для JSONB**:
```sql
CREATE INDEX equipment_main_params_gin
ON equipment
USING gin (main_parameters jsonb_path_ops);
```

**B-Tree индексы для часто используемых параметров**:
```sql
CREATE INDEX equipment_weight_idx
ON equipment (((main_parameters->>'weight_kg')::numeric))
WHERE is_active = true;
```

### 7. Версионирование нормализации

**Поля в БД**:
```sql
normalization_version text,
normalized_at timestamp
```

**Зачем**:
- Массовый пересчёт при изменении логики
- A/B тестирование логики
- Откат к предыдущей версии

## Архитектура нормализации

```
RAW JSON (raw_parameters)
    ↓
NormalizerService
    ├─ RuleBasedNormalizer (80%)
    │   ├─ Словари
    │   ├─ Regex
    │   └─ UnitParser
    └─ LLMNormalizer (20%, fallback)
    ↓
Validator (JSON Schema)
    ↓
Canonical JSON (main_parameters)
    ↓
EmbeddingTextBuilder
    ↓
Embedding Vector
```

## Что НЕ делать

❌ **Извлекать параметры обратно из embedding**
- Embedding = read-only semantic hint
- Никогда не парсить параметры из embedding

❌ **Хранить параметры только текстом**
- Нужна структурированная форма для SQL

❌ **Позволять LLM писать SQL**
- SQL строится детерминированно из SearchQuery
- LLM только заполняет SearchQuery JSON

❌ **Нормализовать в runtime запроса пользователя**
- Нормализация только при импорте/обновлении данных
- Можно использовать async pipeline (RabbitMQ)

## Рекомендации для текущего проекта

### Текущее состояние

В проекте уже есть:
- ✅ Базовая нормализация в `CatalogService.searchEquipment()`
- ✅ Поддержка `_min` и `_max` суффиксов в `EquipmentRepository`
- ✅ Работа с `main_parameters` как JSONB

### Что добавить

1. **Добавить поле `raw_parameters` в схему БД**
   ```sql
   ALTER TABLE equipment
   ADD COLUMN raw_parameters jsonb DEFAULT '{}'::jsonb;
   ```

2. **Создать `ParameterDictionary`** - словарь параметров
   - Определить canonical ключи
   - Маппинг aliases → canonical
   - Метаданные (label, unit, type)

3. **Создать `EmbeddingTextBuilder`**
   - Преобразование canonical JSON → текст
   - Использование ParameterDictionary
   - Структурированный формат (Identity + Capabilities + Parameters)

4. **Улучшить нормализацию в `CatalogService`**
   - Добавить нормализацию параметров из SearchQuery
   - Использовать ParameterDictionary для валидации

5. **Добавить индексы PostgreSQL**
   - GIN индекс для `main_parameters`
   - B-Tree индексы для часто используемых параметров

6. **Версионирование** (опционально)
   - Поля `normalization_version` и `normalized_at`
   - Возможность пересчёта при изменении логики

## Примеры использования

### Поиск с нормализованными параметрами

```typescript
// Пользователь: "экскаватор до 25 тонн"
// LLM возвращает:
{
  "text": "экскаватор",
  "parameters": {
    "weight_kg_max": 25000
  }
}

// SQL запрос:
WHERE (main_parameters->>'weight_kg')::numeric <= 25000
```

### Формирование embedding текста

```typescript
// Из canonical JSON:
{
  "weight_kg": 21000,
  "power_hp": 110,
  "fuel_type": "diesel"
}

// В embedding текст:
"Масса: 21 тонна. Мощность двигателя: 110 л.с. Тип питания: дизельный."
```

## Следующие шаги

1. Спроектировать `ParameterDictionary` под спецтехнику
2. Реализовать `EmbeddingTextBuilder`
3. Добавить миграцию для `raw_parameters`
4. Создать индексы PostgreSQL
5. Улучшить нормализацию в `CatalogService`

