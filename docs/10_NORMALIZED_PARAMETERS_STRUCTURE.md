# Структура нормализованных параметров и справочника

## 1. Новое поле в таблице equipment

### Поле: `normalized_parameters` (JSONB)

**Назначение**: Хранит нормализованные (canonical) параметры для SQL-фильтрации и поиска.

**Структура JSON**:
```json
{
  "weight_kg": 21000,
  "power_hp": 132,
  "power_kw": 97,
  "capacity_tph": 250,
  "dig_depth_m": 6.7,
  "max_width_m": 3.1,
  "fuel_type": "diesel",
  "drive_type": "crawler",
  "emission_class": "Tier III"
}
```

**Правила**:
- ✅ ТОЛЬКО числовые значения (number) или enum строки
- ✅ ТОЛЬКО известные ключи из справочника `parameter_dictionary`
- ✅ Стандартные единицы измерения (кг, кВт, л.с., метры)
- ✅ Никаких строк типа "132 л.с." или "до 25 тонн"
- ❌ Не хранить исходные названия полей
- ❌ Не хранить единицы измерения в значениях

**Пример миграции**:
```sql
ALTER TABLE equipment
ADD COLUMN normalized_parameters JSONB DEFAULT '{}'::jsonb;

-- Индекс GIN для быстрого поиска по JSONB
CREATE INDEX idx_equipment_normalized_params_gin
ON equipment
USING gin (normalized_parameters jsonb_path_ops)
WHERE is_active = true;

-- B-Tree индексы для часто используемых параметров
CREATE INDEX idx_equipment_weight_kg
ON equipment (((normalized_parameters->>'weight_kg')::numeric))
WHERE is_active = true AND normalized_parameters->>'weight_kg' IS NOT NULL;

CREATE INDEX idx_equipment_power_hp
ON equipment (((normalized_parameters->>'power_hp')::numeric))
WHERE is_active = true AND normalized_parameters->>'power_hp' IS NOT NULL;
```

## 2. Таблица-справочник: `parameter_dictionary`

**Назначение**: Единый источник истины для всех параметров оборудования.

### Структура таблицы

```sql
CREATE TABLE parameter_dictionary (
  -- Уникальный ключ параметра (canonical)
  key TEXT PRIMARY KEY,
  
  -- Человекочитаемое название (для отображения)
  label_ru TEXT NOT NULL,
  label_en TEXT,
  
  -- Описание параметра на русском
  description_ru TEXT,
  
  -- Категория параметра (для группировки)
  category TEXT NOT NULL,
  -- Примеры категорий:
  -- 'weight' - масса, вес
  -- 'power' - мощность
  -- 'dimensions' - размеры
  -- 'performance' - производительность
  -- 'fuel' - топливо, энергия
  -- 'drive' - ходовая часть
  -- 'environment' - экология
  -- 'other' - прочее
  
  -- Тип параметра
  param_type TEXT NOT NULL CHECK (param_type IN ('number', 'enum', 'boolean')),
  
  -- Единица измерения (только для number)
  unit TEXT,
  
  -- Для number: допустимые значения (диапазон)
  min_value NUMERIC,
  max_value NUMERIC,
  
  -- Для enum: возможные значения с описаниями
  enum_values JSONB,
  -- Формат: {"diesel": "дизель", "petrol": "бензин"}
  
  -- Алиасы (варианты названий из исходных данных)
  aliases JSONB DEFAULT '[]'::jsonb,
  
  -- SQL выражение для доступа к значению
  sql_expression TEXT NOT NULL,
  
  -- Метаданные
  is_searchable BOOLEAN DEFAULT true,
  is_filterable BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- приоритет для отображения (0 = самый важный)
  
  -- Версионирование
  version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Индекс для быстрого поиска по алиасам
CREATE INDEX idx_parameter_dictionary_aliases
ON parameter_dictionary
USING gin (aliases);

-- Индекс для поиска по типу
CREATE INDEX idx_parameter_dictionary_type
ON parameter_dictionary (param_type);

-- Индекс для поиска по категории
CREATE INDEX idx_parameter_dictionary_category
ON parameter_dictionary (category);
```

### Примеры записей в справочнике

