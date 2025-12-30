# Автоматизация нормализации параметров

## Обзор подходов

Автоматизация преобразования `main_parameters` → `normalized_parameters` может быть реализована несколькими способами:

1. **Rule-based** (правила, regex, словари) - 80% случаев
2. **LLM-based** (использование LLM для сложных случаев) - 15% случаев
3. **Гибридный подход** (rule-based + LLM fallback) - 5% случаев
4. **Машинное обучение** (для будущего, опционально)

---

## 1. Rule-Based Нормализация (основной метод)

### Принцип работы

Использование правил, словарей и регулярных выражений для преобразования исходных данных.

**Преимущества**:
- ✅ Быстро (нет вызовов LLM)
- ✅ Детерминированно (одинаковый результат)
- ✅ Бесплатно (нет затрат на API)
- ✅ Надёжно (нет галлюцинаций)

**Недостатки**:
- ❌ Требует настройки правил
- ❌ Не справляется с нестандартными форматами

### Архитектура

```
main_parameters (raw)
    ↓
ParameterNormalizerService
    ├─ AliasMatcher (поиск по алиасам)
    ├─ UnitParser (парсинг единиц измерения)
    ├─ ValueExtractor (извлечение чисел)
    └─ EnumMapper (маппинг enum значений)
    ↓
normalized_parameters (canonical)
```

### Реализация

#### 1.1. AliasMatcher - поиск параметра по алиасам

```typescript
class AliasMatcher {
  constructor(private dictionary: ParameterDictionary[]) {}

  /**
   * Находит canonical key по алиасу из исходных данных
   */
  findCanonicalKey(rawKey: string): string | null {
    const normalizedKey = rawKey.toLowerCase().trim();
    
    for (const param of this.dictionary) {
      // Проверяем точное совпадение
      if (param.key === normalizedKey) {
        return param.key;
      }
      
      // Проверяем алиасы
      if (param.aliases.some(alias => 
        alias.toLowerCase() === normalizedKey ||
        normalizedKey.includes(alias.toLowerCase())
      )) {
        return param.key;
      }
    }
    
    return null;
  }
}
```

**Пример использования**:
```typescript
const matcher = new AliasMatcher(dictionary);
const canonicalKey = matcher.findCanonicalKey("Мощность");
// → "power_hp" или "power_kw"
```

#### 1.2. UnitParser - парсинг единиц измерения

```typescript
class UnitParser {
  /**
   * Парсит значение с единицами измерения
   */
  parseValue(rawValue: string | number, targetUnit: string): number | null {
    if (typeof rawValue === 'number') {
      return rawValue;
    }
    
    const str = String(rawValue).trim();
    
    // Извлекаем число
    const numberMatch = str.match(/[\d.,]+/);
    if (!numberMatch) return null;
    
    const numValue = parseFloat(numberMatch[0].replace(',', '.'));
    if (isNaN(numValue)) return null;
    
    // Определяем единицу из исходного значения
    const sourceUnit = this.detectUnit(str);
    
    // Конвертируем в целевую единицу
    return this.convertUnit(numValue, sourceUnit, targetUnit);
  }
  
  private detectUnit(str: string): string {
    const lower = str.toLowerCase();
    
    // Масса
    if (lower.includes('т') || lower.includes('тонн')) return 't';
    if (lower.includes('кг') || lower.includes('kg')) return 'kg';
    
    // Мощность
    if (lower.includes('л.с.') || lower.includes('hp')) return 'hp';
    if (lower.includes('квт') || lower.includes('kw')) return 'kw';
    
    // Длина
    if (lower.includes('м') && !lower.includes('мм') && !lower.includes('см')) return 'm';
    if (lower.includes('см') || lower.includes('cm')) return 'cm';
    if (lower.includes('мм') || lower.includes('mm')) return 'mm';
    
    return 'unknown';
  }
  
  private convertUnit(value: number, from: string, to: string): number {
    const conversions: Record<string, Record<string, number>> = {
      't': { 'kg': 1000 },
      'kg': { 't': 0.001 },
      'hp': { 'kw': 0.736 },
      'kw': { 'hp': 1.36 },
      'cm': { 'm': 0.01, 'mm': 10 },
      'mm': { 'm': 0.001, 'cm': 0.1 },
      'm': { 'cm': 100, 'mm': 1000 },
    };
    
    if (from === to) return value;
    if (conversions[from]?.[to]) {
      return value * conversions[from][to];
    }
    
    return value; // Если конверсия неизвестна, возвращаем как есть
  }
}
```

