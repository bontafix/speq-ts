#!/usr/bin/env ts-node

import "dotenv/config";
import { pgPool } from "../db/pg";

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

/**
 * Проверяет статистику по записям в таблице equipment
 */
async function checkEquipmentStats(): Promise<void> {
  const statsSql = `
    SELECT 
      COUNT(*) as total_records,
      COUNT(*) FILTER (WHERE is_active = true) as active_records,
      COUNT(*) FILTER (WHERE is_active = false) as inactive_records,
      COUNT(*) FILTER (WHERE main_parameters IS NOT NULL AND main_parameters != '{}'::jsonb) as records_with_params,
      COUNT(*) FILTER (WHERE main_parameters IS NULL) as records_null_params,
      COUNT(*) FILTER (WHERE main_parameters = '{}'::jsonb) as records_empty_params,
      COUNT(*) FILTER (WHERE is_active = true AND main_parameters IS NOT NULL AND main_parameters != '{}'::jsonb) as active_with_params
    FROM equipment;
  `;

  const statsResult = await pgPool.query(statsSql);
  const stats = statsResult.rows[0];

  console.log("=".repeat(80));
  console.log("СТАТИСТИКА ТАБЛИЦЫ EQUIPMENT");
  console.log("=".repeat(80));
  console.log(`Всего записей: ${stats.total_records}`);
  console.log(`  - Активных (is_active = true): ${stats.active_records}`);
  console.log(`  - Неактивных (is_active = false): ${stats.inactive_records}`);
  console.log(`\nЗаписи с параметрами:`);
  console.log(`  - С параметрами (не NULL и не {}): ${stats.records_with_params}`);
  console.log(`  - С NULL параметрами: ${stats.records_null_params}`);
  console.log(`  - С пустыми параметрами ({}): ${stats.records_empty_params}`);
  console.log(`\nАктивные записи с параметрами: ${stats.active_with_params}`);
  console.log("=".repeat(80));
  console.log("");
}

/**
 * Анализирует все параметры из main_parameters в таблице equipment
 */
export async function analyzeParameters(): Promise<ParameterAnalysis[]> {
  console.log("Анализ параметров из main_parameters...\n");

  // Сначала проверяем статистику
  await checkEquipmentStats();

  // Оптимизированный SQL запрос - собираем все параметры напрямую из equipment
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

  console.log(`Найдено ${result.rows.length} уникальных параметров\n`);

  const analysis: ParameterAnalysis[] = [];

  for (const row of result.rows) {
    const values = (row.all_values || []).filter((v: any) => v != null);
    const uniqueValues = [...new Set(values)];

    const paramAnalysis: ParameterAnalysis = {
      key: row.key,
      frequency: row.frequency,
      sampleValues: uniqueValues.slice(0, 20),
      valueTypes: {
        number: 0,
        string: 0,
        boolean: 0,
      },
      unitPatterns: [],
      enumCandidates: [],
      uniqueValuesCount: uniqueValues.length,
    };

    // Анализ типов значений
    for (const value of values) {
      if (typeof value === "number" || !isNaN(parseFloat(String(value)))) {
        paramAnalysis.valueTypes.number++;
      } else if (typeof value === "boolean" || value === "true" || value === "false") {
        paramAnalysis.valueTypes.boolean++;
      } else if (typeof value === "string") {
        paramAnalysis.valueTypes.string++;

        // Поиск единиц измерения
        const unitMatch = String(value).match(
          /(кг|т|тонн|л\.с\.|hp|кВт|kW|квт|м|см|мм|т\/ч|м³|м3|л|литр|га|час|ч|мин|сек|об\/мин|rpm|Гц|Hz|%|процент)/i
        );
        if (unitMatch) {
          paramAnalysis.unitPatterns.push(unitMatch[0]);
        }

        // Кандидаты на enum (если уникальных значений мало и это не числа)
        if (uniqueValues.length <= 20 && uniqueValues.length > 1) {
          const isNumeric = uniqueValues.every((v) => !isNaN(parseFloat(String(v))));
          if (!isNumeric) {
            paramAnalysis.enumCandidates = uniqueValues
              .slice(0, 20)
              .map((v) => String(v));
          }
        }
      }
    }

    analysis.push(paramAnalysis);
  }

  return analysis;
}

/**
 * Выводит результаты анализа в консоль
 */
