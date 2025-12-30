#!/usr/bin/env ts-node

import "dotenv/config";
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
  description_ru?: string;
  category: string;
  param_type: "number" | "enum" | "boolean";
  unit?: string;
  min_value?: number;
  max_value?: number;
  enum_values?: Record<string, string>;
  aliases: string[];
  sql_expression: string;
  priority: number;
}

/**
 * Генерирует запись справочника для параметра через LLM
 */
async function generateDictionaryEntry(
  candidate: ParameterAnalysis,
  llmProvider: any
): Promise<DictionaryEntry | null> {
  const model = process.env.LLM_MODEL || "qwen2.5:7b-instruct-q4_K_M";

  // Определяем тип параметра на основе анализа
  let suggestedType: "number" | "enum" | "boolean" = "enum"; // default
  if (candidate.valueTypes.number > candidate.valueTypes.string) {
    suggestedType = "number";
  } else if (candidate.enumCandidates.length > 0 && candidate.enumCandidates.length <= 20) {
    suggestedType = "enum";
  } else if (candidate.valueTypes.boolean > 0) {
    suggestedType = "boolean";
  }

  const prompt = `
Проанализируй следующий параметр оборудования и создай запись для справочника parameter_dictionary.

Параметр: ${candidate.key}
Частота использования: ${candidate.frequency}
Уникальных значений: ${candidate.uniqueValuesCount}
Типы значений: число=${candidate.valueTypes.number}, строка=${candidate.valueTypes.string}, boolean=${candidate.valueTypes.boolean}
Примеры значений: ${JSON.stringify(candidate.sampleValues.slice(0, 20))}
${candidate.unitPatterns.length > 0 ? `Единицы измерения: ${[...new Set(candidate.unitPatterns)].join(", ")}` : ""}
${candidate.enumCandidates.length > 0 ? `Enum кандидаты: ${JSON.stringify(candidate.enumCandidates.slice(0, 10))}` : ""}

Создай JSON объект со следующей структурой:
{
  "key": "canonical_key",           // стандартный ключ (латиница, snake_case, например: weight_kg, power_hp)
  "label_ru": "Название на русском",
  "description_ru": "Подробное описание параметра на русском языке",
  "category": "weight|power|dimensions|performance|fuel|drive|environment|capacity|other",
  "param_type": "number|enum|boolean",
  "unit": "кг|л.с.|кВт|м|см|мм|т/ч|м³",  // только для number, единица измерения
  "min_value": 0,                    // только для number, минимальное значение
  "max_value": 1000000,              // только для number, максимальное значение
  "enum_values": {                    // только для enum, canonical значение -> описание
    "diesel": "дизель",
    "petrol": "бензин"
  },
  "aliases": ["алиас1", "алиас2"],   // варианты названий из исходных данных
  "priority": 0                       // 0 = самый важный, 1-2 для остальных
}

Инструкции:
1. Определи тип параметра (number/enum/boolean) на основе анализа
2. Для number: определи единицу измерения и диапазон значений из примеров
3. Для enum: создай canonical значения (латиница, lowercase, snake_case если нужно)
4. Создай алиасы на основе исходного ключа и примеров значений
5. Определи категорию параметра:
   - weight: масса, вес
   - power: мощность
   - dimensions: размеры (длина, ширина, высота, глубина)
   - performance: производительность
   - fuel: топливо, энергия
   - drive: ходовая часть
   - environment: экология
   - capacity: грузоподъёмность, объём
   - other: прочее
6. Приоритет: 0 для критичных (масса, мощность, тип питания), 1-2 для остальных
7. SQL выражение будет сгенерировано автоматически, не включай его в ответ

Верни ТОЛЬКО валидный JSON без комментариев и дополнительного текста.
`.trim();

  try {
    const response = await llmProvider.chat({
      model,
      messages: [
        {
          role: "system",
          content:
            "Ты помощник по созданию справочника параметров оборудования. Отвечай ТОЛЬКО валидным JSON без комментариев и пояснений.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
    });

    const raw = response.message.content.trim();

    // Извлекаем JSON из ответа
    let jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`Не найден JSON в ответе для ${candidate.key}`);
      return null;
    }

    const entry = JSON.parse(jsonMatch[0]) as DictionaryEntry;

    // Генерируем SQL выражение
    if (entry.param_type === "number") {
      entry.sql_expression = `(normalized_parameters->>'${entry.key}')::numeric`;
    } else {
      entry.sql_expression = `normalized_parameters->>'${entry.key}'`;
    }

    // Валидация обязательных полей
    if (!entry.key || !entry.label_ru || !entry.param_type || !entry.category) {
      console.warn(`Неполная запись для ${candidate.key}:`, entry);
      return null;
    }

    // Нормализация ключа (snake_case)
    entry.key = entry.key.toLowerCase().replace(/[^a-z0-9_]/g, "_");

    return entry;
  } catch (error) {
    console.error(`Ошибка при генерации записи для ${candidate.key}:`, error);
    return null;
  }
}