**Пример использования**:
```typescript
const parser = new UnitParser();
const weight = parser.parseValue("20 тонн", "kg");
// → 20000

const power = parser.parseValue("132 л.с.", "hp");
// → 132
```

#### 1.3. EnumMapper - маппинг enum значений

```typescript
class EnumMapper {
  /**
   * Преобразует исходное enum значение в canonical
   */
  mapEnumValue(rawValue: string, paramDef: ParameterDictionary): string | null {
    if (paramDef.param_type !== 'enum') return null;
    if (!paramDef.enum_values) return null;
    
    const normalized = rawValue.toLowerCase().trim();
    
    // Прямое совпадение
    if (paramDef.enum_values[normalized]) {
      return normalized;
    }
    
    // Поиск по значениям в enum_values
    for (const [canonical, label] of Object.entries(paramDef.enum_values)) {
      if (label.toLowerCase() === normalized ||
          normalized.includes(label.toLowerCase()) ||
          label.toLowerCase().includes(normalized)) {
        return canonical;
      }
    }
    
    return null;
  }
}
```

**Пример использования**:
```typescript
const mapper = new EnumMapper();
const fuelType = mapper.mapEnumValue("Дизельный", fuelTypeParam);
// → "diesel"
```

#### 1.4. ParameterNormalizerService (основной сервис)

```typescript
import { ParameterDictionary } from './parameter-dictionary.types';
import { AliasMatcher } from './alias-matcher';
import { UnitParser } from './unit-parser';
import { EnumMapper } from './enum-mapper';

export class ParameterNormalizerService {
  private aliasMatcher: AliasMatcher;
  private unitParser: UnitParser;
  private enumMapper: EnumMapper;
  
  constructor(private dictionary: ParameterDictionary[]) {
    this.aliasMatcher = new AliasMatcher(dictionary);
    this.unitParser = new UnitParser();
    this.enumMapper = new EnumMapper();
  }
  
  /**
   * Нормализует raw параметры в canonical
   */
  normalize(rawParams: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};
    const unresolved: Record<string, any> = {};
    
    for (const [rawKey, rawValue] of Object.entries(rawParams)) {
      // Пропускаем null/undefined
      if (rawValue == null) continue;
      
      // Находим canonical key
      const canonicalKey = this.aliasMatcher.findCanonicalKey(rawKey);
      if (!canonicalKey) {
        unresolved[rawKey] = rawValue;
        continue;
      }
      
      const paramDef = this.dictionary.find(p => p.key === canonicalKey);
      if (!paramDef) {
        unresolved[rawKey] = rawValue;
        continue;
      }
      
      // Нормализуем значение в зависимости от типа
      let normalizedValue: any = null;
      
      if (paramDef.param_type === 'number') {
        normalizedValue = this.unitParser.parseValue(rawValue, paramDef.unit || '');
        
        // Валидация диапазона
        if (normalizedValue != null) {
          if (paramDef.min_value != null && normalizedValue < paramDef.min_value) {
            console.warn(`Value ${normalizedValue} below min ${paramDef.min_value} for ${canonicalKey}`);
            continue;
          }
          if (paramDef.max_value != null && normalizedValue > paramDef.max_value) {
            console.warn(`Value ${normalizedValue} above max ${paramDef.max_value} for ${canonicalKey}`);
            continue;
          }
        }
      } else if (paramDef.param_type === 'enum') {
        normalizedValue = this.enumMapper.mapEnumValue(String(rawValue), paramDef);
      }
      
      if (normalizedValue != null) {
        normalized[canonicalKey] = normalizedValue;
      } else {
        unresolved[rawKey] = rawValue;
      }
    }
    
    return normalized;
  }
  
  /**
   * Получить статистику нормализации
   */
  getNormalizationStats(rawParams: Record<string, any>): {
    total: number;
    normalized: number;
    unresolved: number;
    confidence: number;
  } {
    const normalized = this.normalize(rawParams);
    const total = Object.keys(rawParams).length;
    const normalizedCount = Object.keys(normalized).length;
    const unresolvedCount = total - normalizedCount;
    
    return {
      total,
      normalized: normalizedCount,
      unresolved: unresolvedCount,
      confidence: normalizedCount / total,
    };
  }
}
```

