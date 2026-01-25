#!/usr/bin/env ts-node

/**
 * Диагностика текущего состояния параметров
 * 
 * Показывает:
 * - Сколько параметров в справочнике
 * - Сколько параметров в БД
 * - Текущее покрытие
 * - Топ непокрытых параметров
 * - Рекомендации по улучшению
 * 
 * Запуск: npx tsx src/scripts/diagnose-parameters-status.ts
 */

import "../config/env-loader";
import { pgPool } from "../db/pg";
import { ParameterDictionaryService } from "../normalization";
import { readFileSync } from "fs";
import { join } from "path";

interface ParameterStat {
  key: string;
  frequency: number;
}

async function diagnoseStatus() {
  console.log("🔍 ДИАГНОСТИКА СОСТОЯНИЯ ПАРАМЕТРОВ\n");
  console.log("=".repeat(80) + "\n");

  try {
    // 1. Загружаем справочник
    console.log("📚 Загрузка справочника параметров...");
    const dictionaryService = new ParameterDictionaryService();
    await dictionaryService.loadDictionary();
    const dictionary = dictionaryService.getDictionary();
    console.log(`✅ Загружено параметров в справочнике: ${dictionary.length}\n`);

    // 2. Получаем все параметры из БД
    console.log("📊 Анализ параметров в БД...");
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

    const dbParams: ParameterStat[] = dbParamsResult.rows.map(row => ({
      key: row.param_key,
      frequency: parseInt(row.frequency, 10) || 0,
    }));

    console.log(`✅ Найдено уникальных параметров в БД: ${dbParams.length}\n`);

    // 3. Проверяем покрытие
    console.log("🔍 Проверка покрытия...\n");
    
    const coverage = {
      covered: [] as Array<{ key: string; frequency: number; canonicalKey: string }>,
      uncovered: [] as Array<{ key: string; frequency: number }>,
    };

    let totalFrequency = 0;
    let coveredFrequency = 0;

    for (const dbParam of dbParams) {
      totalFrequency += dbParam.frequency;
      const paramDef = dictionaryService.findCanonicalKey(dbParam.key);
      
      if (paramDef) {
        coveredFrequency += dbParam.frequency;
        coverage.covered.push({
          key: dbParam.key,
          frequency: dbParam.frequency,
          canonicalKey: paramDef.key,
        });
      } else {
        coverage.uncovered.push({
          key: dbParam.key,
          frequency: dbParam.frequency,
        });
      }
    }

    // 4. Статистика
    console.log("=".repeat(80));
    console.log("📈 СТАТИСТИКА ПОКРЫТИЯ");
    console.log("=".repeat(80) + "\n");

    const coveragePercent = totalFrequency > 0 
      ? Math.round((coveredFrequency / totalFrequency) * 100) 
      : 0;
    
    const uniqueCoveragePercent = dbParams.length > 0
      ? Math.round((coverage.covered.length / dbParams.length) * 100)
      : 0;

    console.log(`Параметров в справочнике: ${dictionary.length}`);
    console.log(`Параметров в БД (уникальных): ${dbParams.length}`);
    console.log(`Покрыто уникальных параметров: ${coverage.covered.length} (${uniqueCoveragePercent}%)`);
    console.log(`Непокрыто уникальных параметров: ${coverage.uncovered.length} (${100 - uniqueCoveragePercent}%)`);
    console.log(`\nПокрытие по частоте использования: ${coveragePercent}%`);
    console.log(`   Покрыто: ${coveredFrequency} использований`);
    console.log(`   Непокрыто: ${totalFrequency - coveredFrequency} использований\n`);

    // 5. Топ непокрытых параметров
    if (coverage.uncovered.length > 0) {
      console.log("=".repeat(80));
      console.log("🔝 ТОП-20 НЕПОКРЫТЫХ ПАРАМЕТРОВ (по частоте)");
      console.log("=".repeat(80) + "\n");

      const topUncovered = coverage.uncovered
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 20);

      topUncovered.forEach((param, index) => {
        console.log(`${(index + 1).toString().padStart(2)}. "${param.key}"`);
        console.log(`    Встречается: ${param.frequency} раз`);
        console.log();
      });
    }

    // 6. Проверяем наличие файла анализа
    console.log("=".repeat(80));
    console.log("📄 ФАЙЛЫ АНАЛИЗА");
    console.log("=".repeat(80) + "\n");

    const analysisFile = join(process.cwd(), "parameter-analysis.json");
    try {
      const analysisData = JSON.parse(readFileSync(analysisFile, "utf-8"));
      console.log(`✅ Файл parameter-analysis.json найден`);
      console.log(`   Параметров в файле: ${analysisData.length}`);
      console.log(`   Последнее обновление: ${new Date(analysisFile).toLocaleString()}\n`);
    } catch (error) {
      console.log(`❌ Файл parameter-analysis.json не найден`);
      console.log(`   Запустите: npx tsx src/scripts/analyze-parameters.ts\n`);
    }

    // 7. Рекомендации
    console.log("=".repeat(80));
    console.log("💡 РЕКОМЕНДАЦИИ");
    console.log("=".repeat(80) + "\n");

    if (uniqueCoveragePercent < 90) {
      console.log("🎯 ЦЕЛЬ: Довести покрытие до 90%+ (190+ параметров из 204)\n");
      
      console.log("📋 ПЛАН ДЕЙСТВИЙ:\n");
      
      console.log("1️⃣  Обновить анализ параметров (если нужно):");
      console.log("   npx tsx src/scripts/analyze-parameters.ts\n");
      
      console.log("2️⃣  Сгенерировать недостающие параметры через LLM:");
      console.log("   MAX_PARAMS_TO_GENERATE=150 MIN_PARAM_FREQUENCY=2 \\");
      console.log("   npx tsx src/scripts/generate-dictionary.ts\n");
      
      console.log("3️⃣  Проверить результат:");
      console.log("   npx tsx src/scripts/analyze-unresolved-parameters.ts\n");
      
      console.log("4️⃣  Вручную добавить критичные параметры:");
      console.log("   Отредактировать: src/scripts/seed-parameter-dictionary-complete.ts\n");
      
      console.log("5️⃣  Пересчитать нормализацию:");
      console.log("   npx tsx src/scripts/normalize-parameters.ts\n");
    } else {
      console.log("✅ Покрытие уже хорошее! (>90%)");
      console.log("   Можно переходить к следующему этапу.\n");
    }

    // 8. Категоризация непокрытых
    if (coverage.uncovered.length > 0) {
      console.log("=".repeat(80));
      console.log("📂 КАТЕГОРИЗАЦИЯ НЕПОКРЫТЫХ ПАРАМЕТРОВ");
      console.log("=".repeat(80) + "\n");

      const categories = {
        technical: [] as Array<{ key: string; frequency: number }>,
        metadata: [] as Array<{ key: string; frequency: number }>,
        unknown: [] as Array<{ key: string; frequency: number }>,
      };

      const technicalKeywords = [
        'мощность', 'вес', 'масса', 'глубина', 'высота', 'длина', 'ширина',
        'объем', 'скорость', 'производительность', 'грузо', 'емкость',
        'вместимость', 'вылет', 'радиус', 'диаметр', 'давление', 'расход',
        'крутящий', 'обороты', 'трансмиссия', 'ходовая', 'гидравлика'
      ];

      const metadataKeywords = [
        'производитель', 'модель', 'серийн', 'артикул', 'код', 'url',
        'фото', 'картинка', 'изображ', 'дата', 'год', 'цвет', 'гарантия',
        'описание', 'контакт', 'телефон', 'email'
      ];

      for (const param of coverage.uncovered) {
        const keyLower = param.key.toLowerCase();
        
        if (technicalKeywords.some(kw => keyLower.includes(kw))) {
          categories.technical.push(param);
        } else if (metadataKeywords.some(kw => keyLower.includes(kw))) {
          categories.metadata.push(param);
        } else {
          categories.unknown.push(param);
        }
      }

      console.log(`🔧 Технические параметры (ВАЖНО добавить): ${categories.technical.length}`);
      if (categories.technical.length > 0) {
        categories.technical
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 10)
          .forEach(p => console.log(`   - "${p.key}" (${p.frequency} раз)`));
        if (categories.technical.length > 10) {
          console.log(`   ... и ещё ${categories.technical.length - 10}`);
        }
      }
      console.log();

      console.log(`📋 Метаданные (можно игнорировать): ${categories.metadata.length}`);
      if (categories.metadata.length > 0 && categories.metadata.length <= 10) {
        categories.metadata.forEach(p => console.log(`   - "${p.key}" (${p.frequency} раз)`));
      } else if (categories.metadata.length > 10) {
        categories.metadata.slice(0, 5).forEach(p => console.log(`   - "${p.key}" (${p.frequency} раз)`));
        console.log(`   ... и ещё ${categories.metadata.length - 5}`);
      }
      console.log();

      console.log(`❓ Неизвестные: ${categories.unknown.length}`);
      if (categories.unknown.length > 0 && categories.unknown.length <= 10) {
        categories.unknown
          .sort((a, b) => b.frequency - a.frequency)
          .forEach(p => console.log(`   - "${p.key}" (${p.frequency} раз)`));
      } else if (categories.unknown.length > 10) {
        categories.unknown
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 5)
          .forEach(p => console.log(`   - "${p.key}" (${p.frequency} раз)`));
        console.log(`   ... и ещё ${categories.unknown.length - 5}`);
      }
      console.log();
    }

    console.log("=".repeat(80));
    console.log("✨ Диагностика завершена");
    console.log("=".repeat(80) + "\n");

  } catch (error: any) {
    console.error("❌ Ошибка:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

// Запуск
diagnoseStatus();
