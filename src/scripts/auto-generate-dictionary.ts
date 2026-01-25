#!/usr/bin/env ts-node

/**
 * АВТОМАТИЧЕСКИЙ СБОР ПАРАМЕТРОВ из БД с генерацией словаря
 * 
 * Процесс:
 * 1. Собрать все параметры из equipment.main_parameters
 * 2. Проанализировать частоту и типы значений
 * 3. Отфильтровать мусор (низкая частота, технические поля)
 * 4. Сгенерировать canonical ключи через LLM
 * 5. Создать записи в словаре
 * 6. Показать статистику покрытия
 * 
 * Запуск: npx tsx src/scripts/auto-generate-dictionary.ts
 */

import "../config/env-loader";
import { pgPool } from "../db/pg";
import { LLMProviderFactory } from "../llm";

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
  uniqueValuesCount: number;
}

interface DictionaryEntry {
  key: string;
  label_ru: string;
  description_ru: string;
  category: string;
  param_type: "number" | "enum" | "boolean" | "string";
  unit?: string;
  min_value?: number;
  max_value?: number;
  enum_values?: Record<string, string>;
  aliases: string[];
  sql_expression: string;
  priority: number;
}

/**
 * Собрать все параметры из БД
 */
async function collectAllParameters(): Promise<ParameterAnalysis[]> {
  console.log("🔍 Сбор параметров из equipment.main_parameters...");
  
  const sql = `
    WITH expanded_params AS (
      SELECT 
        e.id,
        (jsonb_each_text(e.main_parameters)).key AS param_key,
        (jsonb_each_text(e.main_parameters)).value AS param_value
      FROM equipment e
      WHERE e.main_parameters IS NOT NULL
        AND e.main_parameters != '{}'::jsonb
        AND e.is_active = true
    ),
    param_stats AS (
      SELECT 
        ep.param_key AS key,
        COUNT(DISTINCT ep.id) as frequency,
        jsonb_agg(DISTINCT ep.param_value) FILTER (
          WHERE ep.param_value IS NOT NULL AND ep.param_value != ''
        ) as all_values
      FROM expanded_params ep
      GROUP BY ep.param_key
    )
    SELECT 
      key,
      frequency,
      all_values
    FROM param_stats
    WHERE key IS NOT NULL
    ORDER BY frequency DESC;
  `;

  const result = await pgPool.query(sql);
  console.log(`✅ Найдено ${result.rows.length} уникальных параметров`);

  const analysis: ParameterAnalysis[] = [];
  
  for (const row of result.rows) {
    const allValues = row.all_values || [];
    const sampleValues = allValues.slice(0, 20);
    
    // Анализ типов значений
    const valueTypes = { number: 0, string: 0, boolean: 0 };
    const unitPatterns: string[] = [];
    const enumCandidates: string[] = [];
    
    for (const value of allValues) {
      const str = String(value).trim();
      
      // Определение типа
      if (!isNaN(Number(str)) && str !== '') {
        valueTypes.number++;
      } else if (str.toLowerCase() === 'true' || str.toLowerCase() === 'false') {
        valueTypes.boolean++;
      } else {
        valueTypes.string++;
      }
      
      // Поиск единиц измерения
      const unitMatch = str.match(/\b(кг|т|л|мм|см|м|квт|л\.с\.|км\/ч|м\/ч|bar|psi|mpa)\b/i);
      if (unitMatch) {
        unitPatterns.push(unitMatch[1].toLowerCase());
      }
    }
    
    // Поиск кандидатов в enum (мало уникальных значений)
    if (allValues.length <= 20 && allValues.length > 1) {
      enumCandidates.push(...allValues.slice(0, 10));
    }

    analysis.push({
      key: row.key,
      frequency: parseInt(row.frequency),
      sampleValues,
      valueTypes,
      unitPatterns: [...new Set(unitPatterns)],
      enumCandidates: [...new Set(enumCandidates)],
      uniqueValuesCount: allValues.length
    });
  }

  return analysis;
}

/**
 * Отфильтровать параметры по качеству
 */