**Пример использования**:
```typescript
const normalizer = new ParameterNormalizerService(dictionary);

const rawParams = {
  "Мощность": "132 л.с.",
  "Рабочий вес": "13500 кг",
  "Тип питания": "Дизельный"
};

const normalized = normalizer.normalize(rawParams);
// → {
//   power_hp: 132,
//   weight_kg: 13500,
//   fuel_type: "diesel"
// }

const stats = normalizer.getNormalizationStats(rawParams);
// → { total: 3, normalized: 3, unresolved: 0, confidence: 1.0 }
```

---

## 2. LLM-Based Нормализация (fallback для сложных случаев)

### Когда использовать LLM

- ✅ Нестандартные форматы данных
- ✅ Сложные текстовые описания
- ✅ Неоднозначные единицы измерения
- ✅ Новые параметры, которых нет в справочнике

### Принцип работы

LLM получает:
- Исходные параметры
- Схему справочника (JSON Schema)
- Задачу: преобразовать в canonical формат

### Реализация

```typescript
import { LLMProvider } from '../llm';

export class LLMNormalizer {
  constructor(
    private llmProvider: LLMProvider,
    private dictionary: ParameterDictionary[]
  ) {}
  
  /**
   * Нормализует параметры через LLM
   */
  async normalizeWithLLM(
    rawParams: Record<string, any>,
    unresolvedParams: Record<string, any>
  ): Promise<Record<string, any>> {
    // Формируем JSON Schema из справочника
    const schema = this.buildJSONSchema();
    
    // Формируем промпт
    const prompt = this.buildPrompt(rawParams, unresolvedParams, schema);
    
    // Вызываем LLM
    const response = await this.llmProvider.chat({
      model: process.env.LLM_MODEL || 'qwen2.5:7b-instruct-q4_K_M',
      messages: [
        {
          role: 'system',
          content: `Ты помощник по нормализации параметров оборудования.
Твоя задача - преобразовать исходные параметры в canonical формат согласно JSON Schema.
Отвечай ТОЛЬКО валидным JSON без комментариев.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
    });
    
    // Парсим ответ
    try {
      const result = JSON.parse(response.message.content);
      return this.validateAndClean(result);
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      return {};
    }
  }
  
  private buildJSONSchema(): object {
    const properties: Record<string, any> = {};
    
    for (const param of this.dictionary) {
      if (param.param_type === 'number') {
        properties[param.key] = {
          type: 'number',
          minimum: param.min_value,
          maximum: param.max_value,
          description: `${param.label_ru} (${param.unit})`,
        };
      } else if (param.param_type === 'enum') {
        properties[param.key] = {
          type: 'string',
          enum: Object.keys(param.enum_values || {}),
          description: `${param.label_ru}: ${Object.values(param.enum_values || {}).join(', ')}`,
        };
      }
    }
    
    return {
      type: 'object',
      properties,
      additionalProperties: false,
    };
  }
  
  private buildPrompt(
    rawParams: Record<string, any>,
    unresolvedParams: Record<string, any>,
    schema: object
  ): string {
    return `
Преобразуй следующие параметры оборудования в canonical формат.

Исходные параметры:
${JSON.stringify(rawParams, null, 2)}

Неразрешённые параметры (требуют особого внимания):
${JSON.stringify(unresolvedParams, null, 2)}

JSON Schema (canonical формат):
${JSON.stringify(schema, null, 2)}

Инструкции:
1. Используй только ключи из JSON Schema
2. Преобразуй единицы измерения согласно описанию
3. Для enum используй только значения из enum
4. Пропускай параметры, которые не соответствуют схеме

Верни JSON объект с нормализованными параметрами.
`.trim();
  }
  
  private validateAndClean(result: Record<string, any>): Record<string, any> {
    const cleaned: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(result)) {
      const paramDef = this.dictionary.find(p => p.key === key);
      if (!paramDef) continue;
      
      // Валидация типа
      if (paramDef.param_type === 'number' && typeof value !== 'number') {
        continue;
      }
      if (paramDef.param_type === 'enum' && typeof value !== 'string') {
        continue;
      }
      
      // Валидация диапазона (для чисел)
      if (paramDef.param_type === 'number') {
        if (paramDef.min_value != null && value < paramDef.min_value) continue;
        if (paramDef.max_value != null && value > paramDef.max_value) continue;
      }
      
      // Валидация enum значений
      if (paramDef.param_type === 'enum') {
        if (!paramDef.enum_values || !(value in paramDef.enum_values)) {
          continue;
        }
      }
      
      cleaned[key] = value;
    }
    
    return cleaned;
  }
}
```

---

## 3. Гибридный подход (рекомендуемый)

### Архитектура

```
main_parameters (raw)
    ↓
