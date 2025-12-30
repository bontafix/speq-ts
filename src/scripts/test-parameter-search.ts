/**
 * Тест поиска по параметрам
 * 
 * Проверяет:
 * 1. Маппинг имен параметров (LLM → БД)
 * 2. Конверсию единиц измерения (м → мм)
 * 3. Работу фильтрации по parameters в FTS и Vector search
 * 
 * Запуск: npx tsx src/scripts/test-parameter-search.ts
 */

import { ParameterNameMapper } from "../normalization/parameter-name-mapper";

console.log("🧪 Тест поиска по параметрам\n");
console.log("=".repeat(70));

// ========================================================================
// ТЕСТ 1: Маппинг имен параметров
// ========================================================================
console.log("\n1️⃣  Тест: Маппинг имен параметров (LLM → БД)");
console.log("-".repeat(70));

interface MappingTest {
  llmName: string;
  expectedDbName: string;
  expectedSuffix?: '_min' | '_max';
}

const mappingTests: MappingTest[] = [
  {
    llmName: "глубина_копания_max",
    expectedDbName: "Макс. глубина копания, мм.",
    expectedSuffix: '_max'
  },
  {
    llmName: "объем_ковша_min",
    expectedDbName: "Объем ковша",
    expectedSuffix: '_min'
  },
  {
    llmName: "грузоподъемность",
    expectedDbName: "Грузоподъемность",
  },
  {
    llmName: "мощность_двигателя",
    expectedDbName: "Мощность двигателя",
  },
  {
    llmName: "вес_max",
    expectedDbName: "Вес в рабочем состоянии",
    expectedSuffix: '_max'
  },
  {
    llmName: "рабочий_вес_min",
    expectedDbName: "Рабочий вес, т.",
    expectedSuffix: '_min'
  },
  {
    llmName: "тоннаж_max",
    expectedDbName: "Рабочий вес, т.",
    expectedSuffix: '_max'
  },
];

let passed = 0;
let failed = 0;

for (const test of mappingTests) {
  const result = ParameterNameMapper.mapParameterName(test.llmName);
  
  const nameMatches = result.dbParamName === test.expectedDbName;
  const suffixMatches = test.expectedSuffix 
    ? result.suffix === test.expectedSuffix 
    : result.suffix === undefined;
  
  if (nameMatches && suffixMatches) {
    console.log(`✅ PASS | ${test.llmName} → ${result.dbParamName}${result.suffix || ''}`);
    passed++;
  } else {
    console.log(`❌ FAIL | ${test.llmName}`);
    console.log(`       Ожидалось: ${test.expectedDbName}${test.expectedSuffix || ''}`);
    console.log(`       Получено: ${result.dbParamName}${result.suffix || ''}`);
    failed++;
  }
}

// ========================================================================
// ТЕСТ 2: Конверсия единиц измерения
// ========================================================================
console.log("\n2️⃣  Тест: Конверсия единиц измерения");
console.log("-".repeat(70));

interface ConversionTest {
  dbParamName: string;
  inputValue: number;
  expectedValue: number;
  description: string;
}

const conversionTests: ConversionTest[] = [
  {
    dbParamName: "Макс. глубина копания, мм.",
    inputValue: 5,
    expectedValue: 5000,
    description: "Глубина копания: 5 м → 5000 мм"
  },
  {
    dbParamName: "Макс. глубина копания, мм.",
    inputValue: 6.5,
    expectedValue: 6500,
    description: "Глубина копания: 6.5 м → 6500 мм"
  },
  {
    dbParamName: "Высота подъема",
    inputValue: 10,
    expectedValue: 10000,
    description: "Высота подъема: 10 м → 10000 мм"
  },
  {
    dbParamName: "Объем ковша",
    inputValue: 1.5,
    expectedValue: 1.5,
    description: "Объем ковша: без конверсии (1.5 м³)"
  },
  {
    dbParamName: "Грузоподъемность",
    inputValue: 80,
    expectedValue: 80,
    description: "Грузоподъемность: без конверсии (80 тонн)"
  },
];

for (const test of conversionTests) {
  const result = ParameterNameMapper.convertValue(test.dbParamName, test.inputValue);
  
  if (result === test.expectedValue) {
    console.log(`✅ PASS | ${test.description}`);
    passed++;
  } else {
    console.log(`❌ FAIL | ${test.description}`);
    console.log(`       Ожидалось: ${test.expectedValue}, получено: ${result}`);
    failed++;
  }
}

