#!/usr/bin/env node
/**
 * Тестовый скрипт для проверки потока нормализации параметров
 * 
 * Демонстрирует, как параметры проходят через все этапы:
 * 1. Входной запрос от LLM
 * 2. QueryParameterNormalizer
 * 3. ParameterNormalizerService
 * 4. UnitParser / EnumMapper
 * 5. SQL построение в Repository
 */

import { ParameterDictionaryService } from '../normalization/parameter-dictionary.service';
import { QueryParameterNormalizer } from '../normalization/query-parameter-normalizer';
import { SearchQuery } from '../catalog';

async function testNormalizationFlow() {
  console.log('='.repeat(80));
  console.log('ТЕСТ ПОТОКА НОРМАЛИЗАЦИИ ПАРАМЕТРОВ');
  console.log('='.repeat(80));
  console.log();

  // Инициализация
  const dictionaryService = new ParameterDictionaryService();
  
  try {
    await dictionaryService.loadDictionary();
    console.log('✅ Словарь параметров загружен');
    console.log(`   Записей в словаре: ${dictionaryService.getDictionary().length}`);
    console.log();
  } catch (error) {
    console.error('❌ Ошибка загрузки словаря:', error);
    process.exit(1);
  }

  const normalizer = new QueryParameterNormalizer(dictionaryService);

  // Тестовые сценарии
  const testCases: Array<{ name: string; query: SearchQuery }> = [
    {
      name: 'Сценарий 1: Простые параметры',
      query: {
        text: 'экскаватор',
        parameters: {
          'Мощность': '132 л.с.',
          'Рабочий вес': '13500 кг',
          'Тип питания': 'Дизельный',
        },
      },
    },
    {
      name: 'Сценарий 2: Диапазоны значений (_min/_max)',
      query: {
        text: 'экскаватор',
        parameters: {
          'Мощность_min': '100 л.с.',
          'Рабочий вес_max': '25000 кг',
        },
      },
    },
    {
      name: 'Сценарий 3: Смешанные единицы измерения',
      query: {
        parameters: {
          'Мощность': '97 кВт',
          'Масса': '20 тонн',
        },
      },
    },
    {
      name: 'Сценарий 4: Комбинированный запрос',
      query: {
        text: 'погрузчик',
        category: 'Погрузчики',
        parameters: {
          'Грузоподъемность_min': '5000 кг',
          'Мощность': '150 л.с.',
          'Высота подъема_max': '6 м',
        },
      },
    },
  ];

  for (const testCase of testCases) {
    console.log('─'.repeat(80));
    console.log(`📋 ${testCase.name}`);
    console.log('─'.repeat(80));
    console.log();

    // Входной запрос
    console.log('🔵 ВХОДНОЙ ЗАПРОС:');
    console.log(JSON.stringify(testCase.query, null, 2));
    console.log();

    // Нормализация
    const result = normalizer.normalizeQuery(testCase.query);

    console.log('🟢 НОРМАЛИЗОВАННЫЙ ЗАПРОС:');
    console.log(JSON.stringify(result.normalizedQuery, null, 2));
    console.log();

    // Статистика
    console.log('📊 СТАТИСТИКА НОРМАЛИЗАЦИИ:');
    console.log(`   Всего параметров:       ${result.stats.total}`);
    console.log(`   Успешно нормализовано:  ${result.stats.normalized}`);
    console.log(`   Не удалось нормализовать: ${result.stats.unresolved}`);
    console.log(`   Уверенность:            ${(result.stats.confidence * 100).toFixed(1)}%`);
    console.log();

    // Детали параметров
    if (result.normalizedQuery.parameters && Object.keys(result.normalizedQuery.parameters).length > 0) {
      console.log('🔍 ДЕТАЛИ НОРМАЛИЗАЦИИ:');
      for (const [key, value] of Object.entries(result.normalizedQuery.parameters)) {
        const type = typeof value;
        let operator = '=';
        let displayKey = key;

        if (key.endsWith('_min')) {
          operator = '>=';
          displayKey = key.replace('_min', '');
        } else if (key.endsWith('_max')) {
          operator = '<=';
          displayKey = key.replace('_max', '');
        }

        console.log(`   ${key}:`);
        console.log(`      Ключ БД:    ${displayKey}`);
        console.log(`      Значение:   ${value}`);
        console.log(`      Тип:        ${type}`);
        console.log(`      Оператор:   ${operator}`);
        console.log(`      SQL:        (main_parameters->>'${displayKey}')::${type === 'number' ? 'numeric' : 'text'} ${operator} ${JSON.stringify(value)}`);
        console.log();
      }
    }

    // Имитация SQL запроса
    if (result.normalizedQuery.parameters && Object.keys(result.normalizedQuery.parameters).length > 0) {
      console.log('🗄️  SQL ЗАПРОС (имитация):');
      console.log('   SELECT id, name, category, brand, price, main_parameters');
      console.log('   FROM equipment');
      
      const whereParts: string[] = ['is_active = true'];
      const values: any[] = [];

      if (result.normalizedQuery.text) {
        values.push(result.normalizedQuery.text);
        whereParts.push(`search_vector @@ plainto_tsquery('russian', $${values.length})`);
      }

      for (const [key, value] of Object.entries(result.normalizedQuery.parameters)) {
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

      console.log(`   WHERE ${whereParts.join(' AND ')}`);
      console.log('   ORDER BY ts_rank(search_vector, ...) DESC, name ASC');
      console.log('   LIMIT 10;');
      console.log();
      console.log('   Параметры:', values.map((v, i) => `$${i + 1}=${JSON.stringify(v)}`).join(', '));
      console.log();
    }

    console.log();
  }

  console.log('='.repeat(80));
  console.log('✅ Все тесты завершены');
  console.log('='.repeat(80));
}

// Запуск
testNormalizationFlow()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения теста:', error);
    process.exit(1);
  });

