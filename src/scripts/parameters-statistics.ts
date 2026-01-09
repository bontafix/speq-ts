#!/usr/bin/env ts-node

/**
 * Статистика по параметрам для бота
 * 
 * Собирает полную статистику:
 * - Параметры в main_parameters (уникальные, общее количество использований)
 * - Параметры в справочнике
 * - Количество алиасов
 * - Покрытие параметров
 * - Статистика по типам параметров
 * - Статистика по категориям
 * - Нормализация (сколько записей нормализовано)
 * 
 * Выводит в JSON и текстовом формате
 * 
 * Запуск: 
 *   npx tsx src/scripts/parameters-statistics.ts
 *   npx tsx src/scripts/parameters-statistics.ts --json  # Только JSON
 */

import "dotenv/config";
import { pgPool } from "../db/pg";
import { ParameterDictionaryService } from "../normalization";

interface Statistics {
  timestamp: string;
  main_parameters: {
    unique_count: number;
    total_usages: number;
    records_with_params: number;
    records_without_params: number;
  };
  dictionary: {
    total_parameters: number;
    total_aliases: number;
    avg_aliases_per_param: number;
    by_type: {
      number: number;
      enum: number;
      boolean: number;
      string: number;
    };
    by_category: Record<string, number>;
  };
  coverage: {
    unique_params_covered: number;
    unique_params_uncovered: number;
    coverage_percent: number;
    usages_covered: number;
    usages_uncovered: number;
    coverage_by_usage_percent: number;
  };
  normalization: {
    total_records: number;
    normalized_records: number;
    not_normalized_records: number;
    normalization_percent: number;
  };
  top_uncovered: Array<{
    key: string;
    frequency: number;
  }>;
}

