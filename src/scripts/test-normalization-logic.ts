#!/usr/bin/env node
/**
 * Проверка логики нормализации БЕЗ подключения к БД
 * 
 * Демонстрирует пошаговую работу алгоритма с mock-словарем
 */

import { UnitParser } from '../normalization/unit-parser';
import { EnumMapper } from '../normalization/enum-mapper';
import type { ParameterDictionary } from '../normalization/parameter-dictionary.service';

// Mock словарь параметров
const MOCK_DICTIONARY: ParameterDictionary[] = [
  {
    key: 'power_hp',
    label_ru: 'Мощность',
    category: 'engine',
    param_type: 'number',
    unit: 'hp',
    min_value: 10,
    max_value: 1000,
    aliases: ['Мощность', 'мощность', 'power', 'Power'],
    sql_expression: "main_parameters->>'power_hp'",
    priority: 1,
  },
  {
    key: 'power_kw',
    label_ru: 'Мощность (кВт)',
    category: 'engine',
    param_type: 'number',
    unit: 'kw',
    min_value: 7,
    max_value: 750,
    aliases: ['Мощность кВт', 'power kw'],
    sql_expression: "main_parameters->>'power_kw'",
    priority: 2,
  },
  {
    key: 'weight_kg',
    label_ru: 'Рабочий вес',
    category: 'physical',
    param_type: 'number',
    unit: 'kg',
    min_value: 100,
    max_value: 100000,
    aliases: ['Рабочий вес', 'вес', 'масса', 'weight', 'Масса'],
    sql_expression: "main_parameters->>'weight_kg'",
    priority: 1,
  },
  {
    key: 'fuel_type',
    label_ru: 'Тип питания',
    category: 'engine',
    param_type: 'enum',
    enum_values: {
      diesel: 'Дизельный',
      electric: 'Электрический',
      hybrid: 'Гибридный',
    },
    aliases: ['Тип питания', 'топливо', 'fuel'],
    sql_expression: "main_parameters->>'fuel_type'",
    priority: 1,
  },
];

class MockDictionaryService {
  findCanonicalKey(rawKey: string): ParameterDictionary | null {
    const normalizedKey = rawKey.toLowerCase().trim();
    
    for (const param of MOCK_DICTIONARY) {
      if (param.key.toLowerCase() === normalizedKey) {
        return param;
      }
      
      if (param.aliases.some(alias => 
        alias.toLowerCase() === normalizedKey ||
        normalizedKey.includes(alias.toLowerCase()) ||
        alias.toLowerCase().includes(normalizedKey)
      )) {
        return param;
      }
    }
    
    return null;
  }
}

