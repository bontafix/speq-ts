/**
 * Тест качества формирования SearchQuery от LLM
 * 
 * Проверяет:
 * 1. Корректное извлечение всех полей (text, category, brand, region, parameters)
 * 2. Правильную обработку диапазонов (_min, _max)
 * 3. Валидацию и нормализацию данных
 * 
 * Запуск: npx tsx src/scripts/test-search-query-quality.ts
 */

import { SearchQueryValidator } from "../llm/search-query.validator";
import type { SearchQuery } from "../catalog";

console.log("🧪 Тест качества формирования SearchQuery\n");
console.log("=".repeat(70));

interface TestCase {
  name: string;
  input: any;
  expected: Partial<SearchQuery>;
  shouldFail?: boolean;
}

const testCases: TestCase[] = [
  // ========================================================================
  // Позитивные тесты
  // ========================================================================
  {
    name: "Полный запрос с всеми полями",
    input: {
      text: "экскаватор гусеничный",
      category: "Экскаватор",
      subcategory: "Гусеничный",
      brand: "Caterpillar",
      region: "Москва",
      parameters: {
        грузоподъемность_min: 80,
        объем_ковша: 1.5,
      },
      limit: 20,
    },
    expected: {
      text: "экскаватор гусеничный",
      category: "Экскаватор",
      subcategory: "Гусеничный",
      brand: "Caterpillar",
      region: "Москва",
      parameters: {
        грузоподъемность_min: 80,
        объем_ковша: 1.5,
      },
      limit: 20,
    },
  },
  {
    name: "Только text и параметры",
    input: {
      text: "кран башенный",
      parameters: {
        грузоподъемность_min: 100,
        высота_подъема_max: 50,
      },
    },
    expected: {
      text: "кран башенный",
      parameters: {
        грузоподъемность_min: 100,
        высота_подъема_max: 50,
      },
    },
  },
  {
    name: "Только category и brand",
    input: {
      category: "Бульдозер",
      brand: "Komatsu",
    },
    expected: {
      category: "Бульдозер",
      brand: "Komatsu",
    },
  },
  {
    name: "Limit как строка (нормализация)",
    input: {
      text: "погрузчик",
      limit: "15",
    },
    expected: {
      text: "погрузчик",
      limit: 15,
    },
  },
  {
    name: "Limit за пределами (нормализация 1-100)",
    input: {
      text: "экскаватор",
      limit: 500,
    },
    expected: {
      text: "экскаватор",
      limit: 100, // Ограничен до 100
    },
  },
  {
    name: "Пробелы в строках (обрезка)",
    input: {
      text: "  кран  ",
      category: "  Кран  ",
      brand: "  Caterpillar  ",
    },
    expected: {
      text: "кран",
      category: "Кран",
      brand: "Caterpillar",
    },
  },
  {
    name: "Параметры с разными типами",
    input: {
      text: "техника",
      parameters: {
        мощность: 150,
        тип_двигателя: "дизель",
        вес_min: 5,
      },
    },
    expected: {
      text: "техника",
      parameters: {
        мощность: 150,
        тип_двигателя: "дизель",
        вес_min: 5,
      },
    },
  },

  // ========================================================================
  // Негативные тесты (фильтрация некорректных данных)
  // ========================================================================
  {
    name: "Некорректное имя параметра (SQL injection попытка)",
    input: {
      text: "экскаватор",
      parameters: {
        "грузоподъемность": 80,
        "'; DROP TABLE equipment; --": 100, // Должно быть отфильтровано
      },
    },
    expected: {
      text: "экскаватор",
      parameters: {
        грузоподъемность: 80,
        // SQL injection параметр удален
      },
    },
  },
  {
    name: "Некорректный тип для text (не строка)",
    input: {
      text: 12345, // Число вместо строки
      category: "Кран",
    },
    expected: {
      category: "Кран",
      // text должен быть проигнорирован
    },
  },
  {
    name: "Некорректный тип для limit (строка с буквами)",
    input: {
      text: "экскаватор",
      limit: "много", // Не число
    },
    expected: {
      text: "экскаватор",
      // limit проигнорирован
    },
  },
  {
    name: "Параметры с некорректными значениями",
    input: {
      text: "кран",
      parameters: {
        грузоподъемность: NaN, // Некорректное число
        объем: Infinity, // Некорректное число
        тип: "башенный", // Это OK
      },
    },
    expected: {
      text: "кран",
      parameters: {
        тип: "башенный",
        // NaN и Infinity отфильтрованы
      },
    },
  },
  {
    name: "Пустые строки (должны игнорироваться)",
    input: {
      text: "",
      category: "   ",
      brand: "Caterpillar",
    },
    expected: {
      brand: "Caterpillar",
      // Пустые text и category игнорируются
    },
  },
  {
    name: "Слишком длинные строки (обрезка)",
    input: {
      text: "a".repeat(600), // Больше 500
      category: "b".repeat(150), // Больше 100
    },
    expected: {
      text: "a".repeat(500), // Обрезано до 500
      category: "b".repeat(100), // Обрезано до 100
    },
  },

  // ========================================================================
  // Граничные случаи
  // ========================================================================
  {
    name: "Пустой объект",
    input: {},
    expected: {},
    shouldFail: true, // Должен упасть, т.к. нет ни одного поля
  },
  {
    name: "Null вместо объекта",
    input: null,
    expected: {},
    shouldFail: true,
  },
  {
    name: "parameters не объект (массив)",
    input: {
      text: "экскаватор",
      parameters: [1, 2, 3], // Массив, а не объект
    },
    expected: {
      text: "экскаватор",
      // parameters игнорируется
    },
  },
];

