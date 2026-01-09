# Описание процесса поиска оборудования

**Дата:** 30.12.2025  
**Версия:** 1.0

## 📋 Обзор

Документ описывает полный процесс от получения сообщения пользователя до выполнения запроса к базе данных. Процесс состоит из трех основных этапов:

1. **Анализ сообщений пользователя** - преобразование естественного языка в структурированный запрос
2. **Формирование параметров для поиска** - нормализация и валидация параметров
3. **Запрос к базе данных** - выполнение поиска по нормализованным параметрам

---

## 🔄 Полная схема процесса

```
Пользователь → Сообщение (текст)
    ↓
[1] InteractiveQueryBuilder → LLM
    ↓
    ├─ action: "ask" → Уточняющий вопрос пользователю
    └─ action: "final" → SearchQuery (структурированный запрос)
         ↓
[2] SearchQueryValidator (валидация и очистка)
    ↓
[3] CatalogService (нормализация запроса)
    ↓
[4] SearchEngine.search()
    ├─ QueryParameterNormalizer (нормализация параметров)
    │   ├─ ParameterDictionaryService (поиск canonical ключей)
    │   ├─ ParameterNormalizerService (нормализация значений)
    │   │   ├─ UnitParser (преобразование единиц измерения)
    │   │   └─ EnumMapper (маппинг enum значений)
    │   └─ Результат: normalizedQuery с canonical параметрами
    │
    ├─ Параллельный запуск стратегий поиска:
    │   ├─ FTS Search (PostgreSQL tsvector)
    │   └─ Vector Search (pgvector + LLM embeddings)
    │
    └─ RRF (Reciprocal Rank Fusion) - объединение результатов
         ↓
[5] EquipmentRepository
    ├─ fullTextSearch() → SQL запрос с normalized_parameters
    └─ vectorSearchWithEmbedding() → SQL запрос с фильтрами
         ↓
[6] PostgreSQL → Результаты поиска
```

---

## 1️⃣ Анализ сообщений пользователя

### Компонент: `InteractiveQueryBuilder`

**Файл:** `src/llm/interactive-query.builder.ts`

**Назначение:** Преобразует текст пользователя в структурированный `SearchQuery` через диалог с LLM.

### Процесс работы:

#### Шаг 1.1: Получение сообщения пользователя

```typescript
// src/telegram/index.ts:232
const step = await builder.next(text);
```

Пользователь отправляет текст, например:
- `"Мне нужен кран"`
- `"Нужен экскаватор Caterpillar с ковшом от 1 кубометра"`
- `"Покажи краны грузоподъемностью более 80 тонн в Москве"`

#### Шаг 1.2: Отправка в LLM

```74:283:src/llm/interactive-query.builder.ts
export interface InteractiveQueryBuilderOptions {

  maxTurns?: number;
  history?: ChatMessage[] | undefined;
}

export class InteractiveQueryBuilder {
  private readonly messages: ChatMessage[];
  private turns = 0;
  private readonly MAX_CONTEXT_MESSAGES = 20; // Макс. сообщений в истории (кроме system)

  constructor(
    private readonly provider: Pick<LLMProvider, "chat">,
    private readonly options: InteractiveQueryBuilderOptions,
  ) {
    if (this.options.history && this.options.history.length > 0) {
      this.messages = [...this.options.history];
    } else {
      this.messages = [
        {
          role: "system",
          content: `
Ты помощник по подбору промышленной техники.
Твоя задача — В ДИАЛОГЕ преобразовать запрос пользователя на русском языке в JSON-объект SearchQuery.

Ты всегда отвечаешь СТРОГО валидным JSON без комментариев и пояснений.
Формат ответа ТОЛЬКО один из:

1) {"action":"ask","question":"..."}
   Используй, если не хватает данных или есть неоднозначность (1 вопрос за шаг).
   ВАЖНО: Если пользователь назвал только категорию (например, "кран"), ОБЯЗАТЕЛЬНО спроси про параметры (грузоподъемность, бренд, регион).
   Не делай поиск по слишком широкому запросу, если это не явная просьба "показать всё".
   
   ЕСЛИ ПОЛЬЗОВАТЕЛЬ СПРАШИВАЕТ "ЧТО ТЫ УМЕЕШЬ?" ИЛИ "ЧТО ЕСТЬ В КАТАЛОГЕ?":
   Отвечай через action="ask" с перечислением основных категорий.
   Пример: {"action":"ask","question":"В нашем каталоге более 1000 единиц техники: автокраны, экскаваторы, бульдозеры, погрузчики и другое. Что именно вас интересует?"}

2) {"action":"final","query":{...}}
   Используй, когда достаточно данных (есть категория И хотя бы один параметр/бренд/регион) или пользователь просит искать "как есть".
   {
     "text"?: string;           // Текстовый запрос для семантического поиска
     "category"?: string;        // Категория техники (точное значение)
     "brand"?: string;           // Бренд/производитель (точное значение)
     "region"?: string;          // Регион (точное значение)
     "parameters"?: Record<string, string | number>;  // Технические характеристики
     "limit"?: number;           // Количество результатов (по умолчанию 10)
   }