function testNormalizationLogic() {
  console.log('='.repeat(80));
  console.log('ТЕСТ ЛОГИКИ НОРМАЛИЗАЦИИ (БЕЗ БД)');
  console.log('='.repeat(80));
  console.log();

  const dictionaryService = new MockDictionaryService();
  const unitParser = new UnitParser();
  const enumMapper = new EnumMapper();

  // Тестовые сценарии
  const testCases = [
    {
      name: 'Простой параметр с единицами',
      input: { key: 'Мощность', value: '132 л.с.' },
    },
    {
      name: 'Параметр с суффиксом _min',
      input: { key: 'Мощность_min', value: '100 л.с.' },
    },
    {
      name: 'Параметр с суффиксом _max',
      input: { key: 'Рабочий вес_max', value: '25000 кг' },
    },
    {
      name: 'Конверсия единиц (кВт → л.с.)',
      input: { key: 'Мощность', value: '97 кВт' },
    },
    {
      name: 'Конверсия единиц (тонны → кг)',
      input: { key: 'Масса', value: '20 тонн' },
    },
    {
      name: 'Enum параметр',
      input: { key: 'Тип питания', value: 'Дизельный' },
    },
    {
      name: 'Числовое значение без единиц',
      input: { key: 'weight_kg', value: 13500 },
    },
  ];

  for (const testCase of testCases) {
    console.log('─'.repeat(80));
    console.log(`📋 ${testCase.name}`);
    console.log('─'.repeat(80));
    console.log();

    const { key, value } = testCase.input;
    
    console.log(`🔵 ВХОД: "${key}" = ${JSON.stringify(value)}`);
    console.log();

    // ШАГ 1: Разделение суффиксов
    let suffix: string | null = null;
    let baseKey = key;
    
    if (key.endsWith('_min')) {
      suffix = '_min';
      baseKey = key.slice(0, -4);
      console.log(`🔸 Шаг 1: Обнаружен суффикс "${suffix}"`);
      console.log(`   Базовый ключ: "${baseKey}"`);
    } else if (key.endsWith('_max')) {
      suffix = '_max';
      baseKey = key.slice(0, -4);
      console.log(`🔸 Шаг 1: Обнаружен суффикс "${suffix}"`);
      console.log(`   Базовый ключ: "${baseKey}"`);
    } else {
      console.log('🔸 Шаг 1: Суффиксов не обнаружено');
      console.log(`   Базовый ключ: "${baseKey}"`);
    }
    console.log();

    // ШАГ 2: Поиск в словаре
    console.log('🔸 Шаг 2: Поиск в словаре');
    const paramDef = dictionaryService.findCanonicalKey(baseKey);
    
    if (!paramDef) {
      console.log('   ❌ Параметр не найден в словаре');
      console.log();
      continue;
    }
    
    console.log(`   ✅ Найден: "${paramDef.key}" (${paramDef.label_ru})`);
    console.log(`   Тип: ${paramDef.param_type}`);
    if (paramDef.unit) console.log(`   Единица: ${paramDef.unit}`);
    if (paramDef.enum_values) console.log(`   Enum значения:`, Object.keys(paramDef.enum_values));
    console.log();

    // ШАГ 3: Нормализация значения
    console.log('🔸 Шаг 3: Нормализация значения');
    let normalizedValue: any = null;

    if (paramDef.param_type === 'number') {
      if (typeof value === 'number') {
        normalizedValue = value;
        console.log(`   Значение уже числовое: ${normalizedValue}`);
      } else {
        const parsed = unitParser.parseValue(value, paramDef.unit || '');
        normalizedValue = parsed;
        console.log(`   Парсинг "${value}"`);
        console.log(`   Извлечено число: ${parsed}`);
        if (paramDef.unit) {
          console.log(`   Целевая единица: ${paramDef.unit}`);
        }
      }
    } else if (paramDef.param_type === 'enum') {
      const mapped = enumMapper.mapEnumValue(String(value), paramDef);
      normalizedValue = mapped;
      console.log(`   Маппинг enum: "${value}" → "${mapped}"`);
    } else if (paramDef.param_type === 'boolean') {
      const str = String(value).toLowerCase();
      if (['true', '1', 'да', 'yes'].includes(str)) {
        normalizedValue = true;
      } else if (['false', '0', 'нет', 'no'].includes(str)) {
        normalizedValue = false;
      }
      console.log(`   Преобразование в boolean: ${normalizedValue}`);
    }
    console.log();

    // ШАГ 4: Сборка результата
    console.log('🔸 Шаг 4: Сборка результата');
    const finalKey = suffix ? `${paramDef.key}${suffix}` : paramDef.key;
    console.log(`   Canonical ключ: "${finalKey}"`);
    console.log(`   Нормализованное значение: ${JSON.stringify(normalizedValue)}`);
    console.log();

    // ШАГ 5: SQL генерация
    console.log('🔸 Шаг 5: Генерация SQL');
    let operator = '=';
    let sqlCast = '::text';
    let sqlKey = paramDef.key;

    if (suffix === '_min') {
      operator = '>=';
      sqlCast = '::numeric';
    } else if (suffix === '_max') {
      operator = '<=';
      sqlCast = '::numeric';
    } else if (typeof normalizedValue === 'number') {
      sqlCast = '::numeric';
    }

    console.log(`   SQL выражение:`);
    console.log(`   (main_parameters->>'${sqlKey}')${sqlCast} ${operator} ${JSON.stringify(normalizedValue)}`);
    console.log();

    // Итоговая трансформация
    console.log('🟢 ИТОГ ТРАНСФОРМАЦИИ:');
    console.log(`   "${key}" = ${JSON.stringify(value)}`);
    console.log(`   ↓`);
    console.log(`   "${finalKey}" = ${JSON.stringify(normalizedValue)}`);
    console.log();
  }

  // Полный пример запроса
  console.log('='.repeat(80));
  console.log('ПОЛНЫЙ ПРИМЕР: НОРМАЛИЗАЦИЯ ЗАПРОСА');
  console.log('='.repeat(80));
  console.log();

  const fullQuery = {
    text: 'экскаватор',
    parameters: {
      'Мощность_min': '100 л.с.',
      'Рабочий вес_max': '25000 кг',
      'Тип питания': 'Дизельный',
    },
  };

  console.log('🔵 ВХОДНОЙ ЗАПРОС:');
  console.log(JSON.stringify(fullQuery, null, 2));
  console.log();

  // Разделение по суффиксам
  const regularParams: Record<string, any> = {};
  const minParams: Record<string, any> = {};
  const maxParams: Record<string, any> = {};

  for (const [key, value] of Object.entries(fullQuery.parameters)) {
    if (key.endsWith('_min')) {
      minParams[key.slice(0, -4)] = value;
    } else if (key.endsWith('_max')) {
      maxParams[key.slice(0, -4)] = value;
    } else {
      regularParams[key] = value;
    }
  }

  console.log('🔸 Разделение параметров:');
  console.log(`   Обычные: ${Object.keys(regularParams).length}`);
  console.log(`   С _min:  ${Object.keys(minParams).length}`);
  console.log(`   С _max:  ${Object.keys(maxParams).length}`);
  console.log();

  // Нормализация каждой группы
  const normalizedParameters: Record<string, any> = {};

  console.log('🔸 Нормализация каждой группы:');
  console.log();

  // Regular params
  for (const [key, value] of Object.entries(regularParams)) {
    const paramDef = dictionaryService.findCanonicalKey(key);
    if (!paramDef) continue;

    let normalizedValue: any = null;
    if (paramDef.param_type === 'number') {
      normalizedValue = unitParser.parseValue(value, paramDef.unit || '');
    } else if (paramDef.param_type === 'enum') {
      normalizedValue = enumMapper.mapEnumValue(String(value), paramDef);
    }

    if (normalizedValue !== null) {
      normalizedParameters[paramDef.key] = normalizedValue;
      console.log(`   ✅ "${key}" → "${paramDef.key}" = ${JSON.stringify(normalizedValue)}`);
    }
  }

  // Min params
  for (const [key, value] of Object.entries(minParams)) {
    const paramDef = dictionaryService.findCanonicalKey(key);
    if (!paramDef) continue;

    const normalizedValue = unitParser.parseValue(value, paramDef.unit || '');
    if (normalizedValue !== null) {
      normalizedParameters[`${paramDef.key}_min`] = normalizedValue;
      console.log(`   ✅ "${key}_min" → "${paramDef.key}_min" = ${JSON.stringify(normalizedValue)}`);
    }
  }

  // Max params
  for (const [key, value] of Object.entries(maxParams)) {
    const paramDef = dictionaryService.findCanonicalKey(key);
    if (!paramDef) continue;

    const normalizedValue = unitParser.parseValue(value, paramDef.unit || '');
    if (normalizedValue !== null) {
      normalizedParameters[`${paramDef.key}_max`] = normalizedValue;
      console.log(`   ✅ "${key}_max" → "${paramDef.key}_max" = ${JSON.stringify(normalizedValue)}`);
    }
  }

  console.log();

  const normalizedQuery = {
    text: fullQuery.text,
    parameters: normalizedParameters,
  };

  console.log('🟢 НОРМАЛИЗОВАННЫЙ ЗАПРОС:');
  console.log(JSON.stringify(normalizedQuery, null, 2));
  console.log();

  // SQL запрос
  console.log('🗄️  ИТОГОВЫЙ SQL ЗАПРОС:');
  console.log();
  const whereParts: string[] = ['is_active = true'];
  const values: any[] = [];

  if (normalizedQuery.text) {
    values.push(normalizedQuery.text);
    whereParts.push(`search_vector @@ plainto_tsquery('russian', $${values.length})`);
  }

  for (const [key, value] of Object.entries(normalizedQuery.parameters)) {
    let operator = '=';
    let sqlCast = '::text';
    let paramKey = key;

    if (key.endsWith('_min')) {
      operator = '>=';
      sqlCast = '::numeric';
      paramKey = key.slice(0, -4);
    } else if (key.endsWith('_max')) {
      operator = '<=';
      sqlCast = '::numeric';
      paramKey = key.slice(0, -4);
    } else if (typeof value === 'number') {
      sqlCast = '::numeric';
    }

    values.push(paramKey, value);
    whereParts.push(
      `(main_parameters->>$${values.length - 1})${sqlCast} ${operator} $${values.length}`
    );
  }

  console.log('SELECT id, name, category, brand, price, main_parameters');
  console.log('FROM equipment');
  console.log(`WHERE ${whereParts.join('\n  AND ')}`);
  console.log('ORDER BY ts_rank(...) DESC, name ASC');
  console.log('LIMIT 10;');
  console.log();
  console.log('Параметры:');
  values.forEach((v, i) => {
    console.log(`  $${i + 1} = ${JSON.stringify(v)}`);
  });
  console.log();

  console.log('='.repeat(80));
  console.log('✅ Тест завершен успешно');
  console.log('='.repeat(80));
}

// Запуск
testNormalizationLogic();

