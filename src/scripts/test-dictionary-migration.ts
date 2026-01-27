/**
 * Тест миграции на 100% словарный подход
 * 
 * Проверяет:
 * - Покрытие всех параметров из ParameterNameMapper
 * - Наличие всех алиасов
 * - Конверсию единиц измерения
 * - Готовность к удалению fallback
 * 
 * Запуск: npx tsx src/scripts/test-dictionary-migration.ts
 */

import "../config/env-loader";
import { ParameterDictionaryService } from "../normalization";
import { UnitParser } from "../normalization";
import { pgPool } from "../db/pg";

interface TestCase {
  alias: string;
  expectedKey: string;
  description: string;
}

// Все параметры из ParameterNameMapper + варианты
const testCases: TestCase[] = [
  // Глубина копания
  { alias: "глубина_копания", expectedKey: "excavation_depth_mm", description: "Основной русский" },
  { alias: "глубина копания", expectedKey: "excavation_depth_mm", description: "С пробелом" },
  { alias: "макс_глубина_копания", expectedKey: "excavation_depth_mm", description: "С префиксом макс" },
  { alias: "максимальная_глубина", expectedKey: "excavation_depth_mm", description: "Максимальная" },
  { alias: "depth", expectedKey: "excavation_depth_mm", description: "Английский" },
  { alias: "excavation_depth", expectedKey: "excavation_depth_mm", description: "Английский полный" },
  
  // Объем ковша
  { alias: "объем_ковша", expectedKey: "bucket_capacity_m3", description: "Основной русский" },
  { alias: "объём_ковша", expectedKey: "bucket_capacity_m3", description: "С ё" },
  { alias: "емкость_ковша", expectedKey: "bucket_capacity_m3", description: "Емкость" },
  { alias: "ёмкость_ковша", expectedKey: "bucket_capacity_m3", description: "Ёмкость" },
  { alias: "bucket", expectedKey: "bucket_capacity_m3", description: "Английский краткий" },
  { alias: "bucket_capacity", expectedKey: "bucket_capacity_m3", description: "Английский полный" },
  
  // Вес/Масса
  { alias: "вес", expectedKey: "operating_weight_t", description: "Вес" },
  { alias: "масса", expectedKey: "operating_weight_t", description: "Масса" },
  { alias: "рабочий_вес", expectedKey: "operating_weight_t", description: "Рабочий вес" },
  { alias: "рабочий вес", expectedKey: "operating_weight_t", description: "Рабочий вес с пробелом" },
  { alias: "тоннаж", expectedKey: "operating_weight_t", description: "Тоннаж" },
  { alias: "weight", expectedKey: "operating_weight_t", description: "Английский" },
  { alias: "operating_weight", expectedKey: "operating_weight_t", description: "Английский полный" },
  
  // Грузоподъемность
  { alias: "грузоподъемность", expectedKey: "lifting_capacity_t", description: "Основной" },
  { alias: "грузоподъёмность", expectedKey: "lifting_capacity_t", description: "С ё" },
  { alias: "подъемность", expectedKey: "lifting_capacity_t", description: "Краткий" },
  { alias: "capacity", expectedKey: "lifting_capacity_t", description: "Английский" },
  { alias: "lifting_capacity", expectedKey: "lifting_capacity_t", description: "Английский полный" },
  
  // Высота подъема
  { alias: "высота_подъема", expectedKey: "lifting_height_m", description: "Основной" },
  { alias: "высота подъема", expectedKey: "lifting_height_m", description: "С пробелом" },
  { alias: "макс_высота_подъема", expectedKey: "lifting_height_m", description: "С префиксом" },
  { alias: "высота", expectedKey: "lifting_height_m", description: "Краткий" },
  { alias: "lifting_height", expectedKey: "lifting_height_m", description: "Английский" },
  
  // Вылет стрелы
  { alias: "вылет_стрелы", expectedKey: "boom_reach_m", description: "Основной" },
  { alias: "вылет стрелы", expectedKey: "boom_reach_m", description: "С пробелом" },
  { alias: "макс_вылет", expectedKey: "boom_reach_m", description: "Краткий" },
  { alias: "reach", expectedKey: "boom_reach_m", description: "Английский" },
  
  // Мощность
  { alias: "мощность", expectedKey: "engine_power_kw", description: "Основной" },
  { alias: "мощность_двигателя", expectedKey: "engine_power_kw", description: "С уточнением" },
  { alias: "мощность двигателя", expectedKey: "engine_power_kw", description: "С пробелом" },
  { alias: "номинальная_мощность", expectedKey: "engine_power_kw", description: "Номинальная" },
  { alias: "номин_мощность", expectedKey: "engine_power_kw", description: "Номин" },
  { alias: "power", expectedKey: "engine_power_kw", description: "Английский" },
  { alias: "engine_power", expectedKey: "engine_power_kw", description: "Английский полный" },
  
  // Тип топлива
  { alias: "топливо", expectedKey: "fuel_type", description: "Краткий" },
  { alias: "тип_топлива", expectedKey: "fuel_type", description: "Полный" },
  { alias: "тип топлива", expectedKey: "fuel_type", description: "С пробелом" },
  { alias: "тип_питания", expectedKey: "fuel_type", description: "Альтернативный" },
  { alias: "тип питания", expectedKey: "fuel_type", description: "Альтернативный с пробелом" },
  { alias: "fuel", expectedKey: "fuel_type", description: "Английский" },
  { alias: "fuel_type", expectedKey: "fuel_type", description: "Английский полный" },
];