/**
 * Сохраняет запись справочника в БД
 */
async function saveDictionaryEntry(entry: DictionaryEntry): Promise<boolean> {
  const client = await pgPool.connect();

  try {
    await client.query("BEGIN");

    // Проверяем, существует ли уже запись
    const exists = await client.query("SELECT key FROM parameter_dictionary WHERE key = $1", [entry.key]);

    if (exists.rows.length > 0) {
      // Обновляем существующую запись
      await client.query(
        `
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
          sql_expression = $11,
          priority = $12,
          updated_at = NOW()
        WHERE key = $1
      `,
        [
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
          entry.sql_expression,
          entry.priority || 0,
        ]
      );
      return true;
    } else {
      // Создаём новую запись
      await client.query(
        `
        INSERT INTO parameter_dictionary (
          key, label_ru, description_ru, category, param_type,
          unit, min_value, max_value, enum_values, aliases, sql_expression, priority
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
        [
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
          entry.sql_expression,
          entry.priority || 0,
        ]
      );
      return true;
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.query("COMMIT");
    client.release();
  }
}

/**
 * Главная функция
 */
async function main() {
  const fs = await import("fs");
  const path = await import("path");

  const analysisPath = path.join(process.cwd(), "parameter-analysis.json");

  if (!fs.existsSync(analysisPath)) {
    console.error(`Файл ${analysisPath} не найден. Сначала запустите: npm run analyze:parameters`);
    process.exit(1);
  }

  const analysis: ParameterAnalysis[] = JSON.parse(fs.readFileSync(analysisPath, "utf-8"));

  console.log("Генерация справочника параметров через LLM...\n");
  console.log(`Загружено ${analysis.length} параметров из анализа\n`);

  // Инициализируем LLM провайдер
  const llmFactory = new LLMProviderFactory();
  const llmHealth = await llmFactory.checkHealth();
  const availableProviders = Object.entries(llmHealth)
    .filter(([, available]) => available)
    .map(([name]) => name);

  if (availableProviders.length === 0) {
    console.error("Ни один LLM провайдер не доступен. Проверьте настройки.");
    process.exit(1);
  }

  console.log(`Доступные LLM провайдеры: ${availableProviders.join(", ")}`);
  
  // Создаём провайдер через фабрику (используем метод chat напрямую)
  const llmProvider = {
    chat: async (options: any) => {
      return await llmFactory.chat(options);
    },
  };

  // Обрабатываем только топ-N параметров с достаточной частотой
  const minFrequency = parseInt(process.env.MIN_PARAM_FREQUENCY || "3", 10);
  const maxParams = parseInt(process.env.MAX_PARAMS_TO_GENERATE || "50", 10);

  const topParams = analysis
    .filter((p) => p.frequency >= minFrequency)
    .slice(0, maxParams);

  console.log(`Будет обработано ${topParams.length} параметров (минимум ${minFrequency} использований)\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < topParams.length; i++) {
    const param = topParams[i];
    if (!param) {
      console.log(`[${i + 1}/${topParams.length}] Пропущен пустой параметр`);
      continue;
    }
    
    console.log(`[${i + 1}/${topParams.length}] Обработка: ${param.key} (${param.frequency} раз)...`);

    try {
      const entry = await generateDictionaryEntry(param, llmProvider);

      if (entry) {
        await saveDictionaryEntry(entry);
        console.log(`  ✓ Создана запись: ${entry.key} (${entry.label_ru})`);
        success++;
      } else {
        console.log(`  ✗ Не удалось создать запись`);
        failed++;
      }
    } catch (error) {
      console.error(`  ✗ Ошибка:`, error);
      failed++;
    }

    // Небольшая задержка, чтобы не перегружать LLM
    if (i < topParams.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("РЕЗУЛЬТАТЫ");
  console.log("=".repeat(80));
  console.log(`Успешно: ${success}`);
  console.log(`Ошибок: ${failed}`);
  console.log(`Всего: ${topParams.length}`);

  if (success > 0) {
    console.log("\n✓ Справочник создан!");
    console.log("\nСледующие шаги:");
    console.log("1. Проверьте критичные параметры в БД: SELECT * FROM parameter_dictionary ORDER BY priority, key;");
    console.log("2. Скорректируйте при необходимости");
    console.log("3. Запустите нормализацию: npm run normalize:parameters");
  }

  await pgPool.end();
}

void main();

