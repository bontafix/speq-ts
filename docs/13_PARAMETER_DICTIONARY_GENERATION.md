# Автоматизация создания справочника параметров

## Проблема

Ручное создание справочника `parameter_dictionary` для всех параметров оборудования может быть очень трудоёмким, особенно если:
- Много различных типов оборудования
- Параметры приходят из разных источников
- Названия параметров не стандартизированы

## Решения

### 1. Автоматическое извлечение из существующих данных

#### 1.1. Анализ всех уникальных ключей параметров

**SQL запрос для анализа**:
```sql
-- Найти все уникальные ключи из main_parameters
WITH param_keys AS (
  SELECT DISTINCT jsonb_object_keys(main_parameters) AS key
  FROM equipment
  WHERE main_parameters IS NOT NULL
    AND main_parameters != '{}'::jsonb
)
SELECT 
  key,
  COUNT(*) as frequency,
  -- Примеры значений для каждого ключа
  (
    SELECT jsonb_agg(DISTINCT value ORDER BY value)
    FROM (
      SELECT main_parameters->>key AS value
      FROM equipment
      WHERE main_parameters ? key
      LIMIT 10
    ) sub
  ) as sample_values
FROM param_keys
GROUP BY key
ORDER BY frequency DESC;
```

**Результат**:
```
key                  | frequency | sample_values
---------------------|-----------|----------------------------------
Мощность            | 150       | ["132 л.с.", "121 кВт", "97 кВт"]
Рабочий вес         | 120       | ["13500 кг", "20000 кг"]
Тип питания         | 100       | ["Дизельный", "дизель"]
...
```

#### 1.2. Скрипт для автоматического анализа

```typescript
// src/scripts/analyze-parameters.ts
import { pgPool } from '../db/pg';

interface ParameterAnalysis {
  key: string;
  frequency: number;
  sampleValues: any[];
  valueTypes: {
    number: number;
    string: number;
    boolean: number;
  };
  unitPatterns: string[];
  enumCandidates: string[];
}

export async function analyzeParameters(): Promise<ParameterAnalysis[]> {
  const sql = `
    WITH param_keys AS (
      SELECT DISTINCT jsonb_object_keys(main_parameters) AS key
      FROM equipment
      WHERE main_parameters IS NOT NULL
        AND main_parameters != '{}'::jsonb
    ),
    param_stats AS (
      SELECT 
        pk.key,
        COUNT(*) as frequency,
        jsonb_agg(DISTINCT e.main_parameters->>pk.key) FILTER (
          WHERE e.main_parameters->>pk.key IS NOT NULL
        ) as all_values
      FROM param_keys pk
      CROSS JOIN equipment e
      WHERE e.main_parameters ? pk.key
      GROUP BY pk.key
    )
    SELECT 
      key,
      frequency,
      all_values
    FROM param_stats
    ORDER BY frequency DESC;
  `;
  
  const result = await pgPool.query(sql);
  
  return result.rows.map(row => {
    const values = row.all_values || [];
    const analysis: ParameterAnalysis = {
      key: row.key,
      frequency: row.frequency,
      sampleValues: values.slice(0, 10),
      valueTypes: {
        number: 0,
        string: 0,
        boolean: 0,
      },
      unitPatterns: [],
      enumCandidates: [],
    };
    
    // Анализ типов значений
    for (const value of values) {
      if (typeof value === 'number') {
        analysis.valueTypes.number++;
      } else if (typeof value === 'boolean') {
        analysis.valueTypes.boolean++;
      } else if (typeof value === 'string') {
        analysis.valueTypes.string++;
        
        // Поиск единиц измерения
        const unitMatch = value.match(/(кг|т|л\.с\.|кВт|м|см|мм|т\/ч|м³)/i);
        if (unitMatch) {
          analysis.unitPatterns.push(unitMatch[0]);
        }
        
        // Кандидаты на enum (если уникальных значений мало)
        if (values.length <= 20) {
          analysis.enumCandidates.push(value);
        }
      }
    }
    
    return analysis;
  });
}

// Использование
async function main() {
  const analysis = await analyzeParameters();
  
  console.log('Найдено параметров:', analysis.length);
  console.log('\nТоп-20 наиболее частых:');
  analysis.slice(0, 20).forEach(param => {
    console.log(`\n${param.key} (${param.frequency} раз)`);
    console.log('  Типы:', param.valueTypes);
    console.log('  Примеры:', param.sampleValues.slice(0, 5));
    if (param.unitPatterns.length > 0) {
      console.log('  Единицы:', [...new Set(param.unitPatterns)]);
    }
    if (param.enumCandidates.length > 0) {
      console.log('  Enum кандидаты:', param.enumCandidates.slice(0, 10));
    }
  });
  
  // Сохранить в JSON для дальнейшей обработки
  const fs = require('fs');
  fs.writeFileSync(
    'parameter-analysis.json',
    JSON.stringify(analysis, null, 2)
  );
}

void main();
```