ParameterNormalizerService
    ├─ Rule-based нормализация (80%)
    │   ├─ AliasMatcher
    │   ├─ UnitParser
    │   └─ EnumMapper
    │
    ├─ Статистика (confidence)
    │
    └─ Если confidence < 0.7 → LLM fallback (20%)
        └─ LLMNormalizer
    ↓
normalized_parameters (canonical)
```

### Реализация

```typescript
export class HybridNormalizer {
  constructor(
    private ruleBasedNormalizer: ParameterNormalizerService,
    private llmNormalizer: LLMNormalizer
  ) {}
  
  async normalize(rawParams: Record<string, any>): Promise<{
    normalized: Record<string, any>;
    confidence: number;
    method: 'rule-based' | 'llm' | 'hybrid';
  }> {
    // Шаг 1: Rule-based нормализация
    const ruleBasedResult = this.ruleBasedNormalizer.normalize(rawParams);
    const stats = this.ruleBasedNormalizer.getNormalizationStats(rawParams);
    
    // Шаг 2: Если confidence высокий - возвращаем результат
    if (stats.confidence >= 0.7) {
      return {
        normalized: ruleBasedResult,
        confidence: stats.confidence,
        method: 'rule-based',
      };
    }
    
    // Шаг 3: LLM fallback для неразрешённых параметров
    const unresolved = this.getUnresolvedParams(rawParams, ruleBasedResult);
    
    if (Object.keys(unresolved).length > 0) {
      const llmResult = await this.llmNormalizer.normalizeWithLLM(
        rawParams,
        unresolved
      );
      
      // Объединяем результаты
      const hybridResult = {
        ...ruleBasedResult,
        ...llmResult,
      };
      
      return {
        normalized: hybridResult,
        confidence: Object.keys(hybridResult).length / Object.keys(rawParams).length,
        method: 'hybrid',
      };
    }
    
    return {
      normalized: ruleBasedResult,
      confidence: stats.confidence,
      method: 'rule-based',
    };
  }
  
  private getUnresolvedParams(
    raw: Record<string, any>,
    normalized: Record<string, any>
  ): Record<string, any> {
    const unresolved: Record<string, any> = {};
    
    // Находим параметры, которые не были нормализованы
    // (упрощённая логика, в реальности нужен более сложный маппинг)
    for (const [key, value] of Object.entries(raw)) {
      // Проверяем, был ли этот параметр нормализован
      // (в реальности нужен обратный маппинг raw key → canonical key)
      if (!this.isNormalized(key, normalized)) {
        unresolved[key] = value;
      }
    }
    
    return unresolved;
  }
  
  private isNormalized(rawKey: string, normalized: Record<string, any>): boolean {
    // Упрощённая проверка
    // В реальности нужен маппинг raw key → canonical key
    return false;
  }
}
```

---

## 4. Worker для массовой нормализации

### Архитектура

```
Batch Normalization Worker
    ↓
1. Загрузить записи без normalized_parameters
    ↓
2. Для каждой записи:
    ├─ Загрузить main_parameters
    ├─ Нормализовать (rule-based или hybrid)
    ├─ Сохранить normalized_parameters
    └─ Обновить embedding (если нужно)
    ↓
3. Статистика и отчёт
```

### Реализация

```typescript
export class NormalizationWorker {
  constructor(
    private repository: EquipmentRepository,
    private normalizer: HybridNormalizer
  ) {}
  