ВАЖНО! Разница между полями:
- "text" — используется для ВЕКТОРНОГО (семантического) поиска. Сюда помещай общее описание запроса.
  Пример: "экскаватор для земляных работ", "гусеничный кран", "погрузчик фронтальный"
  
- "category", "brand", "region" — используются для ТОЧНОЙ фильтрации в БД.
  Помещай сюда ТОЛЬКО если пользователь явно указал категорию/бренд.
  Примеры категорий: "Экскаватор", "Кран", "Погрузчик", "Бульдозер", "Спецтехника"
  Примеры брендов: "Caterpillar", "Komatsu", "Hitachi", "JCB", "Volvo"
  
- Поле "subcategory" НЕ используй — оно исключено из поиска.
  Если пользователь говорит "колесный/гусеничный/мини" и т.п., включай это в "text"
  и/или в "parameters" (если это числовой фильтр).
  
- "parameters" — технические характеристики для фильтрации (JSONB поле в БД).
  Используй РУССКИЕ названия параметров: "грузоподъемность", "мощность", "вес", "объем_ковша" и т.д.

Правила формирования parameters:
- Для диапазонов "более/больше/от X" используй суффикс "_min": {"грузоподъемность_min": 80}
- Для диапазонов "менее/меньше/до X" используй суффикс "_max": {"тоннаж_max": 25}
- Для точного значения: {"мощность": 150}
- Извлекай только те параметры, которые ЯВНО указал пользователь

СБРОС КОНТЕКСТА:
- Если пользователь резко меняет тему (например, искали краны, а теперь просит "покажи бульдозеры"),
  НЕ тяни старые фильтры (category, parameters) в новый запрос. Начни с чистого листа для новой темы.
- Если пользователь уточняет текущий запрос (например, "а есть подешевле?"),
  СОХРАНЯЙ предыдущие фильтры и добавляй новые условия.

Примеры хороших SearchQuery:

Запрос: "Нужен экскаватор Caterpillar с ковшом от 1 кубометра"
Ответ: {"action":"final","query":{"text":"экскаватор","category":"Экскаватор","brand":"Caterpillar","parameters":{"объем_ковша_min":1}}}

Запрос: "Покажи краны грузоподъемностью более 80 тонн в Москве"
Ответ: {"action":"final","query":{"text":"кран","category":"Кран","region":"Москва","parameters":{"грузоподъемность_min":80}}}

Запрос: "Мне нужен кран"
Ответ: {"action":"ask","question":"Какой тип крана вас интересует? Какая нужна грузоподъемность и в каком регионе?"}

Запрос: "Ищу технику для стройки"
Ответ: {"action":"ask","question":"Какой именно тип техники вас интересует? Например: экскаватор, кран, бульдозер, погрузчик?"}

Запрос: "Гусеничный бульдозер весом до 20 тонн"
Ответ: {"action":"final","query":{"text":"гусеничный бульдозер","category":"Бульдозер","parameters":{"вес_max":20}}}

ВАЖНО:
- Не придумывай значения категорий/брендов — используй ТОЛЬКО если пользователь явно указал
- Если пользователь указал "/done" или "хватит" — верни best-effort final
- Задавай уточняющие вопросы только если информации явно недостаточно
        `.trim(),
        },
      ];
    }
  }
```

LLM получает:
- Системный промпт с инструкциями
- Историю диалога (если есть)
- Текущее сообщение пользователя

#### Шаг 1.3: Обработка ответа LLM

```208:255:src/llm/interactive-query.builder.ts
  async next(userText: string): Promise<InteractiveQueryStep> {
    const text = userText.trim();
    if (!text) {
      throw new Error("Пустой ввод пользователя");
    }

    this.messages.push({ role: "user", content: text });
    this.turns += 1;

    const maxTurns = this.options.maxTurns ?? 6;
    if (this.turns > maxTurns) {
      // Просим LLM выдать best-effort финал, чтобы не зацикливаться.
      this.messages.push({
        role: "user",
        content: "Лимит уточнений достигнут. Сформируй best-effort final SearchQuery.",
      });
    }

    const chatOptions: ChatOptions = {
      model: this.options.model,
      messages: this.messages,
      temperature: 0.1,
    };

    const response = await this.provider.chat(chatOptions);
    const raw = response.message.content;

    if (process.env.DEBUG_SEARCH) {
      console.log('\n--- LLM Interaction Log ---');
      console.log('User Input:', text);
      console.log('LLM Raw Response:', raw);
      console.log('---------------------------\n');
    }

    const step = parseStepJson(raw);

    // Чтобы следующий ход учитывал вопрос ассистента, добавим его в историю.
    if (step.action === "ask") {
      this.messages.push({ role: "assistant", content: step.question });
    } else {
      this.messages.push({ role: "assistant", content: JSON.stringify({ action: "final" }) });
    }
    
    // Обрезаем историю после добавления ответа ассистента
    this.ensureContextLimit();

    return step;
  }
```

LLM возвращает один из вариантов:

**Вариант A: Уточняющий вопрос**
```json
{
  "action": "ask",
  "question": "Какой тип крана вас интересует? Какая нужна грузоподъемность?"
}
```