### 2. LLM для автоматического создания справочника

#### 2.1. Анализ параметров через LLM

```typescript
// src/scripts/generate-dictionary-with-llm.ts
import { LLMProviderFactory } from '../llm';

interface ParameterCandidate {
  key: string;
  sampleValues: string[];
  frequency: number;
}

export class DictionaryGenerator {
  constructor(private llmProvider: any) {}
  
  /**
   * Генерирует запись справочника для параметра через LLM
   */
  async generateDictionaryEntry(
    candidate: ParameterCandidate
  ): Promise<any> {
    const prompt = `
Проанализируй следующий параметр оборудования и создай запись для справочника parameter_dictionary.

Параметр: ${candidate.key}
Частота использования: ${candidate.frequency}
Примеры значений: ${JSON.stringify(candidate.sampleValues.slice(0, 20))}

Создай JSON объект со следующей структурой:
{
  "key": "canonical_key",           // стандартный ключ (латиница, snake_case)
  "label_ru": "Название на русском",
  "description_ru": "Описание параметра",
  "category": "weight|power|dimensions|performance|fuel|drive|environment|capacity|other",
  "param_type": "number|enum|boolean",
  "unit": "кг|л.с.|кВт|м|см|мм|т/ч|м³",  // только для number
  "min_value": 0,                    // только для number
  "max_value": 1000000,              // только для number
  "enum_values": {                    // только для enum
    "value1": "описание1",
    "value2": "описание2"
  },
  "aliases": ["алиас1", "алиас2"],
  "priority": 0                       // 0 = самый важный
}

Инструкции:
1. Определи тип параметра (number/enum/boolean)
2. Для number: определи единицу измерения и диапазон значений
3. Для enum: создай canonical значения (латиница, lowercase)
4. Создай алиасы на основе исходного ключа и примеров значений
5. Определи категорию параметра
6. Приоритет: 0 для критичных (масса, мощность), 1-2 для остальных

Верни ТОЛЬКО валидный JSON без комментариев.
`.trim();
    
    const response = await this.llmProvider.chat({
      model: process.env.LLM_MODEL || 'qwen2.5:7b-instruct-q4_K_M',
      messages: [
        {
          role: 'system',
          content: 'Ты помощник по созданию справочника параметров оборудования. Отвечай ТОЛЬКО валидным JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
    });
    
    try {
      const jsonMatch = response.message.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error(`Failed to parse LLM response for ${candidate.key}:`, error);
      return null;
    }
  }
  
  /**
   * Генерирует весь справочник из анализа параметров
   */
  async generateDictionary(
    analysis: ParameterAnalysis[]
  ): Promise<any[]> {
    const dictionary: any[] = [];
    
    // Обрабатываем только топ-N параметров (например, топ-50)
    const topParams = analysis
      .filter(p => p.frequency >= 5) // минимум 5 использований
      .slice(0, 50);
    
    console.log(`Генерация справочника для ${topParams.length} параметров...`);
    
    for (const param of topParams) {
      console.log(`Обработка: ${param.key}...`);
      
      const entry = await this.generateDictionaryEntry({
        key: param.key,
        sampleValues: param.sampleValues,
        frequency: param.frequency,
      });
      
      if (entry) {
        dictionary.push(entry);
        console.log(`✓ Создана запись: ${entry.key}`);
      } else {
        console.log(`✗ Не удалось создать запись для: ${param.key}`);
      }
      
      // Небольшая задержка, чтобы не перегружать LLM
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return dictionary;
  }
}
```

#### 2.2. Валидация и сохранение

