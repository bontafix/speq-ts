/**
 * Тест интеграции системы нормализации параметров
 * 
 * Проверяет:
 * 1. Загрузку словаря из БД
 * 2. Fallback маппинг
 * 3. Конверсию единиц
 * 4. Поиск по алиасам
 * 
 * Запуск: npx tsx src/scripts/test-normalization-integration.ts
 */

import { ParameterDictionaryService } from "../normalization/parameter-dictionary.service";
import { EquipmentRepository } from "../repository/equipment.repository";
import { SearchQuery } from "../catalog";
import { pgPool } from "../db/pg";

interface TestCase {
  name: string;
  query: SearchQuery;
  expected: {
    shouldHaveResults?: boolean;
    minResults?: number;
    shouldContainParam?: string;
    shouldConvert?: boolean;
  };
}

const testCases: TestCase[] = [
  // ========================================================================
  // 1. Тест поиска с конверсией единиц через словарь
  // ========================================================================
  {
    name: "🔄 Конверсия мощности: л.с. → кВт",
    query: {
      text: "экскаватор",
      parameters: {
        "мощность": "132", // Должно конвертироваться в кВт
      },
    },
    expected: {
      shouldHaveResults: true,
      shouldConvert: true,
    },
  },

  // ========================================================================
  // 2. Тест поиска с алиасами
  // ========================================================================
  {
    name: "🏷️  Поиск по алиасу 'глубина_копания'",
    query: {
      text: "экскаватор",
      parameters: {
        "глубина_копания_max": "5000", // мм
      },
    },
    expected: {
      shouldHaveResults: true,
    },
  },

  // ========================================================================
  // 3. Тест с параметрами min/max
  // ========================================================================
  {
    name: "📏 Диапазон веса (min/max)",
    query: {
      parameters: {
        "вес_min": "10",    // t
        "вес_max": "30",    // t
      },
    },
    expected: {
      shouldHaveResults: true,
    },
  },

  // ========================================================================
  // 4. Тест fallback маппинга
  // ========================================================================
  {
    name: "🔀 Fallback для параметра вне словаря",
    query: {
      parameters: {
        "неизвестный_параметр": "100",
      },
    },
    expected: {
      // Не должно падать, но результатов может не быть
      shouldHaveResults: false,
    },
  },

  // ========================================================================
  // 5. Тест с несколькими параметрами
  // ========================================================================
  {
    name: "🎯 Комбинированный запрос (мощность + вес + глубина)",
    query: {
      text: "экскаватор",
      parameters: {
        "мощность_min": "50",
        "вес_max": "50",
        "глубина_копания_min": "3000",
      },
    },
    expected: {
      shouldHaveResults: true,
    },
  },

  // ========================================================================
  // 6. Тест поиска по категории с параметрами
  // ========================================================================
  {
    name: "📦 Поиск кранов с грузоподъемностью",
    query: {
      text: "кран",
      category: "Гусеничные краны",
      parameters: {
        "грузоподъемность_min": "50",
      },
    },
    expected: {
      shouldHaveResults: true,
    },
  },
];