**Вариант B: Финальный запрос**
```json
{
  "action": "final",
  "query": {
    "text": "экскаватор",
    "category": "Экскаватор",
    "brand": "Caterpillar",
    "parameters": {
      "объем_ковша_min": 1
    }
  }
}
```

### Примеры работы:

| Вход пользователя | Ответ LLM |
|-------------------|-----------|
| `"Мне нужен кран"` | `{"action":"ask","question":"Какой тип крана? Какая грузоподъемность?"}` |
| `"Экскаватор Caterpillar с ковшом от 1 куба"` | `{"action":"final","query":{"text":"экскаватор","category":"Экскаватор","brand":"Caterpillar","parameters":{"объем_ковша_min":1}}}` |
| `"Краны более 80 тонн в Москве"` | `{"action":"final","query":{"text":"кран","category":"Кран","region":"Москва","parameters":{"грузоподъемность_min":80}}}` |

---

## 2️⃣ Формирование параметров для поиска

### Этап 2.1: Валидация SearchQuery

**Компонент:** `SearchQueryValidator`

**Файл:** `src/llm/search-query.validator.ts`

**Назначение:** Валидирует и очищает `SearchQuery` от LLM, защищает от SQL инъекций.

#### Процесс валидации:

```20:177:src/llm/search-query.validator.ts
  static validate(query: any): SearchQuery {
    if (!query || typeof query !== "object") {
      throw new Error("SearchQuery должен быть объектом");
    }

    const validated: SearchQuery = {};
    const issues: string[] = [];

    // Валидация text
    if (query.text !== undefined) {
      if (typeof query.text === "string") {
        const trimmed = query.text.trim();
        if (trimmed.length > 0 && trimmed.length <= 500) {
          validated.text = trimmed;
        } else if (trimmed.length > 500) {
          validated.text = trimmed.substring(0, 500);
          issues.push(`text обрезан до 500 символов`);
        }
      } else {
        issues.push(`text должен быть строкой, получено: ${typeof query.text}`);
      }
    }

    // Валидация category
    if (query.category !== undefined) {
      if (typeof query.category === "string") {
        const trimmed = query.category.trim();
        if (trimmed.length > 0 && trimmed.length <= 100) {
          validated.category = trimmed;
        } else if (trimmed.length > 100) {
          validated.category = trimmed.substring(0, 100);
          issues.push(`category обрезан до 100 символов`);
        }
      } else {
        issues.push(`category должен быть строкой, получено: ${typeof query.category}`);
      }
    }

    // Валидация subcategory
    if (query.subcategory !== undefined) {
      if (typeof query.subcategory === "string") {
        const trimmed = query.subcategory.trim();
        if (trimmed.length > 0 && trimmed.length <= 100) {
          validated.subcategory = trimmed;
        } else if (trimmed.length > 100) {
          validated.subcategory = trimmed.substring(0, 100);
          issues.push(`subcategory обрезан до 100 символов`);
        }
      } else {
        issues.push(`subcategory должен быть строкой, получено: ${typeof query.subcategory}`);
      }
    }

    // Валидация brand
    if (query.brand !== undefined) {
      if (typeof query.brand === "string") {
        const trimmed = query.brand.trim();
        if (trimmed.length > 0 && trimmed.length <= 100) {
          validated.brand = trimmed;
        } else if (trimmed.length > 100) {
          validated.brand = trimmed.substring(0, 100);
          issues.push(`brand обрезан до 100 символов`);
        }
      } else {
        issues.push(`brand должен быть строкой, получено: ${typeof query.brand}`);
      }
    }

    // Валидация region
    if (query.region !== undefined) {
      if (typeof query.region === "string") {
        const trimmed = query.region.trim();
        if (trimmed.length > 0 && trimmed.length <= 100) {
          validated.region = trimmed;
        } else if (trimmed.length > 100) {
          validated.region = trimmed.substring(0, 100);
          issues.push(`region обрезан до 100 символов`);
        }
      } else {
        issues.push(`region должен быть строкой, получено: ${typeof query.region}`);
      }
    }

    // Валидация limit
    if (query.limit !== undefined) {
      if (typeof query.limit === "number") {
        const limitNum = Math.floor(query.limit);
        validated.limit = Math.min(Math.max(limitNum, 1), 100);
        if (limitNum !== query.limit || limitNum < 1 || limitNum > 100) {
          issues.push(`limit нормализован: ${query.limit} → ${validated.limit}`);
        }
      } else if (typeof query.limit === "string") {
        const limitNum = parseInt(query.limit, 10);
        if (!isNaN(limitNum)) {
          validated.limit = Math.min(Math.max(limitNum, 1), 100);
          issues.push(`limit преобразован из строки: "${query.limit}" → ${validated.limit}`);
        } else {
          issues.push(`limit не является числом: "${query.limit}" (игнорирован)`);
        }
      } else {
        issues.push(`limit должен быть числом, получено: ${typeof query.limit}`);
      }
    }

    // Валидация parameters
    if (query.parameters !== undefined) {
      if (typeof query.parameters === "object" && !Array.isArray(query.parameters)) {
        validated.parameters = {};
        
        for (const [key, value] of Object.entries(query.parameters)) {
          // Проверяем имя параметра
          if (!this.isValidParameterKey(key)) {
            issues.push(`Некорректное имя параметра: "${key}" (пропущено)`);
            continue;
          }

          // Проверяем значение параметра
          if (typeof value === "number") {
            if (Number.isFinite(value)) {
              validated.parameters[key] = value;
            } else {
              issues.push(`Параметр "${key}" имеет некорректное числовое значение: ${value}`);
            }
          } else if (typeof value === "string") {
            const trimmed = (value as string).trim();
            if (trimmed.length > 0 && trimmed.length <= 200) {
              validated.parameters[key] = trimmed;
            } else if (trimmed.length > 200) {
              validated.parameters[key] = trimmed.substring(0, 200);
              issues.push(`Значение параметра "${key}" обрезано до 200 символов`);
            }
          } else {
            issues.push(`Параметр "${key}" имеет некорректный тип: ${typeof value} (пропущено)`);
          }
        }

        // Если нет валидных параметров, удаляем поле
        if (Object.keys(validated.parameters).length === 0) {
          delete validated.parameters;
        }
      } else {
        issues.push(`parameters должен быть объектом, получено: ${typeof query.parameters}`);
      }
    }

    // Логируем проблемы, если есть
    if (issues.length > 0) {
      console.warn(`[SearchQueryValidator] Обнаружены проблемы при валидации:`);
      issues.forEach(issue => console.warn(`  - ${issue}`));
    }

    // Если после валидации не осталось ни одного поля, это ошибка
    if (Object.keys(validated).length === 0) {
      throw new Error("SearchQuery не содержит валидных полей после валидации");
    }

    return validated;
  }
```