async function collectStatistics(): Promise<Statistics> {
  // Загружаем справочник
  const dictionaryService = new ParameterDictionaryService();
  await dictionaryService.loadDictionary();
  const dictionary = dictionaryService.getDictionary();

  // Статистика по main_parameters
  const mainParamsStats = await pgPool.query(`
    WITH param_keys AS (
      SELECT DISTINCT jsonb_object_keys(main_parameters) AS param_key
      FROM equipment
      WHERE is_active = true
        AND main_parameters IS NOT NULL
        AND main_parameters != '{}'::jsonb
    ),
    param_stats AS (
      SELECT 
        pk.param_key,
        COUNT(*) as frequency
      FROM param_keys pk
      CROSS JOIN equipment e
      WHERE e.main_parameters ? pk.param_key
        AND e.is_active = true
      GROUP BY pk.param_key
    )
    SELECT 
      COUNT(DISTINCT param_key) as unique_count,
      SUM(frequency) as total_usages
    FROM param_stats
  `);

  const recordsStats = await pgPool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE is_active = true) as total_active,
      COUNT(*) FILTER (
        WHERE is_active = true 
          AND main_parameters IS NOT NULL 
          AND main_parameters != '{}'::jsonb
      ) as with_params,
      COUNT(*) FILTER (
        WHERE is_active = true 
          AND (main_parameters IS NULL OR main_parameters = '{}'::jsonb)
      ) as without_params
    FROM equipment
  `);

  // Статистика по справочнику
  const dictionaryStats = await pgPool.query(`
    SELECT 
      COUNT(*) as total,
      SUM(jsonb_array_length(COALESCE(aliases, '[]'::jsonb))) as total_aliases,
      COUNT(*) FILTER (WHERE param_type = 'number') as type_number,
      COUNT(*) FILTER (WHERE param_type = 'enum') as type_enum,
      COUNT(*) FILTER (WHERE param_type = 'boolean') as type_boolean,
      COUNT(*) FILTER (WHERE param_type = 'string') as type_string
    FROM parameter_dictionary
  `);

  const categoryStats = await pgPool.query(`
    SELECT 
      category,
      COUNT(*) as count
    FROM parameter_dictionary
    GROUP BY category
    ORDER BY count DESC
  `);

  // Покрытие параметров
  const dbParamsResult = await pgPool.query(`
    WITH param_keys AS (
      SELECT DISTINCT jsonb_object_keys(main_parameters) AS param_key
      FROM equipment
      WHERE is_active = true
        AND main_parameters IS NOT NULL
        AND main_parameters != '{}'::jsonb
    ),
    param_stats AS (
      SELECT 
        pk.param_key,
        COUNT(*) as frequency
      FROM param_keys pk
      CROSS JOIN equipment e
      WHERE e.main_parameters ? pk.param_key
        AND e.is_active = true
      GROUP BY pk.param_key
    )
    SELECT 
      param_key,
      frequency
    FROM param_stats
    ORDER BY frequency DESC
  `);

  let uniqueCovered = 0;
  let uniqueUncovered = 0;
  let usagesCovered = 0;
  let usagesUncovered = 0;
  const uncovered: Array<{ key: string; frequency: number }> = [];

  for (const row of dbParamsResult.rows) {
    const frequency = parseInt(row.frequency, 10) || 0;
    const paramDef = dictionaryService.findCanonicalKey(row.param_key);
    
    if (paramDef) {
      uniqueCovered++;
      usagesCovered += frequency;
    } else {
      uniqueUncovered++;
      usagesUncovered += frequency;
      uncovered.push({
        key: row.param_key,
        frequency: frequency,
      });
    }
  }

  const uniqueTotal = uniqueCovered + uniqueUncovered;
  const usagesTotal = usagesCovered + usagesUncovered;

  // Статистика по нормализации
  const normalizationStats = await pgPool.query(`
    SELECT 
      COUNT(*) FILTER (
        WHERE is_active = true 
          AND main_parameters IS NOT NULL 
          AND main_parameters != '{}'::jsonb
      ) as total_with_params,
      COUNT(*) FILTER (
        WHERE is_active = true 
          AND main_parameters IS NOT NULL 
          AND main_parameters != '{}'::jsonb
          AND normalized_parameters IS NOT NULL 
          AND normalized_parameters != '{}'::jsonb
      ) as normalized,
      COUNT(*) FILTER (
        WHERE is_active = true 
          AND main_parameters IS NOT NULL 
          AND main_parameters != '{}'::jsonb
          AND (normalized_parameters IS NULL OR normalized_parameters = '{}'::jsonb)
      ) as not_normalized
    FROM equipment
  `);

  const normStats = normalizationStats.rows[0];
  const totalWithParams = parseInt(normStats.total_with_params, 10) || 0;
  const normalized = parseInt(normStats.normalized, 10) || 0;
  const notNormalized = parseInt(normStats.not_normalized, 10) || 0;

  // Топ непокрытых параметров
  const topUncovered = uncovered
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  // Формируем статистику по категориям
  const byCategory: Record<string, number> = {};
  categoryStats.rows.forEach((row: any) => {
    byCategory[row.category] = parseInt(row.count, 10) || 0;
  });

  const stats: Statistics = {
    timestamp: new Date().toISOString(),
    main_parameters: {
      unique_count: parseInt(mainParamsStats.rows[0].unique_count, 10) || 0,
      total_usages: parseInt(mainParamsStats.rows[0].total_usages, 10) || 0,
      records_with_params: parseInt(recordsStats.rows[0].with_params, 10) || 0,
      records_without_params: parseInt(recordsStats.rows[0].without_params, 10) || 0,
    },
    dictionary: {
      total_parameters: parseInt(dictionaryStats.rows[0].total, 10) || 0,
      total_aliases: parseInt(dictionaryStats.rows[0].total_aliases, 10) || 0,
      avg_aliases_per_param: dictionary.length > 0
        ? Math.round((parseInt(dictionaryStats.rows[0].total_aliases, 10) || 0) / dictionary.length * 10) / 10
        : 0,
      by_type: {
        number: parseInt(dictionaryStats.rows[0].type_number, 10) || 0,
        enum: parseInt(dictionaryStats.rows[0].type_enum, 10) || 0,
        boolean: parseInt(dictionaryStats.rows[0].type_boolean, 10) || 0,
        string: parseInt(dictionaryStats.rows[0].type_string, 10) || 0,
      },
      by_category: byCategory,
    },
    coverage: {
      unique_params_covered: uniqueCovered,
      unique_params_uncovered: uniqueUncovered,
      coverage_percent: uniqueTotal > 0 ? Math.round((uniqueCovered / uniqueTotal) * 100) : 0,
      usages_covered: usagesCovered,
      usages_uncovered: usagesUncovered,
      coverage_by_usage_percent: usagesTotal > 0 ? Math.round((usagesCovered / usagesTotal) * 100) : 0,
    },
    normalization: {
      total_records: totalWithParams,
      normalized_records: normalized,
      not_normalized_records: notNormalized,
      normalization_percent: totalWithParams > 0 ? Math.round((normalized / totalWithParams) * 100) : 0,
    },
    top_uncovered: topUncovered,
  };

  return stats;
}

function printStatistics(stats: Statistics) {
  console.log("📊 СТАТИСТИКА ПО ПАРАМЕТРАМ\n");
  console.log("=".repeat(80));
  console.log(`Время сбора: ${new Date(stats.timestamp).toLocaleString('ru-RU')}\n`);

  // Main parameters
  console.log("📦 ПАРАМЕТРЫ В БД (main_parameters)");
  console.log("-".repeat(80));
  console.log(`Уникальных параметров: ${stats.main_parameters.unique_count}`);
  console.log(`Всего использований: ${stats.main_parameters.total_usages}`);
  console.log(`Записей с параметрами: ${stats.main_parameters.records_with_params}`);
  console.log(`Записей без параметров: ${stats.main_parameters.records_without_params}\n`);

  // Dictionary
  console.log("📚 СПРАВОЧНИК ПАРАМЕТРОВ");
  console.log("-".repeat(80));
  console.log(`Всего параметров: ${stats.dictionary.total_parameters}`);
  console.log(`Всего алиасов: ${stats.dictionary.total_aliases}`);
  console.log(`Среднее алиасов на параметр: ${stats.dictionary.avg_aliases_per_param}\n`);

  console.log("По типам:");
  console.log(`  • Числовые (number): ${stats.dictionary.by_type.number}`);
  console.log(`  • Перечисляемые (enum): ${stats.dictionary.by_type.enum}`);
  console.log(`  • Логические (boolean): ${stats.dictionary.by_type.boolean}`);
  console.log(`  • Строковые (string): ${stats.dictionary.by_type.string}\n`);

  console.log("По категориям:");
  Object.entries(stats.dictionary.by_category)
    .sort(([, a], [, b]) => b - a)
    .forEach(([category, count]) => {
      console.log(`  • ${category}: ${count}`);
    });
  console.log();

  // Coverage
  console.log("🎯 ПОКРЫТИЕ ПАРАМЕТРОВ");
  console.log("-".repeat(80));
  console.log(`Покрыто уникальных параметров: ${stats.coverage.unique_params_covered} из ${stats.coverage.unique_params_covered + stats.coverage.unique_params_uncovered}`);
  console.log(`Покрытие: ${stats.coverage.coverage_percent}%`);
  console.log(`\nПо частоте использования:`);
  console.log(`  Покрыто: ${stats.coverage.usages_covered} использований`);
  console.log(`  Непокрыто: ${stats.coverage.usages_uncovered} использований`);
  console.log(`  Покрытие: ${stats.coverage.coverage_by_usage_percent}%\n`);

  // Normalization
  console.log("🔄 НОРМАЛИЗАЦИЯ");
  console.log("-".repeat(80));
  console.log(`Всего записей с параметрами: ${stats.normalization.total_records}`);
  console.log(`Нормализовано: ${stats.normalization.normalized_records}`);
  console.log(`Не нормализовано: ${stats.normalization.not_normalized_records}`);
  console.log(`Процент нормализации: ${stats.normalization.normalization_percent}%\n`);

  // Top uncovered
  if (stats.top_uncovered.length > 0) {
    console.log("🔝 ТОП-10 НЕПОКРЫТЫХ ПАРАМЕТРОВ");
    console.log("-".repeat(80));
    stats.top_uncovered.forEach((param, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. "${param.key}" (${param.frequency} раз)`);
    });
    console.log();
  }

  console.log("=".repeat(80));
}

async function main() {
  const jsonOnly = process.argv.includes("--json");

  try {
    const stats = await collectStatistics();

    if (jsonOnly) {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      printStatistics(stats);
      console.log("\n💡 Для JSON формата используйте: --json");
    }
  } catch (error: any) {
    console.error("❌ Ошибка при сборе статистики:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

void main();