let passed = 0;
let failed = 0;

for (const test of testCases) {
  try {
    const result = SearchQueryValidator.validate(test.input);
    
    if (test.shouldFail) {
      console.log(`❌ FAIL | ${test.name}`);
      console.log(`       Ожидалась ошибка, но валидация прошла`);
      console.log(`       Результат: ${JSON.stringify(result)}`);
      failed++;
      continue;
    }

    // Проверяем соответствие expected
    let isValid = true;
    const issues: string[] = [];

    // Проверяем каждое ожидаемое поле
    for (const [key, expectedValue] of Object.entries(test.expected)) {
      const actualValue = (result as any)[key];
      
      if (key === "parameters" && typeof expectedValue === "object") {
        // Для parameters проверяем каждый ключ
        for (const [paramKey, paramValue] of Object.entries(expectedValue as Record<string, any>)) {
          const actualParam = actualValue?.[paramKey];
          if (actualParam !== paramValue) {
            isValid = false;
            issues.push(`parameters.${paramKey}: ожидалось ${paramValue}, получено ${actualParam}`);
          }
        }
        // Проверяем, что нет лишних ключей
        if (actualValue) {
          for (const paramKey of Object.keys(actualValue)) {
            if (!(paramKey in (expectedValue as Record<string, any>))) {
              issues.push(`parameters.${paramKey}: неожиданный параметр ${actualValue[paramKey]}`);
            }
          }
        }
      } else if (actualValue !== expectedValue) {
        isValid = false;
        issues.push(`${key}: ожидалось ${JSON.stringify(expectedValue)}, получено ${JSON.stringify(actualValue)}`);
      }
    }

    // Проверяем, что нет лишних полей в result
    for (const key of Object.keys(result)) {
      if (!(key in test.expected)) {
        issues.push(`${key}: неожиданное поле ${JSON.stringify((result as any)[key])}`);
      }
    }

    if (isValid && issues.length === 0) {
      console.log(`✅ PASS | ${test.name}`);
      passed++;
    } else {
      console.log(`❌ FAIL | ${test.name}`);
      issues.forEach(issue => console.log(`       ${issue}`));
      failed++;
    }
  } catch (error: any) {
    if (test.shouldFail) {
      console.log(`✅ PASS | ${test.name} (корректно выбросила ошибку)`);
      passed++;
    } else {
      console.log(`❌ FAIL | ${test.name}`);
      console.log(`       Неожиданная ошибка: ${error.message}`);
      failed++;
    }
  }
}

console.log("\n" + "=".repeat(70));
console.log(`\n📊 Результаты: ${passed} пройдено, ${failed} провалено\n`);

if (failed === 0) {
  console.log("🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ!\n");
  process.exit(0);
} else {
  console.log("⚠️  НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОЙДЕНЫ\n");
  process.exit(1);
}

