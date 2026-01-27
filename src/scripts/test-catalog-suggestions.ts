#!/usr/bin/env node
/**
 * Демонстрация работы подсказок каталога
 */

import { pgPool } from '../db/pg';
import { EquipmentRepository } from '../repository/equipment.repository';
import { SearchEngine } from '../search/search.engine';
import { CatalogIndexService } from '../catalog/catalog-index.service';
import { SearchQuery, CatalogSearchResult } from '../catalog';

async function testSuggestions() {
  console.log('='.repeat(80));
  console.log('ДЕМОНСТРАЦИЯ РАБОТЫ ПОДСКАЗОК КАТАЛОГА');
  console.log('='.repeat(80));
  console.log();

  // Инициализация
  const repository = new EquipmentRepository(pgPool);
  const searchEngine = new SearchEngine(repository);
  const catalogIndex = searchEngine.getCatalogIndex();

  // Ждем загрузки индекса
  console.log('⏳ Загружаю индекс каталога...');
  await catalogIndex.ensureIndex();
  const index = catalogIndex.getIndex();
  
  if (index) {
    console.log(`✅ Индекс загружен: ${index.totalItems} единиц оборудования`);
    console.log(`   Категорий: ${index.categories.length}`);
    console.log(`   Брендов: ${index.brands.length}`);
    console.log();
  }

  // Тестовые сценарии
  const testCases: Array<{ name: string; query: SearchQuery }> = [
    {
      name: 'Сценарий 1: Несуществующая категория (Трактор)',
      query: {
        category: 'Трактор',
      },
    },
    {
      name: 'Сценарий 2: Опечатка в категории (кран вместо Краны)',
      query: {
        category: 'кран',
      },
    },
    {
      name: 'Сценарий 3: Частичное совпадение (погрузчик)',
      query: {
        text: 'погрузчик',
      },
    },
    {
      name: 'Сценарий 4: Существующая категория (Краны)',
      query: {
        category: 'Краны',
      },
    },
  ];

  for (const testCase of testCases) {
    console.log('─'.repeat(80));
    console.log(`📋 ${testCase.name}`);
    console.log('─'.repeat(80));
    console.log();

    // Запрос
    console.log('🔵 Запрос:');
    console.log(JSON.stringify(testCase.query, null, 2));
    console.log();

    // Поиск
    console.log('⏳ Ищу...');
    const result: CatalogSearchResult = await searchEngine.search(testCase.query);
    console.log();

    // Результаты
    if (result.total === 0) {
      console.log('❌ НИЧЕГО НЕ НАЙДЕНО');
      console.log();

      if (result.message) {
        console.log('💡 Сообщение:');
        console.log(`   ${result.message}`);
        console.log();
      }

      if (result.suggestions) {
        console.log('📋 ПОДСКАЗКИ:');
        console.log();

        // Похожие категории
        if (result.suggestions.similarCategories?.length) {
          console.log('   Похожие категории:');
          result.suggestions.similarCategories.forEach((cat, i) => {
            console.log(`   ${i + 1}. ${cat}`);
          });
          console.log();
        }

        // Популярные категории
        if (result.suggestions.popularCategories?.length) {
          console.log('   Популярные категории (топ-10):');
          result.suggestions.popularCategories.slice(0, 10).forEach((cat, i) => {
            console.log(`   ${i + 1}. ${cat.name} (${cat.count} шт.)`);
          });
          console.log();
        }

        // Примеры запросов
        if (result.suggestions.exampleQueries?.length) {
          console.log('   Примеры запросов:');
          result.suggestions.exampleQueries.forEach(example => {
            console.log(`   • ${example}`);
          });
          console.log();
        }
      }
    } else {
      console.log(`✅ НАЙДЕНО: ${result.total} (Стратегия: ${result.usedStrategy})`);
      console.log();

      if (result.message) {
        console.log('💡 Сообщение:');
        console.log(`   ${result.message}`);
        console.log();
      }

      console.log('Первые 3 результата:');
      result.items.slice(0, 3).forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.name}`);
        console.log(`      Категория: ${item.category}`);
        console.log(`      Бренд: ${item.brand}`);
        if (item.price) console.log(`      Цена: ${item.price}`);
        console.log();
      });
    }

    console.log();
  }

  // Демонстрация методов CatalogIndexService
  console.log('='.repeat(80));
  console.log('МЕТОДЫ CatalogIndexService');
  console.log('='.repeat(80));
  console.log();

  // Поиск похожих категорий
  console.log('🔍 findSimilarCategories("трактор", 5):');
  const similar = catalogIndex.findSimilarCategories('трактор', 5);
  similar.forEach((cat, i) => {
    console.log(`   ${i + 1}. ${cat}`);
  });
  console.log();

  // Популярные категории
  console.log('📊 getPopularCategories(10):');
  const popular = catalogIndex.getPopularCategories(10);
  popular.forEach((cat, i) => {
    console.log(`   ${i + 1}. ${cat.name} (${cat.count} шт.)`);
  });
  console.log();

  // Проверка существования категории
  console.log('✔️  categoryExists("Краны"):', catalogIndex.categoryExists('Краны'));
  console.log('✔️  categoryExists("Трактор"):', catalogIndex.categoryExists('Трактор'));
  console.log();

  // Категории для промпта LLM
  console.log('📝 getCategoriesForPrompt(15):');
  console.log(catalogIndex.getCategoriesForPrompt(15));
  console.log();

  console.log('='.repeat(80));
  console.log('✅ Тест завершен');
  console.log('='.repeat(80));

  // Останавливаем auto-refresh
  catalogIndex.stopAutoRefresh();
  process.exit(0);
}

// Запуск
testSuggestions().catch((error) => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});