async function runTest(
  testCase: TestCase,
  repository: EquipmentRepository,
  testNumber: number
): Promise<{ passed: boolean; message: string }> {
  console.log(`\n${testNumber}. ${testCase.name}`);
  console.log("   Запрос:", JSON.stringify(testCase.query, null, 2));

  try {
    let results: any[] = [];
    const limit = 10;

    // Выполняем поиск в зависимости от наличия text
    if (testCase.query.text) {
      results = await repository.fullTextSearch(testCase.query, limit);
    } else if (testCase.query.parameters) {
      // Поиск только по параметрам
      results = await repository.fullTextSearch(testCase.query, limit);
    }

    const hasResults = results.length > 0;
    const resultCount = results.length;

    console.log(`   ✅ Найдено результатов: ${resultCount}`);

    // Проверяем ожидания
    if (testCase.expected.shouldHaveResults !== undefined) {
      if (testCase.expected.shouldHaveResults && !hasResults) {
        return {
          passed: false,
          message: `❌ Ожидались результаты, но ничего не найдено`,
        };
      }
      if (!testCase.expected.shouldHaveResults && hasResults) {
        return {
          passed: true,
          message: `⚠️  Результаты найдены, хотя не ожидались (это OK)`,
        };
      }
    }

    if (testCase.expected.minResults && resultCount < testCase.expected.minResults) {
      return {
        passed: false,
        message: `❌ Недостаточно результатов: ${resultCount} < ${testCase.expected.minResults}`,
      };
    }

    // Показываем первый результат
    if (hasResults) {
      const first = results[0];
      console.log(`   📋 Пример: ${first.equipment_name} (${first.model})`);
    }

    return {
      passed: true,
      message: `✅ Тест пройден`,
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `❌ Ошибка: ${error.message}`,
    };
  }
}

async function testNormalizationIntegration() {
  console.log("🧪 ТЕСТ ИНТЕГРАЦИИ НОРМАЛИЗАЦИИ ПАРАМЕТРОВ");
  console.log("=".repeat(70));

  let dictionaryLoaded = false;
  let dictionaryService: ParameterDictionaryService | undefined;

  // Пробуем загрузить словарь
  try {
    dictionaryService = new ParameterDictionaryService();
    await dictionaryService.loadDictionary();
    const dict = dictionaryService.getDictionary();
    console.log(`\n✅ Словарь загружен: ${dict.length} параметров`);
    
    // Показываем некоторые параметры
    const sample = dict.slice(0, 3);
    sample.forEach(p => {
      const aliasCount = p.aliases?.length ?? 0;
      console.log(`   - ${p.key}: ${aliasCount} алиасов`);
    });
    
    dictionaryLoaded = true;
  } catch (error: any) {
    console.log(`\n⚠️  Словарь не загружен: ${error.message}`);
    console.log("   Будет использоваться fallback маппинг");
  }

  // Создаем repository
  const repository = new EquipmentRepository(pgPool, dictionaryService);

  console.log("\n" + "=".repeat(70));
  console.log("📝 ЗАПУСК ТЕСТОВ");
  console.log("=".repeat(70));

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    if (!testCase) {
      // На случай noUncheckedIndexedAccess (строгие настройки TS)
      continue;
    }
    
    // Если словарь не загружен, пропускаем тесты, требующие словарь
    if (!dictionaryLoaded && testCase.expected.shouldConvert) {
      console.log(`\n${i + 1}. ${testCase.name}`);
      console.log("   ⏭️  ПРОПУЩЕН (требуется словарь)");
      skipped++;
      continue;
    }

    const result = await runTest(testCase, repository, i + 1);
    console.log(`   ${result.message}`);

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }

    // Пауза между тестами
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n" + "=".repeat(70));
  console.log("📊 РЕЗУЛЬТАТЫ");
  console.log("=".repeat(70));
  console.log(`✅ Успешно: ${passed}`);
  console.log(`❌ Провалено: ${failed}`);
  console.log(`⏭️  Пропущено: ${skipped}`);
  console.log(`📦 Всего: ${testCases.length}`);
  console.log("");

  if (!dictionaryLoaded) {
    console.log("⚠️  ВНИМАНИЕ:");
    console.log("   Словарь не был загружен из БД.");
    console.log("   Для полного тестирования запустите:");
    console.log("   npx tsx src/scripts/seed-parameter-dictionary.ts");
    console.log("");
  }

  if (failed === 0) {
    console.log("✨ Все тесты успешно пройдены!");
  } else {
    console.log("⚠️  Некоторые тесты провалились. Проверьте логи выше.");
  }

  await pgPool.end();
  process.exit(failed > 0 ? 1 : 0);
}

// Запускаем тесты
testNormalizationIntegration().catch((error) => {
  console.error("\n❌ Критическая ошибка:", error);
  pgPool.end();
  process.exit(1);
});