function printAnalysis(analysis: ParameterAnalysis[]): void {
  console.log("=".repeat(80));
  console.log("РЕЗУЛЬТАТЫ АНАЛИЗА ПАРАМЕТРОВ");
  console.log("=".repeat(80));
  console.log(`Всего уникальных параметров: ${analysis.length}\n`);

  console.log("Топ-30 наиболее частых параметров:\n");
  analysis.slice(0, 30).forEach((param, index) => {
    console.log(`${index + 1}. ${param.key}`);
    console.log(`   Частота: ${param.frequency} раз`);
    console.log(`   Уникальных значений: ${param.uniqueValuesCount}`);
    console.log(`   Типы: число=${param.valueTypes.number}, строка=${param.valueTypes.string}, boolean=${param.valueTypes.boolean}`);

    if (param.unitPatterns.length > 0) {
      const uniqueUnits = [...new Set(param.unitPatterns)];
      console.log(`   Единицы измерения: ${uniqueUnits.join(", ")}`);
    }

    if (param.enumCandidates.length > 0) {
      console.log(`   Enum кандидаты (${param.enumCandidates.length}): ${param.enumCandidates.slice(0, 5).join(", ")}${param.enumCandidates.length > 5 ? "..." : ""}`);
    }

    console.log(`   Примеры значений: ${param.sampleValues.slice(0, 5).join(", ")}${param.sampleValues.length > 5 ? "..." : ""}`);
    console.log("");
  });

  // Статистика по типам
  const numberParams = analysis.filter((p) => p.valueTypes.number > p.valueTypes.string);
  const stringParams = analysis.filter((p) => p.valueTypes.string > p.valueTypes.number);
  const enumParams = analysis.filter((p) => p.enumCandidates.length > 0);

  console.log("\n" + "=".repeat(80));
  console.log("СТАТИСТИКА");
  console.log("=".repeat(80));
  console.log(`Числовые параметры: ${numberParams.length}`);
  console.log(`Строковые параметры: ${stringParams.length}`);
  console.log(`Потенциальные enum: ${enumParams.length}`);
  console.log("");
}

/**
 * Сохраняет результаты анализа в JSON файл
 */
async function saveAnalysis(analysis: ParameterAnalysis[]): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");

  const outputPath = path.join(process.cwd(), "parameter-analysis.json");
  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2), "utf-8");
  console.log(`\n✓ Результаты сохранены в: ${outputPath}`);
}

/**
 * Проверяет, что все записи учтены в анализе
 */
async function verifyAnalysisCoverage(analysis: ParameterAnalysis[]): Promise<void> {
  // Получаем общее количество активных записей с параметрами
  const coverageSql = `
    SELECT COUNT(*) as total_active_with_params
    FROM equipment
    WHERE is_active = true
      AND main_parameters IS NOT NULL
      AND main_parameters != '{}'::jsonb;
  `;

  const coverageResult = await pgPool.query(coverageSql);
  const totalRecords = parseInt(coverageResult.rows[0].total_active_with_params);

  // Проверяем, что frequency для каждого параметра не превышает общее количество записей
  const maxFrequency = Math.max(...analysis.map(a => a.frequency));
  const totalFrequency = analysis.reduce((sum, a) => sum + a.frequency, 0);

  console.log("\n" + "=".repeat(80));
  console.log("ПРОВЕРКА ПОКРЫТИЯ АНАЛИЗА");
  console.log("=".repeat(80));
  console.log(`Всего активных записей с параметрами: ${totalRecords}`);
  console.log(`Максимальная частота параметра: ${maxFrequency}`);
  console.log(`Сумма всех частот: ${totalFrequency}`);
  
  if (maxFrequency > totalRecords) {
    console.log(`⚠️  ВНИМАНИЕ: Максимальная частота (${maxFrequency}) превышает количество записей (${totalRecords})!`);
    console.log(`   Это может указывать на проблему в SQL запросе.`);
  } else {
    console.log(`✓ Максимальная частота не превышает количество записей`);
  }

  // Проверяем, что каждый параметр встречается хотя бы в одной записи
  const paramsWithZeroFrequency = analysis.filter(a => a.frequency === 0);
  if (paramsWithZeroFrequency.length > 0) {
    console.log(`⚠️  Найдено ${paramsWithZeroFrequency.length} параметров с нулевой частотой:`);
    paramsWithZeroFrequency.slice(0, 10).forEach(p => {
      console.log(`   - ${p.key}`);
    });
  } else {
    console.log(`✓ Все параметры имеют частоту > 0`);
  }

  console.log("=".repeat(80));
}

/**
 * Главная функция
 */
async function main() {
  try {
    const analysis = await analyzeParameters();

    if (analysis.length === 0) {
      console.log("Параметры не найдены. Убедитесь, что в таблице equipment есть данные с main_parameters.");
      process.exit(1);
    }

    // Проверяем покрытие
    await verifyAnalysisCoverage(analysis);

    printAnalysis(analysis);
    await saveAnalysis(analysis);

    console.log("\n" + "=".repeat(80));
    console.log("СЛЕДУЮЩИЕ ШАГИ:");
    console.log("=".repeat(80));
    console.log("1. Просмотрите parameter-analysis.json");
    console.log("2. Запустите генерацию справочника: npm run generate:dictionary");
    console.log("3. Проверьте и скорректируйте критичные параметры вручную");
    console.log("");
  } catch (error) {
    console.error("Ошибка при анализе параметров:", error);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

void main();