**Проверки:**
- ✅ Типы данных (text, category, brand, region, limit, parameters)
- ✅ Ограничение длины строк (text ≤ 500, category/brand/region ≤ 100)
- ✅ Нормализация limit (1-100, преобразование из строки)
- ✅ **Безопасность:** Валидация имен параметров (только буквы, цифры, подчеркивания)
- ✅ Блокировка SQL инъекций в ключах параметров

**Пример валидации:**
```typescript
// Входной запрос от LLM:
{
  limit: "много",
  parameters: { "'; DROP TABLE --": 123 }
}

// После валидации:
{
  limit: 10,  // нормализовано
  parameters: {}  // опасный ключ удален
}
```

### Этап 2.2: Нормализация параметров

**Компонент:** `QueryParameterNormalizer`

**Файл:** `src/normalization/query-parameter-normalizer.ts`

**Назначение:** Преобразует параметры из произвольного формата (русские названия) в canonical формат (snake_case ключи).

#### Процесс нормализации:

```64:154:src/normalization/query-parameter-normalizer.ts
  normalizeQuery(query: SearchQuery): QueryNormalizationResult {
    const normalizedQuery: SearchQuery = {
      ...query,
    };

    // Если параметров нет, возвращаем как есть
    if (!query.parameters || Object.keys(query.parameters).length === 0) {
      return {
        normalizedQuery,
        stats: {
          total: 0,
          normalized: 0,
          unresolved: 0,
          confidence: 1.0,
        },
      };
    }

    // Разделяем параметры на обычные и с суффиксами _min/_max
    const regularParams: Record<string, any> = {};
    const minParams: Record<string, any> = {};
    const maxParams: Record<string, any> = {};

    for (const [key, value] of Object.entries(query.parameters)) {
      if (key.endsWith("_min")) {
        const baseKey = key.replace("_min", "");
        minParams[baseKey] = value;
      } else if (key.endsWith("_max")) {
        const baseKey = key.replace("_max", "");
        maxParams[baseKey] = value;
      } else {
        regularParams[key] = value;
      }
    }

    // Нормализуем обычные параметры
    const regularResult = this.normalizer.normalize(regularParams);

    // Нормализуем параметры с _min
    const minResult = this.normalizer.normalize(minParams);

    // Нормализуем параметры с _max
    const maxResult = this.normalizer.normalize(maxParams);

    // Собираем нормализованные параметры
    const normalizedParameters: Record<string, string | number> = {};

    // Добавляем обычные параметры
    for (const [key, value] of Object.entries(regularResult.normalized)) {
      normalizedParameters[key] = value;
    }

    // Добавляем параметры с _min
    for (const [key, value] of Object.entries(minResult.normalized)) {
      normalizedParameters[`${key}_min`] = value;
    }

    // Добавляем параметры с _max
    for (const [key, value] of Object.entries(maxResult.normalized)) {
      normalizedParameters[`${key}_max`] = value;
    }

    // Обновляем запрос нормализованными параметрами
    normalizedQuery.parameters = normalizedParameters;

    // Подсчитываем статистику
    const total =
      Object.keys(regularParams).length +
      Object.keys(minParams).length +
      Object.keys(maxParams).length;

    const normalized =
      Object.keys(regularResult.normalized).length +
      Object.keys(minResult.normalized).length +
      Object.keys(maxResult.normalized).length;

    const unresolved =
      Object.keys(regularResult.unresolved).length +
      Object.keys(minResult.unresolved).length +
      Object.keys(maxResult.unresolved).length;

    return {
      normalizedQuery,
      stats: {
        total,
        normalized,
        unresolved,
        confidence: total > 0 ? normalized / total : 1.0,
      },
    };
  }
```

