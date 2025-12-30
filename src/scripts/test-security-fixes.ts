/**
 * Тест для проверки исправлений безопасности и надежности
 * 
 * Запуск: npx tsx src/scripts/test-security-fixes.ts
 */

import { EquipmentRepository } from "../repository/equipment.repository";
import type { SearchQuery } from "../catalog";
import { pgPool } from "../db/pg";

async function runTests() {
console.log("🧪 Тест исправлений безопасности\n");
console.log("=" .repeat(60));

const repo = new EquipmentRepository();

// Тест 1: Валидация paramKey (защита от SQL инъекций)
console.log("\n1️⃣  Тест: Валидация имен параметров");
console.log("-".repeat(60));

// Создаем приватный метод через рефлексию для тестирования
// @ts-ignore - доступ к приватному методу для теста
const validateKey = repo['validateParameterKey'].bind(repo);

const testCases = [
  { key: "грузоподъемность", expected: true, desc: "Корректный ключ (кириллица)" },
  { key: "weight", expected: true, desc: "Корректный ключ (латиница)" },
  { key: "max_weight_123", expected: true, desc: "Корректный ключ с цифрами" },
  { key: "вес_кг", expected: true, desc: "Корректный ключ (кириллица + подчеркивание)" },
  { key: "'; DROP TABLE equipment; --", expected: false, desc: "SQL инъекция (классическая)" },
  { key: "weight OR 1=1", expected: false, desc: "SQL инъекция (с пробелами)" },
  { key: "weight; DELETE FROM", expected: false, desc: "SQL инъекция (с точкой с запятой)" },
  { key: "../../../etc/passwd", expected: false, desc: "Path traversal" },
  { key: "weight<script>", expected: false, desc: "XSS попытка" },
  { key: "", expected: false, desc: "Пустая строка" },
  { key: "a".repeat(200), expected: false, desc: "Слишком длинное имя (200 символов)" },
];

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = validateKey(test.key);
  const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
  
  if (result === test.expected) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`${status} | ${test.desc}`);
  if (result !== test.expected) {
    console.log(`       Ожидалось: ${test.expected}, получено: ${result}`);
    console.log(`       Ключ: "${test.key.substring(0, 50)}${test.key.length > 50 ? '...' : ''}"`);
  }
}

console.log("\n" + "-".repeat(60));
console.log(`Результат: ${passed} пройдено, ${failed} провалено\n`);

// Тест 2: Проверка обработки некорректных параметров в реальном запросе
console.log("\n2️⃣  Тест: Обработка вредоносных параметров в SearchQuery");
console.log("-".repeat(60));

const maliciousQueries: SearchQuery[] = [
  {
    text: "экскаватор",
    parameters: {
      "'; DROP TABLE equipment; --": "100",
    },
  },
  {
    text: "кран",
    parameters: {
      "weight_min": 50,
      "OR 1=1 --": "любое",
    },
  },
];

console.log("Попытка выполнить запрос с вредоносными параметрами...");
console.log("(Параметры должны быть пропущены с предупреждением)\n");

// Проверяем, что метод не падает и пропускает вредоносные ключи
try {
  // Перехватываем console.warn для проверки
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: any[]) => {
    warnings.push(args.join(' '));
  };
  
  // Выполняем запрос (он не должен упасть)
  await repo.fullTextSearch(maliciousQueries[0], 10);
  
  console.warn = originalWarn;
  
  // Проверяем, что было выведено предупреждение
  const hasSecurityWarning = warnings.some(w => w.includes("[Security]"));
  
  if (hasSecurityWarning) {
    console.log("✅ PASS | Вредоносный параметр был обнаружен и пропущен");
    console.log(`   Предупреждение: ${warnings.find(w => w.includes("[Security]"))}`);
  } else {
    console.log("❌ FAIL | Предупреждение о безопасности не было выведено");
  }
} catch (err: any) {
  console.log("❌ FAIL | Запрос завершился с ошибкой (не должно было произойти)");
  console.error(`   Ошибка: ${err.message}`);
}

console.log("\n" + "=".repeat(60));
console.log("\n3️⃣  Тест: Обработчики событий pgPool");
console.log("-".repeat(60));

// Проверяем, что обработчики установлены
const errorListeners = pgPool.listenerCount('error');
const connectListeners = pgPool.listenerCount('connect');
const removeListeners = pgPool.listenerCount('remove');

console.log(`Обработчики 'error': ${errorListeners}`);
console.log(`Обработчики 'connect': ${connectListeners}`);
console.log(`Обработчики 'remove': ${removeListeners}`);

if (errorListeners > 0) {
  console.log("\n✅ PASS | Обработчик 'error' установлен");
} else {
  console.log("\n❌ FAIL | Обработчик 'error' не найден");
}

if (connectListeners > 0) {
  console.log("✅ PASS | Обработчик 'connect' установлен");
} else {
  console.log("⚠️  WARN | Обработчик 'connect' не найден (опционально)");
}

if (removeListeners > 0) {
  console.log("✅ PASS | Обработчик 'remove' установлен");
} else {
  console.log("⚠️  WARN | Обработчик 'remove' не найден (опционально)");
}

// Проверяем настройки пула
const poolConfig = (pgPool as any).options;
console.log("\n" + "-".repeat(60));
console.log("Настройки пула соединений:");
console.log(`  max: ${poolConfig.max ?? 'не задано'}`);
console.log(`  idleTimeoutMillis: ${poolConfig.idleTimeoutMillis ?? 'не задано'}`);
console.log(`  connectionTimeoutMillis: ${poolConfig.connectionTimeoutMillis ?? 'не задано'}`);
console.log(`  query_timeout: ${poolConfig.query_timeout ?? 'не задано'}`);

const hasAllSettings = 
  poolConfig.max === 20 &&
  poolConfig.idleTimeoutMillis === 30000 &&
  poolConfig.connectionTimeoutMillis === 5000 &&
  poolConfig.query_timeout === 10000;

if (hasAllSettings) {
  console.log("\n✅ PASS | Все настройки надежности установлены корректно");
} else {
  console.log("\n⚠️  WARN | Некоторые настройки отличаются от ожидаемых");
}

console.log("\n" + "=".repeat(60));
console.log("\n✅ Тесты завершены!\n");

// Закрываем пул
await pgPool.end();
}

// Запускаем тесты
runTests().catch((err) => {
  console.error("❌ Ошибка при выполнении тестов:", err);
  process.exit(1);
});