function filterParameters(analysis: ParameterAnalysis[]): ParameterAnalysis[] {
  console.log("🔍 Фильтрация параметров...");
  
  const filtered = analysis.filter(param => {
    // Отсеиваем мусор и технические поля
    const junkPatterns = [
      /^id$/, /^код$/i, /^uuid$/i, /^hash$/i,
      /^дата/i, /^время/i, /^timestamp/i,
      /^источник/i, /^source/i,
      /^статус/i, /^status/i,
      /^комментарий/i, /^примечание/i,
      /^владелец/i, /^создан/i
    ];
    
    const isJunk = junkPatterns.some(pattern => pattern.test(param.key));
    
    // Отсеиваем слишком редкие параметры (< 5 использований)
    const isTooRare = param.frequency < 5;
    
    // Отсеиваем параметры с слишком большим разнообразием (скорее всего уникальные ID)
    const isTooDiverse = param.uniqueValuesCount > param.frequency * 0.8;
    
    return !isJunk && !isTooRare && !isTooDiverse;
  });
  
  console.log(`✅ Отфильтровано: ${filtered.length} из ${analysis.length} параметров`);
  return filtered;
}

/**
 * Сгенерировать canonical ключ через LLM
 */
async function generateCanonicalKey(
  param: ParameterAnalysis,
  llmProvider: any
): Promise<DictionaryEntry | null> {
  const model = process.env.LLM_MODEL || "qwen2.5:7b-instruct-q4_K_M";
  
  // Определяем тип параметра
  let paramType: "number" | "enum" | "boolean" | "string" = "string";
  if (param.valueTypes.number > param.valueTypes.string) {
    paramType = "number";
  } else if (param.enumCandidates.length > 0 && param.enumCandidates.length <= 20) {
    paramType = "enum";
  } else if (param.valueTypes.boolean > 0) {
    paramType = "boolean";
  }
  
  const prompt = `
Создай canonical запись для параметра оборудования.

Параметр: ${param.key}
Частота: ${param.frequency}
Тип значений: ${paramType}
Примеры: ${JSON.stringify(param.sampleValues.slice(0, 10))}
${param.unitPatterns.length > 0 ? `Единицы: ${param.unitPatterns.join(", ")}` : ""}

Верни JSON:
{
  "key": "canonical_key",
  "label_ru": "Название на русском",
  "category": "general|performance|dimensions|power|weight|capacity|other",
  "param_type": "${paramType}",
  "priority": ${param.frequency > 50 ? 20 : param.frequency > 20 ? 30 : 40}
}

Правила:
- key: английский, snake_case, описательный
- category: выбери подходящую категорию
- priority: чем выше частота, тем ниже приоритет
`;

  try {
    const response = await llmProvider.generateCompletion({
      model,
      prompt,
      maxTokens: 200,
      temperature: 0.1
    });
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const generated = JSON.parse(jsonMatch[0]);
    
    return {
      key: generated.key,
      label_ru: generated.label_ru,
      description_ru: `Параметр: ${param.key}`,
      category: generated.category,
      param_type: generated.param_type,
      unit: param.unitPatterns[0],
      aliases: [param.key, param.key.toLowerCase()],
      sql_expression: `main_parameters->>'${param.key}'`,
      priority: generated.priority
    };
  } catch (error) {
    console.warn(`❌ Ошибка генерации для ${param.key}:`, error);
    return null;
  }
}

/**
 * Основная функция
 */
async function main() {
  console.log("🚀 Автоматическая генерация словаря параметров\n");
  
  try {
    // 1. Собрать параметры
    const allParams = await collectAllParameters();
    
    // 2. Отфильтровать
    const filteredParams = filterParameters(allParams);
    
    // 3. Инициализировать LLM
    const llmProvider = LLMProviderFactory.createProvider();
    
    // 4. Сгенерировать записи
    console.log("\n🤖 Генерация записей через LLM...");
    const generatedEntries: DictionaryEntry[] = [];
    
    for (const param of filteredParams.slice(0, 20)) { // Ограничим для теста
      const entry = await generateCanonicalKey(param, llmProvider);
      if (entry) {
        generatedEntries.push(entry);
        console.log(`✅ ${param.key} → ${entry.key}`);
      }
    }
    
    // 5. Показать результаты
    console.log("\n📊 Результаты:");
    console.log(`✅ Сгенерировано записей: ${generatedEntries.length}`);
    console.log(`📈 Покрытие параметров: ${Math.round(generatedEntries.length / allParams.length * 100)}%`);
    
    // 6. Сохранить в файл для ручной проверки
    const fs = require('fs');
    fs.writeFileSync(
      'generated-dictionary-entries.json',
      JSON.stringify(generatedEntries, null, 2)
    );
    console.log(`💾 Сохранено в: generated-dictionary-entries.json`);
    
  } catch (error) {
    console.error("❌ Ошибка:", error);
  } finally {
    await pgPool.end();
  }
}

if (require.main === module) {
  main();
}