#### Детальная нормализация значений:

**Компонент:** `ParameterNormalizerService`

**Файл:** `src/normalization/parameter-normalizer.service.ts`

```26:100:src/normalization/parameter-normalizer.service.ts
  normalize(rawParams: Record<string, any>): NormalizationResult {
    const normalized: Record<string, any> = {};
    const unresolved: Record<string, any> = {};

    for (const [rawKey, rawValue] of Object.entries(rawParams)) {
      // Пропускаем null/undefined
      if (rawValue == null) continue;

      // Находим canonical key
      const paramDef = this.dictionaryService.findCanonicalKey(rawKey);
      if (!paramDef) {
        unresolved[rawKey] = rawValue;
        continue;
      }

      // Нормализуем значение в зависимости от типа
      let normalizedValue: any = null;

      if (paramDef.param_type === "number") {
        normalizedValue = this.unitParser.parseValue(rawValue, paramDef.unit || "");

        // Мягкая валидация диапазона (только предупреждение, не отбрасываем значение)
        if (normalizedValue != null && process.env.DEBUG) {
          if (paramDef.min_value != null && normalizedValue < paramDef.min_value) {
            console.warn(
              `[Normalization] Значение ${normalizedValue} ниже рекомендованного минимума ${paramDef.min_value} для ${paramDef.key} (единица: ${paramDef.unit})`
            );
          }
          if (paramDef.max_value != null && normalizedValue > paramDef.max_value) {
            console.warn(
              `[Normalization] Значение ${normalizedValue} выше рекомендованного максимума ${paramDef.max_value} для ${paramDef.key} (единица: ${paramDef.unit})`
            );
          }
        }
      } else if (paramDef.param_type === "enum") {
        normalizedValue = this.enumMapper.mapEnumValue(String(rawValue), paramDef);
      } else if (paramDef.param_type === "boolean") {
        const str = String(rawValue).toLowerCase();
        if (str === "true" || str === "1" || str === "да" || str === "yes") {
          normalizedValue = true;
        } else if (str === "false" || str === "0" || str === "нет" || str === "no") {
          normalizedValue = false;
        }
      } else if (paramDef.param_type === "string") {
        // Для строковых полей (например, "Шины", "Кабина") сохраняем как есть.
        // Важно: пустые строки считаем невалидными.
        if (typeof rawValue === "string") {
          const s = rawValue.trim();
          normalizedValue = s.length > 0 ? s : null;
        } else if (typeof rawValue === "number" || typeof rawValue === "boolean") {
          normalizedValue = String(rawValue);
        } else {
          // объекты/массивы
          const s = JSON.stringify(rawValue);
          normalizedValue = s && s !== "{}" && s !== "[]" ? s : null;
        }
      }

      if (normalizedValue != null) {
        normalized[paramDef.key] = normalizedValue;
      } else {
        unresolved[rawKey] = rawValue;
      }
    }

    const total = Object.keys(rawParams).length;
    const normalizedCount = Object.keys(normalized).length;
    const confidence = total > 0 ? normalizedCount / total : 0;

    return {
      normalized,
      unresolved,
      confidence,
    };
  }
```

**Процесс нормализации:**

1. **Поиск canonical ключа** через `ParameterDictionaryService`:
   - Ищет в справочнике `parameter_dictionary` по алиасам
   - Пример: `"Мощность"` → `"power_hp"` или `"power_kw"`

2. **Нормализация значения** в зависимости от типа:
   - **number**: Преобразование единиц измерения через `UnitParser`
     - `"132 л.с."` → `132` (если единица `hp`)
     - `"25 тонн"` → `25000` (если единица `kg`)
   - **enum**: Маппинг через `EnumMapper`
     - `"Дизельный"` → `"diesel"`
     - `"Гусеничный"` → `"crawler"`
   - **boolean**: Преобразование строк в boolean
     - `"да"` → `true`
     - `"нет"` → `false`

#### Пример нормализации:

**Входной запрос от LLM:**
```json
{
  "text": "экскаватор",
  "category": "Экскаватор",
  "brand": "Caterpillar",
  "parameters": {
    "Мощность": "132 л.с.",
    "Рабочий вес_max": "25000 кг",
    "Тип питания": "Дизельный"
  }
}
```

**После нормализации:**
```json
{
  "text": "экскаватор",
  "category": "Экскаватор",
  "brand": "Caterpillar",
  "parameters": {
    "power_hp": 132,
    "weight_kg_max": 25000,
    "fuel_type": "diesel"
  }
}
```

---

## 3️⃣ Запрос к базе данных на основе нормализованных параметров

### Этап 3.1: Построение SQL условий

**Компонент:** `QueryParameterNormalizer.buildSQLConditions()`

**Файл:** `src/normalization/query-parameter-normalizer.ts`

**Назначение:** Создает параметризованные SQL условия для WHERE.

