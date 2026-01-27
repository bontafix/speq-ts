#!/usr/bin/env node
/**
 * Тест поиска с выводом JSON и SQL запросов
 */

// ✅ ВАЖНО: Загружаем .env САМЫМ ПЕРВЫМ делом!
import { config } from 'dotenv';
config({ override: true });

// Включаем DEBUG режим
process.env.DEBUG = '1';

// ТЕПЕРЬ импортируем модули (они будут использовать правильные env переменные)
import { EquipmentRepository } from '../repository/equipment.repository';
import { SearchEngine } from '../search/search.engine';
import { ParameterDictionaryService } from '../normalization/parameter-dictionary.service';
import { QueryParameterNormalizer } from '../normalization/query-parameter-normalizer';
import { SearchQuery } from '../catalog';

async function testSearchWithDebug() {
  console.log('='.repeat(80));
  console.log('ТЕСТ ПОИСКА С DEBUG ВЫВОДОМ');
  console.log('='.repeat(80));
  console.log();

  // Проверка подключения к БД
  console.log('📡 Проверка подключения к БД...');
  console.log(`   Host: ${process.env.PGHOST}`);
  console.log(`   Database: ${process.env.PGDATABASE}`);
  console.log(`   User: ${process.env.PGUSER}`);
  console.log();

  try {
    const { pgPool, checkDatabaseHealth } = await import('../db/pg');
    
    const health = await checkDatabaseHealth();
    
    if (!health.ok) {
      console.log('❌ Проблемы с БД:');
      health.issues.forEach(issue => {
        console.log(`   ${issue.level === 'error' ? '❌' : '⚠️ '} ${issue.message}`);
      });
      process.exit(1);
    }
    
    console.log('✅ БД подключена успешно');
    console.log();

    // Проверка данных
    const countResult = await pgPool.query('SELECT COUNT(*) as count FROM equipment WHERE is_active = true');
    console.log(`📊 Оборудования в БД: ${countResult.rows[0].count}`);
    
    const dictResult = await pgPool.query('SELECT COUNT(*) as count FROM parameter_dictionary');
    console.log(`📚 Параметров в словаре: ${dictResult.rows[0].count}`);
    console.log();

  } catch (error) {
    console.error('❌ Ошибка подключения к БД:', error);
    process.exit(1);
  }

  // Инициализация
  console.log('⏳ Загрузка словаря параметров...');
  const dictionaryService = new ParameterDictionaryService();
  
  try {
    await dictionaryService.loadDictionary();
    console.log(`✅ Словарь загружен: ${dictionaryService.getDictionary().length} параметров`);
  } catch (error) {
    console.error('❌ Ошибка загрузки словаря:', error);
    process.exit(1);
  }
  console.log();

  const repository = new EquipmentRepository(pgPool, dictionaryService);
  const searchEngine = new SearchEngine(repository, dictionaryService);
  const normalizer = new QueryParameterNormalizer(dictionaryService);

  // Тестовые запросы
  const testQueries: Array<{ name: string; query: SearchQuery }> = [
    {
      name: 'Поиск экскаваторов с параметрами',
      query: {
        text: 'экскаватор',
        parameters: {
          'Мощность_min': '100 л.с.',
          'Рабочий вес_max': '25000 кг',
        },
        limit: 5,
      },
    },
    {
      name: 'Поиск по категории с параметрами',
      query: {
        category: 'Краны',
        parameters: {
          'Грузоподъемность_min': '5000 кг',
        },
        limit: 5,
      },
    },
    {
      name: 'Текстовый поиск с конверсией единиц',
      query: {
        text: 'погрузчик',
        parameters: {
          'Мощность': '97 кВт',
          'Масса': '20 тонн',
        },
        limit: 3,
      },
    },
  ];

  for (const testCase of testQueries) {
    console.log('═'.repeat(80));
    console.log(`📋 ${testCase.name}`);
    console.log('═'.repeat(80));
    console.log();

    // ШАГ 1: Исходный запрос
    console.log('🔵 ИСХОДНЫЙ ЗАПРОС (от LLM):');
    console.log(JSON.stringify(testCase.query, null, 2));
    console.log();

    // ШАГ 2: Нормализация
    if (testCase.query.parameters) {
      console.log('🔄 НОРМАЛИЗАЦИЯ ПАРАМЕТРОВ:');
      console.log();

      const normResult = normalizer.normalizeQuery(testCase.query);
      
      console.log('   До нормализации:');
      Object.entries(testCase.query.parameters).forEach(([key, value]) => {
        console.log(`   • ${key} = ${JSON.stringify(value)}`);
      });
      console.log();

      console.log('   После нормализации:');
      if (normResult.normalizedQuery.parameters) {
        Object.entries(normResult.normalizedQuery.parameters).forEach(([key, value]) => {
          console.log(`   • ${key} = ${JSON.stringify(value)}`);
        });
      }
      console.log();

      console.log('   📊 Статистика:');
      console.log(`      Всего: ${normResult.stats.total}`);
      console.log(`      Нормализовано: ${normResult.stats.normalized}`);
      console.log(`      Не удалось: ${normResult.stats.unresolved}`);
      console.log(`      Успешность: ${(normResult.stats.confidence * 100).toFixed(1)}%`);
      console.log();

      // ШАГ 3: JSON после нормализации
      console.log('🟢 JSON ПОСЛЕ НОРМАЛИЗАЦИИ:');
      console.log(JSON.stringify(normResult.normalizedQuery, null, 2));
      console.log();
    }

    // ШАГ 4: SQL запрос (эмуляция)
    console.log('🗄️  SQL ЗАПРОС (эмуляция):');
    console.log();
    
    const sqlParts: string[] = [];
    sqlParts.push('SELECT');
    sqlParts.push('  id, name, category, brand, price, main_parameters');
    sqlParts.push('FROM equipment');
    sqlParts.push('WHERE is_active = true');
    
    if (testCase.query.text) {
      sqlParts.push(`  AND search_vector @@ plainto_tsquery('russian', '${testCase.query.text}')`);
    }
    
    if (testCase.query.category) {
      sqlParts.push(`  AND category = '${testCase.query.category}'`);
    }
    
    // Параметры (после нормализации)
    const normResult = normalizer.normalizeQuery(testCase.query);
    if (normResult.normalizedQuery.parameters) {
      sqlParts.push('  -- Параметры (JSONB):');
      
      for (const [key, value] of Object.entries(normResult.normalizedQuery.parameters)) {
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
        
        sqlParts.push(`  AND (main_parameters->>'${paramKey}')${sqlCast} ${operator} ${JSON.stringify(value)}`);
      }
    }
    
    sqlParts.push(`ORDER BY ts_rank(...) DESC, name ASC`);
    sqlParts.push(`LIMIT ${testCase.query.limit || 10};`);
    
    console.log(sqlParts.join('\n'));
    console.log();

    // ШАГ 5: Реальный поиск
    console.log('⏳ ВЫПОЛНЕНИЕ ПОИСКА...');
    console.log();

    try {
      const result = await searchEngine.search(testCase.query);
      
      console.log(`✅ Найдено: ${result.total} (Стратегия: ${result.usedStrategy})`);
      
      if (result.message) {
        console.log(`💡 ${result.message}`);
      }
      console.log();
      
      if (result.items.length > 0) {
        console.log('📦 РЕЗУЛЬТАТЫ:');
        console.log();
        
        result.items.forEach((item, i) => {
          console.log(`${i + 1}. ${item.name}`);
          console.log(`   ID: ${item.id}`);
          console.log(`   Категория: ${item.category}`);
          console.log(`   Бренд: ${item.brand}`);
          if (item.price) console.log(`   Цена: ${item.price}`);
          
          if (item.mainParameters && Object.keys(item.mainParameters).length > 0) {
            console.log(`   Параметры:`);
            Object.entries(item.mainParameters).slice(0, 5).forEach(([key, val]) => {
              console.log(`     • ${key}: ${val}`);
            });
          }
          console.log();
        });
      } else {
        console.log('❌ Ничего не найдено');
        
        if (result.suggestions) {
          console.log();
          console.log('💡 ПОДСКАЗКИ:');
          
          if (result.suggestions.similarCategories?.length) {
            console.log('   Похожие категории:');
            result.suggestions.similarCategories.forEach(cat => {
              console.log(`   • ${cat}`);
            });
          }
          
          if (result.suggestions.popularCategories?.length) {
            console.log('   Популярные категории:');
            result.suggestions.popularCategories.slice(0, 5).forEach(cat => {
              console.log(`   • ${cat.name} (${cat.count} шт.)`);
            });
          }
        }
        console.log();
      }
      
    } catch (error) {
      console.error('❌ Ошибка поиска:', error);
    }
    
    console.log();
  }

  console.log('═'.repeat(80));
  console.log('✅ Тест завершен');
  console.log('═'.repeat(80));
  
  searchEngine.getCatalogIndex().stopAutoRefresh();
  process.exit(0);
}

// Запуск
testSearchWithDebug().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});