// Тесты конверсии единиц
interface UnitTestCase {
  param: string;
  value: string;
  expectedValue: number;
  description: string;
}

const unitTests: UnitTestCase[] = [
  // Вес: тонны → тонны
  { param: "вес", value: "20 тонн", expectedValue: 20, description: "20 тонн → 20 т" },
  { param: "масса", value: "25 т", expectedValue: 25, description: "25 т → 25 т" },
  
  // Мощность: л.с. → кВт
  { param: "мощность", value: "132 л.с.", expectedValue: 97.152, description: "132 л.с. → 97.152 кВт" },
  { param: "мощность", value: "100 кВт", expectedValue: 100, description: "100 кВт → 100 кВт" },
  
  // Глубина: м → мм
  { param: "глубина_копания", value: "5 м", expectedValue: 5000, description: "5 м → 5000 мм" },
  { param: "глубина_копания", value: "5000 мм", expectedValue: 5000, description: "5000 мм → 5000 мм" },
  
  // Объем: м³ → м³
  { param: "объем_ковша", value: "1.5 м³", expectedValue: 1.5, description: "1.5 м³ → 1.5 м³" },
  { param: "объем_ковша", value: "2 м3", expectedValue: 2, description: "2 м3 → 2 м³" },
];

async function testDictionaryMigration() {
  console.log("🧪 Тест миграции на 100% словарный подход\n");
  console.log("=".repeat(80) + "\n");

  const dictionaryService = new ParameterDictionaryService();
  const unitParser = new UnitParser();

  try {
    // Загружаем словарь
    console.log("📚 Загрузка справочника...");
    await dictionaryService.loadDictionary();
    const dictionary = dictionaryService.getDictionary();
    console.log(`✅ Загружено параметров: ${dictionary.length}\n`);

    // Подсчитываем статистику
    let totalAliases = 0;
    for (const param of dictionary) {
      totalAliases += param.aliases?.length ?? 0;
    }
    console.log(`📊 Статистика справочника:`);
    console.log(`   - Параметров: ${dictionary.length}`);
    console.log(`   - Всего алиасов: ${totalAliases}`);
    console.log(`   - Среднее алиасов: ${Math.round(totalAliases / dictionary.length)}\n`);

    console.log("=".repeat(80) + "\n");

    // =====================================================================
    // ТЕСТ 1: Покрытие алиасов
    // =====================================================================
    console.log("📝 ТЕСТ 1: Проверка покрытия алиасов\n");

    let found = 0;
    let notFound = 0;
    const notFoundList: string[] = [];

    for (const testCase of testCases) {
      const result = dictionaryService.findCanonicalKey(testCase.alias);
      if (result && result.key === testCase.expectedKey) {
        console.log(`✅ "${testCase.alias}" → ${result.key} (${testCase.description})`);
        found++;
      } else if (result) {
        console.log(
          `⚠️  "${testCase.alias}" → ${result.key} (ожидался ${testCase.expectedKey})`
        );
        notFound++;
        notFoundList.push(testCase.alias);
      } else {
        console.log(`❌ "${testCase.alias}" НЕ НАЙДЕН (${testCase.description})`);
        notFound++;
        notFoundList.push(testCase.alias);
      }
    }

    console.log(`\n📊 Результаты теста алиасов:`);
    console.log(`   ✅ Найдено: ${found}`);
    console.log(`   ❌ Не найдено: ${notFound}`);
    console.log(`   📈 Покрытие: ${Math.round((found / testCases.length) * 100)}%`);

    if (notFound > 0) {
      console.log(`\n⚠️  Непокрытые алиасы:`);
      notFoundList.forEach((alias) => console.log(`   - ${alias}`));
    }

    console.log("\n" + "=".repeat(80) + "\n");

    // =====================================================================
    // ТЕСТ 2: Конверсия единиц измерения
    // =====================================================================
    console.log("🔄 ТЕСТ 2: Проверка конверсии единиц измерения\n");

    let unitTestsPassed = 0;
    let unitTestsFailed = 0;

    for (const unitTest of unitTests) {
      const paramDef = dictionaryService.findCanonicalKey(unitTest.param);
      if (!paramDef) {
        console.log(`❌ Параметр "${unitTest.param}" не найден`);
        unitTestsFailed++;
        continue;
      }

      const parsed = unitParser.parseValue(unitTest.value, paramDef.unit || "");
      if (parsed !== null && Math.abs(parsed - unitTest.expectedValue) < 0.01) {
        console.log(
          `✅ ${unitTest.description} (${unitTest.value} → ${parsed} ${paramDef.unit})`
        );
        unitTestsPassed++;
      } else {
        console.log(
          `❌ ${unitTest.description} FAILED (ожидалось ${unitTest.expectedValue}, получено ${parsed})`
        );
        unitTestsFailed++;
      }
    }

    console.log(`\n📊 Результаты теста конверсии:`);
    console.log(`   ✅ Прошло: ${unitTestsPassed}`);
    console.log(`   ❌ Не прошло: ${unitTestsFailed}`);
    console.log(`   📈 Успешность: ${Math.round((unitTestsPassed / unitTests.length) * 100)}%`);

    console.log("\n" + "=".repeat(80) + "\n");

    // =====================================================================
    // ИТОГОВЫЙ ВЕРДИКТ
    // =====================================================================
    console.log("🎯 ИТОГОВЫЙ ВЕРДИКТ:\n");

    const aliasCoverage = (found / testCases.length) * 100;
    const unitCoverage = (unitTestsPassed / unitTests.length) * 100;

    if (aliasCoverage === 100 && unitCoverage === 100) {
      console.log("✅ ВСЕ ТЕСТЫ ПРОШЛИ!");
      console.log("🎉 Справочник полностью готов!");
      console.log("🚀 Можно удалять ParameterNameMapper!\n");
      process.exit(0);
    } else {
      console.log("⚠️  ЕСТЬ ПРОБЛЕМЫ:");
      if (aliasCoverage < 100) {
        console.log(`   - Покрытие алиасов: ${Math.round(aliasCoverage)}% (нужно 100%)`);
      }
      if (unitCoverage < 100) {
        console.log(`   - Конверсия единиц: ${Math.round(unitCoverage)}% (нужно 100%)`);
      }
      console.log("\n💡 Добавьте недостающие алиасы в справочник");
      console.log("📝 Запустите: npx tsx src/scripts/seed-parameter-dictionary-complete.ts\n");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("\n❌ ОШИБКА:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

// Запускаем тест
testDictionaryMigration();

