#!/usr/bin/env node
/**
 * Показывает как работает поиск по параметрам
 * БЕЗ подключения к БД - только демонстрация потока
 */

import { SearchQuery } from '../catalog';

console.log('='.repeat(80));
console.log('КАК РАБОТАЕТ ПОИСК ПО ПАРАМЕТРАМ');
console.log('='.repeat(80));
console.log();

// Примеры запросов
const examples: Array<{ name: string; query: SearchQuery; normalized: any }> = [
  {
    name: 'Пример 1: Простой поиск по параметрам',
    query: {
      text: 'экскаватор',
      parameters: {
        'Мощность': '132 л.с.',
        'Рабочий вес': '13500 кг',
      },
    },
    normalized: {
      text: 'экскаватор',
      parameters: {
        'power_hp': 132,
        'weight_kg': 13500,
      },
    },
  },
  {
    name: 'Пример 2: Поиск с диапазонами (_min, _max)',
    query: {
      text: 'экскаватор',
      parameters: {
        'Мощность_min': '100 л.с.',
        'Мощность_max': '200 л.с.',
        'Рабочий вес_min': '10000 кг',
      },
    },
    normalized: {
      text: 'экскаватор',
      parameters: {
        'power_hp_min': 100,
        'power_hp_max': 200,
        'weight_kg_min': 10000,
      },
    },
  },
  {
    name: 'Пример 3: Конверсия единиц измерения',
    query: {
      parameters: {
        'Мощность': '97 кВт',        // кВт → л.с.
        'Масса': '20 тонн',          // тонны → кг
        'Высота подъема': '6 м',     // метры → мм
      },
    },
    normalized: {
      parameters: {
        'power_kw': 97,              // Или power_hp: 132 если конвертируем
        'weight_kg': 20000,
        'lifting_height_mm': 6000,
      },
    },
  },
  {
    name: 'Пример 4: Комбинированный запрос',
    query: {
      text: 'погрузчик',
      category: 'Фронтальные погрузчики',
      brand: 'Caterpillar',
      parameters: {
        'Грузоподъемность_min': '5000 кг',
        'Мощность': '150 л.с.',
      },
      limit: 5,
    },
    normalized: {
      text: 'погрузчик',
      category: 'Фронтальные погрузчики',
      brand: 'Caterpillar',
      parameters: {
        'load_capacity_min': 5000,
        'power_hp': 150,
      },
      limit: 5,
    },
  },
];

for (const example of examples) {
  console.log('═'.repeat(80));
  console.log(`📋 ${example.name}`);
  console.log('═'.repeat(80));
  console.log();

  // ШАГ 1: Исходный запрос от пользователя/LLM
  console.log('🔵 ШАГ 1: ИСХОДНЫЙ ЗАПРОС');
  console.log(JSON.stringify(example.query, null, 2));
  console.log();

  // ШАГ 2: Нормализация
  if (example.query.parameters) {
    console.log('🔄 ШАГ 2: НОРМАЛИЗАЦИЯ ПАРАМЕТРОВ');
    console.log();
    console.log('   Процесс нормализации:');
    console.log();

    for (const [key, value] of Object.entries(example.query.parameters)) {
      let suffix = '';
      let baseKey = key;
      
      if (key.endsWith('_min')) {
        suffix = ' [_min]';
        baseKey = key.replace('_min', '');
      } else if (key.endsWith('_max')) {
        suffix = ' [_max]';
        baseKey = key.replace('_max', '');
      }

      console.log(`   "${key}"${suffix}`);
      console.log(`     → Ищем в словаре: "${baseKey}"`);
      console.log(`     → Значение: ${JSON.stringify(value)}`);
      
      // Показываем что происходит
      if (typeof value === 'string' && value.match(/\d+/)) {
        const num = value.match(/[\d.,]+/)?.[0];
        const unit = value.replace(num!, '').trim();
        if (unit) {
          console.log(`     → Парсим: число=${num}, единица="${unit}"`);
          
          // Примеры конверсии
          if (unit.includes('кВт')) {
            console.log(`     → Конвертируем: кВт → л.с. (×1.36)`);
          } else if (unit.includes('тонн')) {
            console.log(`     → Конвертируем: тонны → кг (×1000)`);
          } else if (unit === 'м' && baseKey.includes('высота')) {
            console.log(`     → Конвертируем: м → мм (×1000)`);
          }
        }
      }
      console.log();
    }

    console.log('   Результат нормализации:');
    console.log(JSON.stringify(example.normalized.parameters, null, 2));
    console.log();
  }

  // ШАГ 3: SQL запрос
  console.log('🗄️  ШАГ 3: ПОСТРОЕНИЕ SQL ЗАПРОСА');
  console.log();
  console.log('```sql');
  console.log('SELECT');
  console.log('  id,');
  console.log('  name,');
  console.log('  category,');
  console.log('  brand,');
  console.log('  price,');
  console.log('  main_parameters');
  console.log('FROM equipment');
  console.log('WHERE is_active = true');
  
  // Текстовый поиск
  if (example.normalized.text) {
    console.log(`  AND search_vector @@ plainto_tsquery('russian', '${example.normalized.text}')`);
  }
  
  // Фильтры
  if (example.normalized.category) {
    console.log(`  AND category = '${example.normalized.category}'`);
  }
  
  if (example.normalized.brand) {
    console.log(`  AND brand = '${example.normalized.brand}'`);
  }
  
  // Параметры
  if (example.normalized.parameters) {
    console.log();
    console.log('  -- Параметры из main_parameters (JSONB):');
    
    for (const [key, value] of Object.entries(example.normalized.parameters)) {
      let operator = '=';
      let paramKey = key;
      let sqlCast = typeof value === 'number' ? '::numeric' : '::text';
      
      if (key.endsWith('_min')) {
        operator = '>=';
        paramKey = key.slice(0, -4);
        sqlCast = '::numeric';
        console.log(`  AND (main_parameters->>'${paramKey}')${sqlCast} ${operator} ${value}  -- минимум`);
      } else if (key.endsWith('_max')) {
        operator = '<=';
        paramKey = key.slice(0, -4);
        sqlCast = '::numeric';
        console.log(`  AND (main_parameters->>'${paramKey}')${sqlCast} ${operator} ${value}  -- максимум`);
      } else {
        console.log(`  AND (main_parameters->>'${paramKey}')${sqlCast} ${operator} ${JSON.stringify(value)}  -- точное`);
      }
    }
  }
  
  console.log();
  console.log('ORDER BY');
  console.log("  ts_rank(search_vector, plainto_tsquery('russian', ...)) DESC,");
  console.log('  name ASC');
  console.log(`LIMIT ${example.normalized.limit || 10};`);
  console.log('```');
  console.log();

  // Пример результата
  console.log('✅ ШАГ 4: РЕЗУЛЬТАТЫ (ПРИМЕР)');
  console.log();
  console.log('   Найдено: 15 единиц оборудования');
  console.log();
  console.log('   1. CATERPILLAR 966H');
  console.log('      Категория: Фронтальные погрузчики');
  console.log('      Параметры:');
  console.log('        - power_hp: 152');
  console.log('        - load_capacity: 5500');
  console.log('        - weight_kg: 23500');
  console.log();
  console.log('   2. KOMATSU WA380-7');
  console.log('      Категория: Фронтальные погрузчики');
  console.log('      Параметры:');
  console.log('        - power_hp: 155');
  console.log('        - load_capacity: 5200');
  console.log('        - weight_kg: 22800');
  console.log();
  console.log('   ...');
  console.log();
}

