#!/usr/bin/env node
/**
 * Демонстрация поиска по параметрам с нормализацией
 * 
 * Показывает полный путь:
 * 1. Запрос пользователя
 * 2. Нормализация параметров
 * 3. SQL запрос
 * 4. Результаты
 */

import { pgPool } from '../db/pg';
import { EquipmentRepository } from '../repository/equipment.repository';
import { SearchEngine } from '../search/search.engine';
import { ParameterDictionaryService } from '../normalization/parameter-dictionary.service';
import { QueryParameterNormalizer } from '../normalization/query-parameter-normalizer';
import { SearchQuery } from '../catalog';

async function demoParameterSearch() {
  console.log('='.repeat(80));
  console.log('ДЕМОНСТРАЦИЯ ПОИСКА ПО ПАРАМЕТРАМ');
  console.log('='.repeat(80));
  console.log();

  // Инициализация
  console.log('⏳ Инициализация...');
  const dictionaryService = new ParameterDictionaryService();
  
  try {
    await dictionaryService.loadDictionary();
    console.log('✅ Словарь параметров загружен');
    console.log(`   Параметров в словаре: ${dictionaryService.getDictionary().length}`);
  } catch (error) {
    console.log('⚠️  Словарь не загружен, но поиск будет работать с fallback маппером');
  }
  
  const repository = new EquipmentRepository(pgPool, dictionaryService);
  const searchEngine = new SearchEngine(repository, dictionaryService);
  const normalizer = new QueryParameterNormalizer(dictionaryService);
  console.log();

  // Тестовые запросы
  const testQueries: Array<{ name: string; query: SearchQuery }> = [
    {
      name: 'Поиск по простым параметрам',
      query: {
        text: 'экскаватор',
        parameters: {
          'Мощность': '132 л.с.',
          'Рабочий вес': '13500 кг',
        },
      },
    },
    {
      name: 'Поиск с диапазонами (_min, _max)',
      query: {
        text: 'экскаватор',
        parameters: {
          'Мощность_min': '100 л.с.',
          'Мощность_max': '200 л.с.',
          'Рабочий вес_min': '10000 кг',
        },
      },
    },
    {
      name: 'Поиск с конверсией единиц',
      query: {
        parameters: {
          'Мощность': '97 кВт',      // кВт → л.с.
          'Масса': '20 тонн',        // тонны → кг
        },
      },
    },
    {
      name: 'Поиск по категории с параметрами',
      query: {
        category: 'Краны',
        parameters: {
          'Грузоподъемность_min': '10000 кг',
        },
        limit: 5,
      },
    },
  ];

  for (const testQuery of testQueries) {
    console.log('═'.repeat(80));
    console.log(`📋 ${testQuery.name}`);
    console.log('═'.repeat(80));
    console.log();

    // ШАГ 1: Исходный запрос
    console.log('🔵 ШАГ 1: ИСХОДНЫЙ ЗАПРОС');
    console.log(JSON.stringify(testQuery.query, null, 2));
    console.log();

    // ШАГ 2: Нормализация параметров
    if (testQuery.query.parameters) {
      console.log('🔄 ШАГ 2: НОРМАЛИЗАЦИЯ ПАРАМЕТРОВ');
      console.log();
      
      const normalizationResult = normalizer.normalizeQuery(testQuery.query);
      
      console.log('   Входные параметры:');
      Object.entries(testQuery.query.parameters).forEach(([key, value]) => {
        console.log(`   • "${key}" = ${JSON.stringify(value)}`);
      });
      console.log();
      
      console.log('   ↓ [Нормализация через словарь] ↓');
      console.log();
      
      console.log('   Нормализованные параметры:');
      Object.entries(normalizationResult.normalizedQuery.parameters || {}).forEach(([key, value]) => {
        console.log(`   • "${key}" = ${JSON.stringify(value)}`);
      });
      console.log();
      
      console.log('   📊 Статистика:');
      console.log(`   - Всего параметров: ${normalizationResult.stats.total}`);
      console.log(`   - Нормализовано: ${normalizationResult.stats.normalized}`);
      console.log(`   - Не удалось: ${normalizationResult.stats.unresolved}`);
      console.log(`   - Уверенность: ${(normalizationResult.stats.confidence * 100).toFixed(1)}%`);
      console.log();

      // ШАГ 3: SQL запрос (эмуляция)
      console.log('🗄️  ШАГ 3: SQL ЗАПРОС');
      console.log();
      console.log('   SELECT id, name, category, brand, price, main_parameters');
      console.log('   FROM equipment');
      console.log('   WHERE is_active = true');
      
      if (normalizationResult.normalizedQuery.text) {
        console.log(`     AND search_vector @@ plainto_tsquery('russian', '${normalizationResult.normalizedQuery.text}')`);
      }
      
      if (normalizationResult.normalizedQuery.category) {
        console.log(`     AND category = '${normalizationResult.normalizedQuery.category}'`);
      }
      
      // SQL для параметров
      if (normalizationResult.normalizedQuery.parameters) {
        for (const [key, value] of Object.entries(normalizationResult.normalizedQuery.parameters)) {
          let operator = '=';
          let paramKey = key;
          let sqlCast = typeof value === 'number' ? '::numeric' : '::text';
          
          if (key.endsWith('_min')) {
            operator = '>=';
            paramKey = key.slice(0, -4);
            sqlCast = '::numeric';
          } else if (key.endsWith('_max')) {
            operator = '<=';
            paramKey = key.slice(0, -4);
            sqlCast = '::numeric';
          }
          
          console.log(`     AND (main_parameters->>'${paramKey}')${sqlCast} ${operator} ${JSON.stringify(value)}`);
        }
      }
      
      console.log('   ORDER BY ts_rank(...) DESC, name ASC');
      console.log(`   LIMIT ${testQuery.query.limit || 10};`);
      console.log();
    }

    // ШАГ 4: Выполнение поиска
    console.log('⏳ ШАГ 4: ВЫПОЛНЕНИЕ ПОИСКА В БД');
    console.log();
    
    try {
      const result = await searchEngine.search(testQuery.query);
      
      console.log(`✅ Найдено: ${result.total} (Стратегия: ${result.usedStrategy})`);
      
      if (result.message) {
        console.log(`💡 ${result.message}`);
      }
      console.log();
      
      if (result.items.length > 0) {
        console.log('   Первые 3 результата:');
        result.items.slice(0, 3).forEach((item, i) => {
          console.log();
          console.log(`   ${i + 1}. ${item.name}`);
          console.log(`      ID: ${item.id}`);
          console.log(`      Категория: ${item.category}`);
          console.log(`      Бренд: ${item.brand}`);
          if (item.price) console.log(`      Цена: ${item.price}`);
          
          // Показываем параметры, по которым искали
          if (item.mainParameters && Object.keys(item.mainParameters).length > 0) {
            console.log(`      Параметры:`);
            Object.entries(item.mainParameters).slice(0, 5).forEach(([key, value]) => {
              console.log(`        - ${key}: ${value}`);
            });
          }
        });
      } else {
        console.log('   ❌ Ничего не найдено');
        
        if (result.suggestions?.popularCategories) {
          console.log();
          console.log('   💡 Попробуйте поискать в популярных категориях:');
          result.suggestions.popularCategories.slice(0, 5).forEach((cat, i) => {
            console.log(`      ${i + 1}. ${cat.name} (${cat.count} шт.)`);
          });
        }
      }
    } catch (error) {
      console.error('❌ Ошибка поиска:', error);
    }
    
    console.log();
    console.log();
  }

  // Дополнительно: Примеры параметров в БД
  console.log('═'.repeat(80));
  console.log('📊 ПРИМЕРЫ ПАРАМЕТРОВ В БД');
  console.log('═'.repeat(80));
  console.log();
  
  try {
    const sampleQuery = `
      SELECT 
        category,
        name,
        main_parameters
      FROM equipment
      WHERE main_parameters IS NOT NULL
        AND jsonb_typeof(main_parameters) = 'object'
        AND is_active = true
      LIMIT 5
    `;
    
    const { pgPool } = await import('../db/pg');
    const result = await pgPool.query(sampleQuery);
    
    console.log('Примеры оборудования с параметрами:');
    console.log();
    
    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.name} (${row.category})`);
      console.log('   Параметры в БД:');
      
      const params = row.main_parameters || {};
      const paramEntries = Object.entries(params);
      
      if (paramEntries.length > 0) {
        paramEntries.slice(0, 5).forEach(([key, value]) => {
          console.log(`   • ${key}: ${value}`);
        });
        if (paramEntries.length > 5) {
          console.log(`   ... и еще ${paramEntries.length - 5} параметров`);
        }
      } else {
        console.log('   (нет параметров)');
      }
      console.log();
    });
  } catch (error) {
    console.log('⚠️  Не удалось получить примеры из БД');
  }

  console.log('═'.repeat(80));
  console.log('✅ Демонстрация завершена');
  console.log('═'.repeat(80));
  
  // Останавливаем auto-refresh индекса
  searchEngine.getCatalogIndex().stopAutoRefresh();
  process.exit(0);
}

// Запуск
demoParameterSearch().catch((error) => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});