```sql
-- Масса (числовой параметр)
INSERT INTO parameter_dictionary (
  key, label_ru, description_ru, category, 
  param_type, unit, min_value, max_value,
  aliases, sql_expression, priority
) VALUES (
  'weight_kg', 
  'Масса', 
  'Общая масса оборудования в килограммах. Включает рабочий вес и вес при транспортировке.',
  'weight',
  'number', 
  'кг', 
  100,      -- минимальная масса (100 кг)
  1000000,  -- максимальная масса (1000 тонн)
  '["масса", "вес", "weight", "рабочий вес", "вес при транспортировке", "тоннаж"]'::jsonb,
  '(normalized_parameters->>''weight_kg'')::numeric',
  0
);

-- Мощность в л.с. (числовой параметр)
INSERT INTO parameter_dictionary (
  key, label_ru, description_ru, category,
  param_type, unit, min_value, max_value,
  aliases, sql_expression, priority
) VALUES (
  'power_hp',
  'Мощность',
  'Мощность двигателя в лошадиных силах. Характеризует производительность двигателя.',
  'power',
  'number',
  'л.с.',
  1,      -- минимальная мощность (1 л.с.)
  10000,  -- максимальная мощность (10000 л.с.)
  '["мощность", "power", "л.с.", "hp", "лошадиные силы"]'::jsonb,
  '(normalized_parameters->>''power_hp'')::numeric',
  0
);

-- Мощность в кВт (числовой параметр)
INSERT INTO parameter_dictionary (
  key, label_ru, description_ru, category,
  param_type, unit, min_value, max_value,
  aliases, sql_expression, priority
) VALUES (
  'power_kw',
  'Мощность двигателя',
  'Мощность двигателя в киловаттах. Альтернативная единица измерения мощности.',
  'power',
  'number',
  'кВт',
  1,     -- минимальная мощность (1 кВт)
  7500,  -- максимальная мощность (7500 кВт, примерно 10000 л.с.)
  '["мощность двигателя", "power_kw", "киловатт", "кВт"]'::jsonb,
  '(normalized_parameters->>''power_kw'')::numeric',
  1
);

-- Тип питания (enum)
INSERT INTO parameter_dictionary (
  key, label_ru, description_ru, category,
  param_type, enum_values, aliases, sql_expression, priority
) VALUES (
  'fuel_type',
  'Тип питания',
  'Тип топлива или источника энергии для работы оборудования. Определяет требования к заправке и эксплуатации.',
  'fuel',
  'enum',
  '{"diesel": "дизель", "petrol": "бензин", "electric": "электрический", "hybrid": "гибридный"}'::jsonb,
  '["тип питания", "fuel", "топливо", "тип двигателя"]'::jsonb,
  'normalized_parameters->>''fuel_type''',
  1
);

-- Тип хода (enum)
INSERT INTO parameter_dictionary (
  key, label_ru, description_ru, category,
  param_type, enum_values, aliases, sql_expression, priority
) VALUES (
  'drive_type',
  'Тип хода',
  'Тип ходовой части оборудования. Определяет проходимость и условия эксплуатации.',
  'drive',
  'enum',
  '{"crawler": "гусеничный", "wheeled": "колёсный", "track": "гусеничный"}'::jsonb,
  '["тип хода", "drive", "ходовая часть"]'::jsonb,
  'normalized_parameters->>''drive_type''',
  2
);

-- Глубина копания (числовой параметр)
INSERT INTO parameter_dictionary (
  key, label_ru, description_ru, category,
  param_type, unit, min_value, max_value,
  aliases, sql_expression, priority
) VALUES (
  'dig_depth_m',
  'Глубина копания',
  'Максимальная глубина копания в метрах. Характеризует возможности экскаватора по глубине работ.',
  'dimensions',
  'number',
  'м',
  0.5,   -- минимальная глубина (0.5 м)
  50,    -- максимальная глубина (50 м)
  '["глубина копания", "dig_depth", "максимальная глубина"]'::jsonb,
  '(normalized_parameters->>''dig_depth_m'')::numeric',
  1
);

-- Производительность (числовой параметр)
INSERT INTO parameter_dictionary (
  key, label_ru, description_ru, category,
  param_type, unit, min_value, max_value,
  aliases, sql_expression, priority
) VALUES (
  'capacity_tph',
  'Производительность',
  'Производительность оборудования в тоннах в час. Характеризует объём работы за единицу времени.',
  'performance',
  'number',
  'т/ч',
  1,      -- минимальная производительность (1 т/ч)
  10000,  -- максимальная производительность (10000 т/ч)
  '["производительность", "capacity", "т/ч", "тонн в час"]'::jsonb,
  '(normalized_parameters->>''capacity_tph'')::numeric',
  1
);

-- Экологический класс (enum)
INSERT INTO parameter_dictionary (
  key, label_ru, description_ru, category,
  param_type, enum_values, aliases, sql_expression, priority
) VALUES (
  'emission_class',
  'Экологический класс',
  'Класс экологической безопасности двигателя по стандартам выбросов. Определяет соответствие экологическим нормам.',
  'environment',
  'enum',
  '{"Tier I": "Tier I", "Tier II": "Tier II", "Tier III": "Tier III", "Tier IV": "Tier IV", "Stage V": "Stage V"}'::jsonb,
  '["экологический класс", "emission", "класс выбросов"]'::jsonb,
  'normalized_parameters->>''emission_class''',
  2
);
```