```176:226:src/normalization/query-parameter-normalizer.ts
  buildSQLConditions(
    normalizedParameters: Record<string, string | number>,
    values: any[]
  ): string[] {
    const conditions: string[] = [];

    for (const [key, value] of Object.entries(normalizedParameters)) {
      // Обработка суффиксов _min и _max
      if (key.endsWith("_min")) {
        const paramKey = key.replace("_min", "");
        const numValue = typeof value === "string" ? parseFloat(value) : Number(value);
        if (!Number.isNaN(numValue)) {
          values.push(paramKey, numValue);
          const keyIndex = values.length - 1;
          const valueIndex = values.length;
          conditions.push(
            `(normalized_parameters->>$${keyIndex})::numeric >= $${valueIndex}`
          );
        }
      } else if (key.endsWith("_max")) {
        const paramKey = key.replace("_max", "");
        const numValue = typeof value === "string" ? parseFloat(value) : Number(value);
        if (!Number.isNaN(numValue)) {
          values.push(paramKey, numValue);
          const keyIndex = values.length - 1;
          const valueIndex = values.length;
          conditions.push(
            `(normalized_parameters->>$${keyIndex})::numeric <= $${valueIndex}`
          );
        }
      } else {
        // Точное совпадение
        values.push(key, value);
        const keyIndex = values.length - 1;
        const valueIndex = values.length;

        // Для чисел используем numeric сравнение, для строк - text
        if (typeof value === "number") {
          conditions.push(
            `(normalized_parameters->>$${keyIndex})::numeric = $${valueIndex}`
          );
        } else {
          conditions.push(
            `normalized_parameters->>$${keyIndex} = $${valueIndex}::text`
          );
        }
      }
    }

    return conditions;
  }
```

**Примеры SQL условий:**

| Параметр | SQL условие |
|----------|-------------|
| `power_hp: 132` | `(normalized_parameters->>$1)::numeric = $2` |
| `weight_kg_min: 20000` | `(normalized_parameters->>$1)::numeric >= $2` |
| `weight_kg_max: 25000` | `(normalized_parameters->>$1)::numeric <= $2` |
| `fuel_type: "diesel"` | `normalized_parameters->>$1 = $2::text` |

### Этап 3.2: Выполнение FTS поиска

**Компонент:** `EquipmentRepository.fullTextSearch()`

**Файл:** `src/repository/equipment.repository.ts`

**Назначение:** Выполняет полнотекстовый поиск с использованием нормализованных параметров.

```165:244:src/repository/equipment.repository.ts
  async fullTextSearch(query: SearchQuery, limit: number): Promise<EquipmentSummary[]> {
    const values: any[] = [];
    const whereParts: string[] = ["is_active = true"];
    let rankExpression = "0::float4";

    // Текстовый поиск через tsvector-колонку search_vector
    if (query.text && query.text.trim()) {
      values.push(query.text.trim());
      const placeholder = `$${values.length}`;
      whereParts.push(`search_vector @@ plainto_tsquery('russian', ${placeholder})`);
      rankExpression = `ts_rank(search_vector, plainto_tsquery('russian', ${placeholder}))`;
    }

    if (query.category && query.category.trim()) {
      // Раньше было строгое равенство, но LLM часто возвращает "Кран",
      // тогда как в БД категория может быть "Краны"/"Автокраны"/"Гусеничные краны".
      // Делаем мягкий матч по подстроке (case-insensitive).
      values.push(`%${query.category.trim()}%`);
      whereParts.push(`category ILIKE $${values.length}`);
    }
    if (query.brand && query.brand.trim()) {
      values.push(query.brand.trim());
      whereParts.push(`brand = $${values.length}`);
    }
    if (query.region && query.region.trim()) {
      values.push(query.region.trim());
      whereParts.push(`region = $${values.length}`);
    }

    // Обработка параметров из main_parameters (JSONB)
    if (query.parameters && Object.keys(query.parameters).length > 0) {
      for (const [key, value] of Object.entries(query.parameters)) {
        // Параметры УЖЕ нормализованы в SearchEngine
        // Просто строим SQL условие
        const condition = this.buildParameterCondition(key, value);
        if (!condition) continue;
        
        const { paramKey, value: conditionValue, operator, sqlCast } = condition;
        
        // Добавляем условие в WHERE с параметризацией
      values.push(paramKey, conditionValue);
        const keyIndex = values.length - 1;
        const valueIndex = values.length;
        
      // Используем normalized_parameters для быстрого поиска по canonical параметрам
        whereParts.push(
        `(normalized_parameters->>$${keyIndex})${sqlCast} ${operator} $${valueIndex}`
        );
      }
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    // Безопасное использование limit через параметр
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;

    const sql = `
      SELECT
        id::text AS id,
        name,
        category,
        brand,
        price,
        main_parameters AS "mainParameters"
      FROM equipment
      ${whereClause}
      ORDER BY ${rankExpression} DESC, name ASC
      LIMIT $${values.length + 1}
    `;

    if (process.env.DEBUG_SEARCH) {
      console.log('\n--- FTS SQL Log ---');
      console.log('Query:', sql.replace(/\s+/g, ' ').trim());
      console.log('Params:', values);
      console.log('-------------------\n');
    }

    const result = await pgPool.query(sql, [...values, safeLimit]);
    return result.rows;
  }
```