// Дополнительная информация
console.log('═'.repeat(80));
console.log('📚 ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ');
console.log('═'.repeat(80));
console.log();

console.log('🔍 Как работает нормализация:');
console.log();
console.log('1. **Разделение по суффиксам**');
console.log('   "Мощность_min" → базовый ключ: "Мощность" + суффикс: "_min"');
console.log();
console.log('2. **Поиск в словаре**');
console.log('   "Мощность" → ищем в aliases → находим: "power_hp"');
console.log();
console.log('3. **Парсинг значения**');
console.log('   "100 л.с." → число: 100, единица: "л.с." → 100 (hp)');
console.log();
console.log('4. **Восстановление суффикса**');
console.log('   "power_hp" + "_min" → "power_hp_min": 100');
console.log();
console.log('5. **SQL генерация**');
console.log("   (main_parameters->>'power_hp')::numeric >= 100");
console.log();

console.log('🔄 Операторы для диапазонов:');
console.log();
console.log('   _min → >= (больше или равно)');
console.log('   _max → <= (меньше или равно)');
console.log('   без суффикса → = (точное совпадение)');
console.log();

console.log('📊 Типы параметров:');
console.log();
console.log('   • number - числовые (мощность, вес, размеры)');
console.log('     - Поддержка единиц: л.с., кВт, кг, тонны, м, мм');
console.log('     - Автоматическая конверсия');
console.log();
console.log('   • enum - категориальные (тип топлива, привод)');
console.log('     - Маппинг: "Дизельный" → "diesel"');
console.log();
console.log('   • boolean - да/нет (наличие функций)');
console.log('     - "да", "true", "1" → true');
console.log();

console.log('🎯 Примеры запросов:');
console.log();
console.log('1. Простой:');
console.log('   { text: "экскаватор", parameters: { "Мощность": "100 л.с." } }');
console.log();
console.log('2. С диапазоном:');
console.log('   { parameters: { "Мощность_min": "100 л.с.", "Мощность_max": "200 л.с." } }');
console.log();
console.log('3. Комбинированный:');
console.log('   {');
console.log('     category: "Краны",');
console.log('     parameters: {');
console.log('       "Грузоподъемность_min": "10 тонн",');
console.log('       "Высота подъема_max": "50 м"');
console.log('     }');
console.log('   }');
console.log();

console.log('═'.repeat(80));
console.log('✅ Демонстрация завершена');
console.log('═'.repeat(80));
console.log();
console.log('📖 Полная документация:');
console.log('   - docs/16_QUERY_PARAMETER_NORMALIZATION.md');
console.log('   - docs/19_NORMALIZATION_CHECK_RESULT.md');
console.log('   - docs/20_NORMALIZATION_FLOW_DIAGRAM.md');
console.log();