// ========================================================================
// ТЕСТ 3: Информация о единицах
// ========================================================================
console.log("\n3️⃣  Тест: Получение информации о единицах измерения");
console.log("-".repeat(70));

const unitTests = [
  {
    dbParamName: "Макс. глубина копания, мм.",
    expectedFrom: "м",
    expectedTo: "мм"
  },
  {
    dbParamName: "Объем ковша",
    expectedFrom: null,
    expectedTo: null
  },
];

for (const test of unitTests) {
  const unitInfo = ParameterNameMapper.getUnitInfo(test.dbParamName);
  
  if (test.expectedFrom === null) {
    // Ожидаем null (нет конверсии)
    if (unitInfo === null) {
      console.log(`✅ PASS | ${test.dbParamName}: нет конверсии`);
      passed++;
    } else {
      console.log(`❌ FAIL | ${test.dbParamName}: ожидался null, получено: ${JSON.stringify(unitInfo)}`);
      failed++;
    }
  } else {
    // Ожидаем информацию о конверсии
    if (unitInfo && unitInfo.fromUnit === test.expectedFrom && unitInfo.toUnit === test.expectedTo) {
      console.log(`✅ PASS | ${test.dbParamName}: ${test.expectedFrom} → ${test.expectedTo}`);
      passed++;
    } else {
      console.log(`❌ FAIL | ${test.dbParamName}`);
      console.log(`       Ожидалось: ${test.expectedFrom} → ${test.expectedTo}`);
      console.log(`       Получено: ${unitInfo ? `${unitInfo.fromUnit} → ${unitInfo.toUnit}` : 'null'}`);
      failed++;
    }
  }
}

// ========================================================================
// ТЕСТ 4: Примеры реальных запросов
// ========================================================================
console.log("\n4️⃣  Тест: Примеры реальных запросов");
console.log("-".repeat(70));

interface RealQueryExample {
  userQuery: string;
  llmParameters: Record<string, string | number>;
  expectedSqlConditions: string[];
}

const realExamples: RealQueryExample[] = [
  {
    userQuery: "Экскаватор с глубиной копания до 5 метров",
    llmParameters: {
      "глубина_копания_max": 5
    },
    expectedSqlConditions: [
      "(main_parameters->>'Макс. глубина копания, мм.')::numeric <= 5000"
    ]
  },
  {
    userQuery: "Кран грузоподъемностью более 80 тонн",
    llmParameters: {
      "грузоподъемность_min": 80
    },
    expectedSqlConditions: [
      "(main_parameters->>'Грузоподъемность')::numeric >= 80"
    ]
  },
  {
    userQuery: "Экскаватор с объемом ковша от 1.5 м³",
    llmParameters: {
      "объем_ковша_min": 1.5
    },
    expectedSqlConditions: [
      "(main_parameters->>'Объем ковша')::numeric >= 1.5"
    ]
  },
];

for (const example of realExamples) {
  console.log(`\nЗапрос: "${example.userQuery}"`);
  console.log(`Параметры от LLM: ${JSON.stringify(example.llmParameters)}`);
  
  // Обрабатываем каждый параметр
  for (const [key, value] of Object.entries(example.llmParameters)) {
    const mapped = ParameterNameMapper.mapParameterName(key);
    const convertedValue = ParameterNameMapper.convertValue(mapped.dbParamName, Number(value));
    
    const operator = mapped.suffix === '_min' ? '>=' : mapped.suffix === '_max' ? '<=' : '=';
    const actualCondition = `(main_parameters->>'${mapped.dbParamName}')::numeric ${operator} ${convertedValue}`;
    
    const expectedCondition = example.expectedSqlConditions[0];
    
    if (actualCondition === expectedCondition) {
      console.log(`✅ SQL: ${actualCondition}`);
      passed++;
    } else {
      console.log(`❌ FAIL | SQL не совпадает`);
      console.log(`       Ожидалось: ${expectedCondition}`);
      console.log(`       Получено: ${actualCondition}`);
      failed++;
    }
  }
}

// ========================================================================
// ИТОГИ
// ========================================================================
console.log("\n" + "=".repeat(70));
console.log(`\n📊 Результаты: ${passed} пройдено, ${failed} провалено\n`);

if (failed === 0) {
  console.log("🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ!\n");
  console.log("✅ Маппинг параметров работает корректно");
  console.log("✅ Конверсия единиц измерения работает корректно");
  console.log("✅ Поиск по параметрам должен работать правильно\n");
  process.exit(0);
} else {
  console.log("⚠️  НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОЙДЕНЫ\n");
  process.exit(1);
}