**Пример SQL запроса:**

Для запроса:
```json
{
  "text": "экскаватор",
  "category": "Экскаватор",
  "brand": "Caterpillar",
  "parameters": {
    "power_hp": 132,
    "weight_kg_max": 25000
  }
}
```

Генерируется SQL:
```sql
SELECT
  id::text AS id,
  name,
  category,
  brand,
  price,
  main_parameters AS "mainParameters"
FROM equipment
WHERE is_active = true
  AND search_vector @@ plainto_tsquery('russian', $1)
  AND category ILIKE $2
  AND brand = $3
  AND (normalized_parameters->>$4)::numeric = $5
  AND (normalized_parameters->>$6)::numeric <= $7
ORDER BY ts_rank(search_vector, plainto_tsquery('russian', $1)) DESC, name ASC
LIMIT $8
```

С параметрами:
```javascript
[
  "экскаватор",      // $1 - text
  "%Экскаватор%",    // $2 - category
  "Caterpillar",     // $3 - brand
  "power_hp",        // $4 - param key
  132,               // $5 - param value
  "weight_kg",       // $6 - param key
  25000,             // $7 - param value
  10                 // $8 - limit
]
```

### Этап 3.3: Гибридный поиск (FTS + Vector)

**Компонент:** `SearchEngine.search()`

**Файл:** `src/search/search.engine.ts`

**Назначение:** Координирует параллельный запуск FTS и Vector поиска, объединяет результаты через RRF.

```64:193:src/search/search.engine.ts
  async search(query: SearchQuery): Promise<CatalogSearchResult> {
    const limit = query.limit ?? 10;

    // 1. Нормализация параметров
    let normalizedQuery = query;
    if (this.queryNormalizer && query.parameters) {
      try {
        // Словарь уже загружен в конструкторе через initializeDictionary()
        // Если инициализация еще не завершена, ждем (это происходит только в первых запросах)
        if (!this.dictionaryInitialized && this.dictionaryService) {
          await this.dictionaryService.loadDictionary();
          this.dictionaryInitialized = true;
        }
        
        const result = this.queryNormalizer.normalizeQuery(query);
        normalizedQuery = result.normalizedQuery;
        
        if (process.env.DEBUG || process.env.DEBUG_SEARCH) {
          console.log('[SearchEngine] Normalized query params:', JSON.stringify(normalizedQuery, null, 2));
        }

        // Логируем, если есть проблемы, но не мешаем пользователю
        if (result.stats.unresolved > 0 && process.env.DEBUG) {
          console.warn(`[Search] Unresolved params: ${result.stats.unresolved}`);
        }
      } catch (error) {
        console.warn(`[Search] Normalization error: ${error}`);
      }
    }

    // 2. Параллельный запуск стратегий
    
    // Стратегия 1: FTS (Точное совпадение слов + Фильтры)
    const ftsPromise = this.equipmentRepository.fullTextSearch(normalizedQuery, limit);

    // Стратегия 2: Vector (Смысловое совпадение)
    let vectorPromise: Promise<EquipmentSummary[]> = Promise.resolve([]);
    let embeddingPromise: Promise<number[] | null> = Promise.resolve(null);
    
    // Векторный поиск включаем только если есть текст запроса и доступен LLM для эмбеддинга
    const vectorEnabled = process.env.ENABLE_VECTOR_SEARCH !== "false"; // По умолчанию включено

    if (vectorEnabled && normalizedQuery.text && normalizedQuery.text.trim().length > 0 && this.llmFactory) {
      // 2.1 Генерируем эмбеддинг один раз
      embeddingPromise = this.getEmbedding(normalizedQuery.text);
      
      // 2.2 Запускаем строгий поиск с фильтрами
      vectorPromise = embeddingPromise.then(vector => {
        if (!vector) return [];
        
        // Передаем фильтры в vector search (только если они заданы)
        const filters: any = {};
        if (normalizedQuery.category) filters.category = normalizedQuery.category;
        if (normalizedQuery.brand) filters.brand = normalizedQuery.brand;
        if (normalizedQuery.region) filters.region = normalizedQuery.region;
        if (normalizedQuery.parameters) filters.parameters = normalizedQuery.parameters;
        
        return this.equipmentRepository.vectorSearchWithEmbedding(normalizedQuery.text!, vector, limit, filters);
      });
    }

    // Используем Promise.all для ожидания результатов (FTS и Vector запускаются параллельно)
    const [ftsResult, vectorResult, embeddingResult] = await Promise.allSettled([
      ftsPromise, 
      vectorPromise,
      embeddingPromise
    ]);
    
    let ftsResults = ftsResult.status === 'fulfilled' ? ftsResult.value : [];
    let vectorResults = vectorResult.status === 'fulfilled' ? vectorResult.value : [];
    const queryEmbedding = embeddingResult.status === 'fulfilled' ? embeddingResult.value : null;

    // Логируем ошибки
    if (ftsResult.status === 'rejected') console.error('[Search] FTS search failed:', ftsResult.reason);
    if (vectorResult.status === 'rejected') console.warn('[Search] Vector search failed:', vectorResult.reason);

    // 2.3 RELAXED VECTOR SEARCH (FALLBACK)
    // Если результатов мало (< 3), и есть эмбеддинг, пробуем найти что-то "помягче".
    //
    // ВАЖНО: "relaxed" должен ослаблять только "мягкие" фильтры (категория/бренд),
    // но НЕ должен игнорировать технические ограничения (parameters) и/или регион,
    // иначе в выдачу попадут позиции, не соответствующие условиям пользователя.
    const hasFilters =
      normalizedQuery.category ||
      normalizedQuery.brand ||
      normalizedQuery.region ||
      normalizedQuery.parameters;
    let relaxedResults: EquipmentSummary[] = [];

    if (queryEmbedding && (ftsResults.length + vectorResults.length) < 3 && hasFilters) {
      if (process.env.DEBUG_SEARCH) {
        console.log('[Search] Low results with filters. Attempting relaxed vector search...');
      }
      try {
        // Ищем по смыслу, но сохраняем "жесткие" ограничения (parameters/region),
        // ослабляя только category/brand.
        const relaxedFilters: any = {};
        if (normalizedQuery.region) relaxedFilters.region = normalizedQuery.region;
        if (normalizedQuery.parameters) relaxedFilters.parameters = normalizedQuery.parameters;

        relaxedResults = await this.equipmentRepository.vectorSearchWithEmbedding(
            normalizedQuery.text!, 
            queryEmbedding, 
            limit,
            Object.keys(relaxedFilters).length > 0 ? relaxedFilters : undefined
        );
      } catch (e) {
        console.warn('[Search] Relaxed vector search failed:', e);
      }
    }

    // 3. Если ничего не найдено вообще - пробуем fallback (FTS без category)
    if (ftsResults.length === 0 && vectorResults.length === 0 && relaxedResults.length === 0) {
      return await this.handleNoResults(normalizedQuery, limit);
    }

    // 4. Гибридное слияние (RRF)
    const merged = this.hybridFusion(ftsResults, vectorResults, relaxedResults, limit);
    
    const strategies: string[] = [];
    if (ftsResults.length > 0) strategies.push("fts");
    if (vectorResults.length > 0) strategies.push("vector_strict");
    if (relaxedResults.length > 0) strategies.push("vector_relaxed");

    return {
      items: merged,
      total: merged.length,
      usedStrategy: strategies.length > 1 ? "mixed" : (strategies[0] as any || "fts"),
    };
  }
```