```typescript
// src/scripts/save-dictionary.ts
import { pgPool } from '../db/pg';

export async function saveDictionary(dictionary: any[]): Promise<void> {
  const client = await pgPool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const entry of dictionary) {
      // Валидация обязательных полей
      if (!entry.key || !entry.label_ru || !entry.param_type) {
        console.warn(`Пропущена запись без обязательных полей:`, entry);
        continue;
      }
      
      // Проверка, существует ли уже запись
      const exists = await client.query(
        'SELECT key FROM parameter_dictionary WHERE key = $1',
        [entry.key]
      );
      
      if (exists.rows.length > 0) {
        // Обновляем существующую запись
        await client.query(`
          UPDATE parameter_dictionary
          SET 
            label_ru = $2,
            description_ru = $3,
            category = $4,
            param_type = $5,
            unit = $6,
            min_value = $7,
            max_value = $8,
            enum_values = $9,
            aliases = $10,
            priority = $11,
            updated_at = NOW()
          WHERE key = $1
        `, [
          entry.key,
          entry.label_ru,
          entry.description_ru || null,
          entry.category,
          entry.param_type,
          entry.unit || null,
          entry.min_value || null,
          entry.max_value || null,
          entry.enum_values ? JSON.stringify(entry.enum_values) : null,
          JSON.stringify(entry.aliases || []),
          entry.priority || 0,
        ]);
        console.log(`Обновлена запись: ${entry.key}`);
      } else {
        // Создаём новую запись
        await client.query(`
          INSERT INTO parameter_dictionary (
            key, label_ru, description_ru, category, param_type,
            unit, min_value, max_value, enum_values, aliases, priority
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          entry.key,
          entry.label_ru,
          entry.description_ru || null,
          entry.category,
          entry.param_type,
          entry.unit || null,
          entry.min_value || null,
          entry.max_value || null,
          entry.enum_values ? JSON.stringify(entry.enum_values) : null,
          JSON.stringify(entry.aliases || []),
          entry.priority || 0,
        ]);
        console.log(`Создана запись: ${entry.key}`);
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n✓ Справочник сохранён: ${dictionary.length} записей`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### 3. Готовые справочники и стандарты

#### 3.1. Отраслевые стандарты

**Для спецтехники**:
- ISO 6165 (Earth-moving machinery)
- ГОСТ 27555-87 (Строительные машины)
- ГОСТ 30772-2001 (Классификация и терминология)

**Проблема**: Эти стандарты определяют терминологию, но не структуру JSON параметров.

#### 3.2. Открытые датасеты

**Где искать**:
1. **Kaggle** - датасеты по спецтехнике, строительному оборудованию
2. **GitHub** - открытые проекты каталогов оборудования
3. **Open Data порталы** - государственные и коммерческие каталоги

**Пример поиска**:
```bash
# Поиск на GitHub
# "construction equipment" "specifications" "json"
# "heavy machinery" "catalog" "parameters"
```

#### 3.3. Парсинг публичных каталогов

```typescript
// src/scripts/parse-public-catalogs.ts
// Пример: парсинг публичного каталога (если есть API или веб-страницы)

export async function parsePublicCatalog(url: string): Promise<any[]> {
  // Здесь может быть:
  // - Парсинг HTML страниц
  // - Вызов публичного API
  // - Парсинг CSV/JSON файлов
  
  // Пример структуры результата:
  return [
    {
      source: 'public-catalog-1',
      parameters: {
        'weight_kg': 20000,
        'power_hp': 132,
        'fuel_type': 'diesel',
      }
    }
  ];
}
```

### 4. Гибридный подход (рекомендуемый)

#### 4.1. Пошаговый процесс

```
1. Анализ существующих данных
   ↓
2. Извлечение топ-N параметров (SQL)
   ↓
3. LLM генерация справочника для топ-N
   ↓
4. Ручная проверка и корректировка критичных параметров
   ↓
5. Сохранение в БД
   ↓
6. Итеративное улучшение на основе использования
```

#### 4.2. Полный скрипт

```typescript
// src/scripts/generate-dictionary.ts
import { analyzeParameters } from './analyze-parameters';
import { DictionaryGenerator } from './generate-dictionary-with-llm';
import { saveDictionary } from './save-dictionary';
import { LLMProviderFactory } from '../llm';