## 3. Структура данных: связь между таблицами

```
equipment
├── main_parameters (JSONB)          ← Исходные данные (не трогаем)
├── additional_parameters (JSONB)    ← Исходные данные (не трогаем)
└── normalized_parameters (JSONB)    ← Нормализованные (canonical)
    └── Ключи из parameter_dictionary.key

parameter_dictionary
└── Справочник всех возможных параметров
    ├── key (canonical)
    ├── aliases (варианты названий)
    └── sql_expression (как обращаться в SQL)
```

## 4. Категории параметров

**Назначение**: Группировка параметров по функциональному назначению для удобной навигации и фильтрации.

**Примеры категорий**:
- `weight` - Масса, вес
- `power` - Мощность
- `dimensions` - Размеры (длина, ширина, высота, глубина)
- `performance` - Производительность
- `fuel` - Топливо, энергия
- `drive` - Ходовая часть
- `environment` - Экология, выбросы
- `capacity` - Грузоподъёмность, объём
- `other` - Прочее

**Использование**:
- Группировка параметров в UI
- Фильтрация справочника по категориям
- Валидация: проверка, что параметр относится к нужной категории

## 5. Примеры использования

### Поиск параметра по алиасу

```sql
-- Найти canonical key по алиасу "масса"
SELECT key, label_ru, unit, sql_expression
FROM parameter_dictionary
WHERE aliases @> '["масса"]'::jsonb
   OR key = 'weight_kg';
```

### SQL-запрос с использованием normalized_parameters

```sql
-- Поиск экскаваторов до 25 тонн
SELECT id, name, normalized_parameters
FROM equipment
WHERE is_active = true
  AND (normalized_parameters->>'weight_kg')::numeric <= 25000
ORDER BY (normalized_parameters->>'weight_kg')::numeric;
```

### Получение метаданных параметра для отображения

```sql
-- Получить полную информацию о параметре weight_kg
SELECT 
  key,
  label_ru,
  description_ru,
  category,
  param_type,
  unit,
  min_value,
  max_value,
  enum_values,
  priority
FROM parameter_dictionary
WHERE key = 'weight_kg';
```

**Результат**:
```
key         | weight_kg
label_ru    | Масса
description_ru | Общая масса оборудования в килограммах. Включает рабочий вес и вес при транспортировке.
category    | weight
param_type  | number
unit        | кг
min_value   | 100
max_value   | 1000000
enum_values | null
priority    | 0
```

### Получение параметров по категории

```sql
-- Получить все параметры категории "power"
SELECT 
  key,
  label_ru,
  description_ru,
  unit,
  min_value,
  max_value,
  priority
FROM parameter_dictionary
WHERE category = 'power'
ORDER BY priority;
```

**Результат**:
```
key       | label_ru          | unit | min_value | max_value | priority
----------|-------------------|------|-----------|-----------|----------
power_hp  | Мощность          | л.с. | 1         | 10000     | 0
power_kw  | Мощность двигателя | кВт  | 1         | 7500      | 1
```

### Валидация значения параметра

```sql
-- Проверить, что значение weight_kg находится в допустимом диапазоне
SELECT 
  key,
  label_ru,
  min_value,
  max_value,
  CASE 
    WHEN 25000 BETWEEN min_value AND max_value THEN 'valid'
    ELSE 'invalid'
  END AS validation_status
FROM parameter_dictionary
WHERE key = 'weight_kg';
```

**Результат**:
```
key       | label_ru | min_value | max_value | validation_status
----------|---------|-----------|-----------|-------------------
weight_kg | Масса   | 100       | 1000000   | valid
```

### Получение enum значений с описаниями

```sql
-- Получить все возможные значения enum параметра fuel_type
SELECT 
  key,
  label_ru,
  description_ru,
  enum_values
FROM parameter_dictionary
WHERE key = 'fuel_type';
```

**Результат**:
```
key        | label_ru   | description_ru | enum_values
-----------|------------|----------------|------------------------------------------
fuel_type  | Тип питания | Тип топлива... | {"diesel": "дизель", "petrol": "бензин", ...}
```

### Поиск параметра по описанию

```sql
-- Найти параметры, в описании которых есть слово "мощность"
SELECT 
  key,
  label_ru,
  description_ru,
  category
FROM parameter_dictionary
WHERE description_ru ILIKE '%мощность%';
```

## 6. TypeScript интерфейсы

### Интерфейс для ParameterDictionary

