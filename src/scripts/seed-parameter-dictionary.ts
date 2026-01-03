/**
 * Скрипт для заполнения таблицы parameter_dictionary
 * 
 * Создает справочник параметров с:
 * - Canonical keys (power_kw, weight_kg, etc)
 * - Алиасами (мощность, вес, etc)
 * - Единицами измерения
 * - SQL expressions для поиска в БД
 * 
 * Запуск: npx tsx src/scripts/seed-parameter-dictionary.ts
 */

import "dotenv/config";
import { pgPool } from "../db/pg";

interface ParameterEntry {
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

const parameters: ParameterEntry[] = [
  // ========================================================================
  // ЭКСКАВАТОРЫ
  // ========================================================================
  {
    key: "excavation_depth_mm",
    label_ru: "Глубина копания",
    description_ru: "Максимальная глубина копания в миллиметрах",
    category: "excavator",
    param_type: "number",
    unit: "mm",
    min_value: 1000,
    max_value: 20000,
    aliases: [
      "глубина_копания",
      "макс_глубина_копания",
      "максимальная_глубина",
      "depth",
      "excavation_depth",
      "Макс. глубина копания, мм."
    ],
    sql_expression: "main_parameters->>'Макс. глубина копания, мм.'",
    priority: 1,
  },
  {
    key: "bucket_capacity_m3",
    label_ru: "Объем ковша",
    description_ru: "Объем ковша в кубических метрах",
    category: "excavator",
    param_type: "number",
    unit: "m3",
    min_value: 0.1,
    max_value: 10.0,
    aliases: [
      "объем_ковша",
      "объём_ковша",
      "емкость_ковша",
      "ёмкость_ковша",
      "bucket",
      "bucket_capacity",
      "Объем ковша"
    ],
    sql_expression: "main_parameters->>'Объем ковша'",
    priority: 1,
  },
  {
    key: "operating_weight_t",
    label_ru: "Рабочий вес",
    description_ru: "Вес в рабочем состоянии в тоннах",
    category: "excavator",
    param_type: "number",
    unit: "t",
    min_value: 1,
    max_value: 200,
    aliases: [
      "вес",
      "масса",
      "рабочий_вес",
      "вес_в_рабочем_состоянии",
      "operating_weight",
      "weight",
      "Вес в рабочем состоянии",
      "Рабочий вес, т."
    ],
    sql_expression: "main_parameters->>'Вес в рабочем состоянии'",
    priority: 1,
  },

  // ========================================================================
  // КРАНЫ
  // ========================================================================
  {
    key: "lifting_capacity_t",
    label_ru: "Грузоподъемность",
    description_ru: "Грузоподъемность в тоннах",
    category: "crane",
    param_type: "number",
    unit: "t",
    min_value: 1,
    max_value: 1000,
    aliases: [
      "грузоподъемность",
      "грузоподъёмность",
      "подъемность",
      "capacity",
      "lifting_capacity",
      "Грузоподъемность"
    ],
    sql_expression: "main_parameters->>'Грузоподъемность'",
    priority: 1,
  },
  {
    key: "boom_length_m",
    label_ru: "Длина стрелы",
    description_ru: "Длина стрелы в метрах",
    category: "crane",
    param_type: "number",
    unit: "m",
    min_value: 5,
    max_value: 100,
    aliases: [
      "длина_стрелы",
      "стрела",
      "boom_length",
      "boom",
      "Длина стрелы"
    ],
    sql_expression: "main_parameters->>'Длина стрелы'",
    priority: 2,
  },
  {
    key: "lifting_height_m",
    label_ru: "Высота подъема",
    description_ru: "Максимальная высота подъема в метрах",
    category: "crane",
    param_type: "number",
    unit: "m",
    min_value: 10,
    max_value: 200,
    aliases: [
      "высота_подъема",
      "макс_высота",
      "высота",
      "lifting_height",
      "height",
      "Высота подъема"
    ],
    sql_expression: "main_parameters->>'Высота подъема'",
    priority: 2,
  },

  // ========================================================================
  // ОБЩИЕ ПАРАМЕТРЫ
  // ========================================================================
  {
    key: "engine_power_kw",
    label_ru: "Мощность двигателя",
    description_ru: "Мощность двигателя в киловаттах",
    category: "common",
    param_type: "number",
    unit: "kw",
    min_value: 10,
    max_value: 1000,
    aliases: [
      "мощность",
      "мощность_двигателя",
      "номинальная_мощность",
      "номин_мощность",
      "power",
      "engine_power",
      "Мощность двигателя",
      "Номин. мощность, кВт."
    ],
    sql_expression: "main_parameters->>'Мощность двигателя'",
    priority: 1,
  },
  {
    key: "fuel_type",
    label_ru: "Тип топлива",
    description_ru: "Тип используемого топлива",
    category: "common",
    param_type: "enum",
    enum_values: {
      diesel: "Дизель",
      gasoline: "Бензин",
      electric: "Электрический",
      hybrid: "Гибрид",
      gas: "Газ",
    },
    aliases: [
      "топливо",
      "тип_топлива",
      "тип_питания",
      "fuel",
      "fuel_type",
      "Тип топлива"
    ],
    sql_expression: "main_parameters->>'Тип топлива'",
    priority: 3,
  },

  // ========================================================================
  // БУЛЬДОЗЕРЫ
  // ========================================================================
  {
    key: "blade_capacity_m3",
    label_ru: "Объем отвала",
    description_ru: "Объем отвала в кубических метрах",
    category: "bulldozer",
    param_type: "number",
    unit: "m3",
    min_value: 1,
    max_value: 20,
    aliases: [
      "объем_отвала",
      "отвал",
      "blade",
      "blade_capacity",
      "Объем отвала"
    ],
    sql_expression: "main_parameters->>'Объем отвала'",
    priority: 1,
  },
];

async function seedParameterDictionary() {
  console.log("🌱 Заполнение справочника параметров...\n");
  console.log("=".repeat(70));

  try {
    // Создаем таблицу если не существует
    // Схема должна совпадать с migrations/007_create_parameter_dictionary.sql
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS parameter_dictionary (
        key TEXT PRIMARY KEY,
        label_ru TEXT NOT NULL,
        label_en TEXT,
        description_ru TEXT,
        category TEXT NOT NULL,
        param_type TEXT NOT NULL CHECK (param_type IN ('number', 'enum', 'boolean', 'string')),
        unit TEXT,
        min_value NUMERIC,
        max_value NUMERIC,
        enum_values JSONB,
        aliases JSONB DEFAULT '[]'::jsonb,
        sql_expression TEXT NOT NULL,
        is_searchable BOOLEAN DEFAULT true,
        is_filterable BOOLEAN DEFAULT true,
        priority INTEGER DEFAULT 0,
        version TEXT DEFAULT '1.0.0',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Обновляем constraint, если таблица была создана старой миграцией (без string)
    await pgPool.query(`
      ALTER TABLE parameter_dictionary
      DROP CONSTRAINT IF EXISTS parameter_dictionary_param_type_check;
    `);
    await pgPool.query(`
      ALTER TABLE parameter_dictionary
      ADD CONSTRAINT parameter_dictionary_param_type_check
      CHECK (param_type IN ('number', 'enum', 'boolean', 'string'));
    `);

    console.log("✅ Таблица parameter_dictionary готова\n");

    // Очищаем существующие данные
    await pgPool.query("DELETE FROM parameter_dictionary");
    console.log("🗑️  Старые данные удалены\n");

    // Вставляем параметры
    let inserted = 0;
    let failed = 0;

    for (const param of parameters) {
      try {
        // Автоматически генерируем sql_expression на основе key и param_type
        // Это гарантирует использование normalized_parameters вместо main_parameters
        const sqlExpression = param.param_type === "number"
          ? `(normalized_parameters->>'${param.key}')::numeric`
          : `normalized_parameters->>'${param.key}'`;

        await pgPool.query(
          `
          INSERT INTO parameter_dictionary (
            key, label_ru, description_ru, category, param_type, 
            unit, min_value, max_value, enum_values, 
            aliases, sql_expression, priority
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12
          )
          ON CONFLICT (key) DO UPDATE SET
            label_ru = EXCLUDED.label_ru,
            description_ru = EXCLUDED.description_ru,
            category = EXCLUDED.category,
            param_type = EXCLUDED.param_type,
            unit = EXCLUDED.unit,
            min_value = EXCLUDED.min_value,
            max_value = EXCLUDED.max_value,
            enum_values = EXCLUDED.enum_values,
            aliases = EXCLUDED.aliases,
            sql_expression = EXCLUDED.sql_expression,
            priority = EXCLUDED.priority,
            updated_at = NOW()
        `,
          [
            param.key,
            param.label_ru,
            param.description_ru,
            param.category,
            param.param_type,
            param.unit,
            param.min_value,
            param.max_value,
            param.enum_values ? JSON.stringify(param.enum_values) : null,
            JSON.stringify(param.aliases ?? []),
            sqlExpression, // Используем автоматически сгенерированное выражение
            param.priority,
          ]
        );

        console.log(
          `✅ ${param.key} (${param.label_ru}) - ${param.aliases.length} алиасов`
        );
        inserted++;
      } catch (error: any) {
        console.error(`❌ Ошибка при добавлении ${param.key}:`, error.message);
        failed++;
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log(`\n📊 Результаты:`);
    console.log(`   ✅ Добавлено: ${inserted}`);
    console.log(`   ❌ Ошибок: ${failed}`);
    console.log(`   📦 Всего параметров: ${parameters.length}\n`);

    // Показываем статистику по категориям
    const stats = await pgPool.query(`
      SELECT 
        category,
        COUNT(*) as count
      FROM parameter_dictionary
      GROUP BY category
      ORDER BY count DESC
    `);

    console.log("📈 Статистика по категориям:");
    stats.rows.forEach((row) => {
      console.log(`   - ${row.category}: ${row.count} параметров`);
    });

    console.log("\n✨ Справочник успешно заполнен!\n");
  } catch (error: any) {
    console.error("\n❌ Критическая ошибка:", error.message);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

// Запускаем скрипт
seedParameterDictionary();