async function main() {
  console.log('Шаг 1: Анализ существующих параметров...');
  const analysis = await analyzeParameters();
  console.log(`Найдено ${analysis.length} уникальных параметров`);
  
  console.log('\nШаг 2: Генерация справочника через LLM...');
  const llmFactory = new LLMProviderFactory();
  const llmProvider = llmFactory.createChatProvider();
  const generator = new DictionaryGenerator(llmProvider);
  
  const dictionary = await generator.generateDictionary(analysis);
  console.log(`Сгенерировано ${dictionary.length} записей`);
  
  console.log('\nШаг 3: Сохранение в БД...');
  await saveDictionary(dictionary);
  
  console.log('\n✓ Готово! Справочник создан.');
  console.log('\nСледующие шаги:');
  console.log('1. Проверьте критичные параметры вручную');
  console.log('2. Запустите нормализацию: npm run normalize:parameters');
  console.log('3. Проверьте результаты нормализации');
}

void main();
```

### 5. Инкрементальное обновление справочника

#### 5.1. Автоматическое обнаружение новых параметров

```sql
-- Найти параметры, которых нет в справочнике
WITH all_keys AS (
  SELECT DISTINCT jsonb_object_keys(main_parameters) AS key
  FROM equipment
  WHERE main_parameters IS NOT NULL
),
dictionary_keys AS (
  SELECT key FROM parameter_dictionary
)
SELECT 
  ak.key,
  COUNT(*) as frequency
FROM all_keys ak
LEFT JOIN dictionary_keys dk ON ak.key = dk.key
WHERE dk.key IS NULL
GROUP BY ak.key
ORDER BY frequency DESC;
```

#### 5.2. Периодическое обновление

```typescript
// src/scripts/update-dictionary.ts
export async function updateDictionary(): Promise<void> {
  // 1. Найти новые параметры
  const newParams = await findNewParameters();
  
  if (newParams.length === 0) {
    console.log('Новых параметров не найдено');
    return;
  }
  
  console.log(`Найдено ${newParams.length} новых параметров`);
  
  // 2. Сгенерировать записи через LLM
  const generator = new DictionaryGenerator(llmProvider);
  const newEntries = await generator.generateDictionary(newParams);
  
  // 3. Сохранить
  await saveDictionary(newEntries);
  
  console.log('Справочник обновлён');
}
```

### 6. Рекомендации

#### Для начала (MVP):

1. **Анализ существующих данных** (SQL)
   - Найти топ-20 наиболее частых параметров
   - Проанализировать их структуру

2. **Ручное создание критичных параметров** (5-10 записей)
   - Масса, мощность, тип питания
   - Это займёт 1-2 часа, но даст качественную основу

3. **LLM генерация для остальных**
   - Использовать LLM для генерации записей для топ-50 параметров
   - Ручная проверка и корректировка

#### Для масштабирования:

1. **Автоматический анализ** при добавлении новых данных
2. **LLM генерация** для новых параметров
3. **Периодическое обновление** справочника

### 7. Примеры готовых структур

#### Для экскаваторов:
```json
{
  "weight_kg": { "category": "weight", "unit": "кг" },
  "power_hp": { "category": "power", "unit": "л.с." },
  "dig_depth_m": { "category": "dimensions", "unit": "м" },
  "bucket_volume_m3": { "category": "capacity", "unit": "м³" },
  "drive_type": { "category": "drive", "type": "enum" }
}
```

#### Для погрузчиков:
```json
{
  "weight_kg": { "category": "weight", "unit": "кг" },
  "load_capacity_kg": { "category": "capacity", "unit": "кг" },
  "lift_height_m": { "category": "dimensions", "unit": "м" },
  "fuel_type": { "category": "fuel", "type": "enum" }
}
```

## Итог

**Рекомендуемый подход**:
1. ✅ Анализ существующих данных (SQL)
2. ✅ Ручное создание 5-10 критичных параметров
3. ✅ LLM генерация для остальных (топ-50)
4. ✅ Автоматическое обнаружение новых параметров
5. ✅ Инкрементальное обновление

**Преимущества**:
- Быстрый старт (анализ + ручные записи)
- Масштабируемость (LLM для остальных)
- Качество (ручная проверка критичных)
- Автоматизация (обновление справочника)