  /**
   * Нормализует все записи без normalized_parameters
   */
  async normalizeAll(limit?: number): Promise<{
    processed: number;
    success: number;
    failed: number;
    stats: {
      ruleBased: number;
      llm: number;
      hybrid: number;
    };
  }> {
    const batchSize = limit || 100;
    let processed = 0;
    let success = 0;
    let failed = 0;
    const methodStats = {
      ruleBased: 0,
      llm: 0,
      hybrid: 0,
    };
    
    while (true) {
      // Загружаем записи без normalized_parameters
      const records = await this.repository.findWithoutNormalized(batchSize);
      
      if (records.length === 0) break;
      
      for (const record of records) {
        try {
          // Нормализуем
          const result = await this.normalizer.normalize(record.main_parameters);
          
          // Сохраняем
          await this.repository.updateNormalizedParameters(
            record.id,
            result.normalized
          );
          
          success++;
          methodStats[result.method === 'rule-based' ? 'ruleBased' : 
                     result.method === 'llm' ? 'llm' : 'hybrid']++;
          
          processed++;
        } catch (error) {
          console.error(`Failed to normalize record ${record.id}:`, error);
          failed++;
          processed++;
        }
      }
      
      // Логируем прогресс
      console.log(`Processed: ${processed}, Success: ${success}, Failed: ${failed}`);
    }
    
    return {
      processed,
      success,
      failed,
      stats: methodStats,
    };
  }
}
```

---

## 5. Автоматическое обновление при изменении данных

### Триггер в PostgreSQL

```sql
-- Функция для автоматической нормализации
CREATE OR REPLACE FUNCTION equipment_normalize_parameters()
RETURNS TRIGGER AS $$
BEGIN
  -- Если изменились main_parameters, сбрасываем normalized_parameters
  -- Worker пересчитает их автоматически
  IF (NEW.main_parameters IS DISTINCT FROM OLD.main_parameters) THEN
    NEW.normalized_parameters := '{}'::jsonb;
    NEW.normalized_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер
CREATE TRIGGER equipment_normalize_trigger
BEFORE UPDATE ON equipment
FOR EACH ROW
EXECUTE FUNCTION equipment_normalize_parameters();
```

### Или через приложение

```typescript
export class EquipmentService {
  async updateEquipment(id: string, data: Partial<Equipment>) {
    // Обновляем основную запись
    await this.repository.update(id, data);
    
    // Если изменились main_parameters, нормализуем
    if (data.main_parameters) {
      const normalized = await this.normalizer.normalize(data.main_parameters);
      await this.repository.updateNormalizedParameters(id, normalized);
    }
  }
}
```

---

## 6. Рекомендации по внедрению

### Этап 1: Rule-based нормализация (MVP)
1. Создать `ParameterNormalizerService`
2. Реализовать `AliasMatcher`, `UnitParser`, `EnumMapper`
3. Протестировать на реальных данных
4. Настроить правила для 80% случаев

### Этап 2: Добавить LLM fallback
1. Реализовать `LLMNormalizer`
2. Интегрировать в `HybridNormalizer`
3. Использовать только для неразрешённых параметров

### Этап 3: Worker для массовой обработки
1. Создать `NormalizationWorker`
2. Запустить для существующих данных
3. Настроить периодический запуск

### Этап 4: Мониторинг и улучшение
1. Собирать статистику нормализации
2. Выявлять проблемные случаи
3. Улучшать правила и словари
4. Расширять справочник новыми параметрами

---

## 7. Примеры использования

### CLI команда для нормализации

```typescript
// src/cli/normalize-parameters.ts
import { ParameterNormalizerService } from '../normalization';
import { EquipmentRepository } from '../repository';

async function main() {
  const repository = new EquipmentRepository();
  const normalizer = new ParameterNormalizerService(await loadDictionary());
  const worker = new NormalizationWorker(repository, normalizer);
  
  const result = await worker.normalizeAll();
  
  console.log(`Processed: ${result.processed}`);
  console.log(`Success: ${result.success}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Rule-based: ${result.stats.ruleBased}`);
  console.log(`LLM: ${result.stats.llm}`);
  console.log(`Hybrid: ${result.stats.hybrid}`);
}

void main();
```

### Добавить в package.json

```json
{
  "scripts": {
    "normalize:parameters": "ts-node src/cli/normalize-parameters.ts"
  }
}
```

---

## Итог

**Рекомендуемый подход**: Гибридный (rule-based + LLM fallback)

**Преимущества**:
- ✅ Быстро для большинства случаев (rule-based)
- ✅ Точность для сложных случаев (LLM)
- ✅ Контролируемость (правила можно улучшать)
- ✅ Масштабируемость (легко добавлять новые параметры)

**Следующие шаги**:
1. Реализовать rule-based нормализацию
2. Протестировать на реальных данных
3. Добавить LLM fallback для проблемных случаев
4. Создать worker для массовой обработки