```typescript
interface ParameterDictionary {
  // Уникальный ключ параметра (canonical)
  key: string;
  
  // Человекочитаемое название
  label_ru: string;
  label_en?: string;
  
  // Описание параметра на русском
  description_ru?: string;
  
  // Категория параметра
  category: 'weight' | 'power' | 'dimensions' | 'performance' | 
           'fuel' | 'drive' | 'environment' | 'capacity' | 'other';
  
  // Тип параметра
  param_type: 'number' | 'enum' | 'boolean';
  
  // Единица измерения (для number)
  unit?: string;
  
  // Допустимые значения (для number)
  min_value?: number;
  max_value?: number;
  
  // Возможные значения (для enum)
  enum_values?: Record<string, string>;
  // Пример: {"diesel": "дизель", "petrol": "бензин"}
  
  // Алиасы (варианты названий)
  aliases: string[];
  
  // SQL выражение для доступа к значению
  sql_expression: string;
  
  // Метаданные
  is_searchable: boolean;
  is_filterable: boolean;
  priority: number;
  
  // Версионирование
  version: string;
  created_at: Date;
  updated_at: Date;
}
```

### Пример использования в коде

```typescript
// Получение параметра из справочника
const weightParam = await parameterDictionaryService.getByKey('weight_kg');

console.log(weightParam.label_ru);        // "Масса"
console.log(weightParam.description_ru);  // "Общая масса оборудования..."
console.log(weightParam.category);        // "weight"
console.log(weightParam.unit);            // "кг"
console.log(weightParam.min_value);       // 100
console.log(weightParam.max_value);       // 1000000

// Валидация значения
const value = 25000;
if (value >= weightParam.min_value && value <= weightParam.max_value) {
  console.log('Значение валидно');
}

// Получение enum значений
const fuelParam = await parameterDictionaryService.getByKey('fuel_type');
console.log(fuelParam.enum_values);
// { "diesel": "дизель", "petrol": "бензин", ... }
```

## 7. Дальнейшие действия

### Этап 1: Создание структуры БД

1. **Миграция для normalized_parameters**
   - Добавить поле в таблицу `equipment`
   - Создать индексы (GIN + B-Tree для частых параметров)

2. **Миграция для parameter_dictionary**
   - Создать таблицу справочника
   - Заполнить базовыми параметрами (масса, мощность, тип питания и т.д.)

### Этап 2: Создание сервисов

1. **ParameterDictionaryService**
   - Загрузка справочника в память
   - Поиск canonical key по алиасу
   - Получение метаданных параметра

2. **ParameterNormalizerService**
   - Нормализация `main_parameters` → `normalized_parameters`
   - Использование `parameter_dictionary` для валидации
   - Поддержка rule-based и LLM-based нормализации

3. **EmbeddingTextBuilder**
   - Преобразование `normalized_parameters` → текст для embedding
   - Использование `parameter_dictionary` для форматирования

### Этап 3: Обновление существующего кода

1. **EquipmentRepository**
   - Изменить SQL-запросы: использовать `normalized_parameters` вместо `main_parameters`
   - Использовать `sql_expression` из справочника

2. **CatalogService**
   - Добавить валидацию параметров через справочник
   - Нормализация параметров из SearchQuery

### Этап 4: Worker для нормализации

1. **NormalizationWorker**
   - Обработка записей без `normalized_parameters`
   - Массовая нормализация при изменении логики
   - Версионирование нормализации

## 8. Преимущества такой архитектуры

✅ **Разделение ответственности**:
- Исходные данные остаются нетронутыми
- Нормализованные данные для поиска
- Справочник как единый источник истины

✅ **Гибкость**:
- Легко добавить новый параметр (добавить в справочник)
- Можно менять логику нормализации без изменения исходных данных
- Версионирование параметров

✅ **Производительность**:
- Индексы на часто используемых параметрах
- Быстрый поиск по canonical ключам
- GIN индекс для JSONB-поиска

✅ **Масштабируемость**:
- Легко расширять справочник
- Можно добавлять новые типы параметров
- Поддержка мультиязычности (label_ru, label_en)

## 9. Вопросы для обдумывания

1. **Какие параметры нормализовать в первую очередь?**
   - Масса, мощность, грузоподъёмность - очевидно
   - Что ещё критично для поиска?

2. **Как обрабатывать единицы измерения?**
   - Всегда приводить к стандартным (кг, кВт, м)
   - Или хранить в разных единицах (weight_kg, weight_t)?

3. **Версионирование нормализации**
   - Нужно ли поле `normalization_version` в equipment?
   - Как обрабатывать пересчёт при изменении логики?

4. **LLM для нормализации**
   - Использовать LLM при импорте данных?
   - Или только rule-based нормализация?

5. **Миграция существующих данных**
   - Как нормализовать уже существующие записи?
   - Нужен ли batch-процесс для пересчёта?