**Процесс:**

1. **Нормализация параметров** (если есть)
2. **Параллельный запуск:**
   - FTS поиск (PostgreSQL tsvector)
   - Vector поиск (pgvector + embeddings)
3. **Объединение результатов** через RRF (Reciprocal Rank Fusion)
4. **Fallback стратегии** если результатов мало

---

## 📊 Итоговая схема данных

### Входные данные (от пользователя):
```
"Нужен экскаватор Caterpillar с ковшом от 1 кубометра"
```

### После анализа LLM:
```json
{
  "action": "final",
  "query": {
    "text": "экскаватор",
    "category": "Экскаватор",
    "brand": "Caterpillar",
    "parameters": {
      "объем_ковша_min": 1
    }
  }
}
```

### После нормализации параметров:
```json
{
  "text": "экскаватор",
  "category": "Экскаватор",
  "brand": "Caterpillar",
  "parameters": {
    "bucket_volume_m3_min": 1
  }
}
```

### SQL запрос к БД:
```sql
SELECT id, name, category, brand, price, main_parameters
FROM equipment
WHERE is_active = true
  AND search_vector @@ plainto_tsquery('russian', 'экскаватор')
  AND category ILIKE '%Экскаватор%'
  AND brand = 'Caterpillar'
  AND (normalized_parameters->>'bucket_volume_m3')::numeric >= 1
ORDER BY ts_rank(...) DESC, name ASC
LIMIT 10
```

---

## 🔒 Безопасность

### Защита от SQL инъекций:

1. **Валидация имен параметров:**
   ```typescript
   // Разрешены только: буквы, цифры, подчеркивания
   /^[a-zA-Zа-яА-ЯёЁ0-9_]+$/
   ```

2. **Параметризованные запросы:**
   - Все значения передаются через параметры PostgreSQL
   - Имена ключей валидируются перед использованием

3. **Примеры блокируемых атак:**
   ```typescript
   // SQL инъекция
   { "'; DROP TABLE --": 123 } → удалено
   
   // Path traversal
   { "../../../etc/passwd": "value" } → удалено
   ```

---

## 📚 Связанные документы

- **Тест алгоритма:** `docs/35_MESSAGE_ANALYSIS_ALGORITHM_TEST.md`
- **Нормализация параметров:** `docs/39_NORMALIZATION_QUICK_START.md`
- **Сбор параметров:** `docs/36_PARAMETER_COLLECTION_AND_ANALYSIS.md`
- **Архитектура поиска:** `docs/19_DIALOG_AND_SEARCH_ANALYSIS.md`
