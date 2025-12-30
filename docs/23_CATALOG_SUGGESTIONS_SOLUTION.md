# Решение: Подсказки пользователю о содержимом каталога

## Проблема

Когда поиск возвращает 0 результатов, пользователь не знает:
- Что есть в каталоге?
- Какие категории доступны?
- Может, он ошибся в названии?

**Пример:**
```
Пользователь: "какие есть трактора"
LLM: { "category": "Трактор" }
Результат: 0 найдено
❌ Нет подсказок!
```

## Решение: Многоуровневая система подсказок

### Уровень 1: Fallback поиск

Если точное совпадение не найдено, пробуем другие стратегии:

```
category="Трактор" → 0 результатов
  ↓
Fallback 1: Искать похожие категории (fuzzy)
  → Найдено: "Тягачи", "Самосвалы"
  ↓
Fallback 2: Искать по тексту
  → text="Трактор" через search_vector
  ↓
Fallback 3: Показать популярные категории
  → "Краны (34), Тягачи (34), Самосвалы (32), ..."
```

### Уровень 2: Умные подсказки

В зависимости от типа запроса:

1. **Не найдена категория** → показать похожие + популярные
2. **Не найден бренд** → показать доступные бренды
3. **Слишком много фильтров** → предложить ослабить
4. **Пустой запрос** → показать примеры

## Реализация

### 1. Улучшенный SearchEngine

```typescript
// src/search/search.engine.ts

async search(query: SearchQuery): Promise<CatalogSearchResult> {
  const limit = query.limit ?? 10;

  // 1. Нормализация параметров
  let normalizedQuery = query;
  if (this.queryNormalizer && query.parameters) {
    await this.ensureDictionaryLoaded();
    const result = this.queryNormalizer.normalizeQuery(query);
    normalizedQuery = result.normalizedQuery;
  }

  // 2. Убедиться, что индекс каталога загружен
  await this.catalogIndex.ensureIndex();

  // 3. Основной поиск (FTS + Vector)
  const [ftsResults, vectorResults] = await this.executeSearch(normalizedQuery, limit);
  
  // 4. Если ничего не найдено → применяем fallback стратегии
  if (ftsResults.length === 0 && vectorResults.length === 0) {
    return await this.handleNoResults(normalizedQuery, limit);
  }

  // 5. Гибридное слияние результатов
  const merged = this.hybridFusion(ftsResults, vectorResults, limit);
  
  return {
    items: merged,
    total: merged.length,
    usedStrategy: this.determineStrategy(ftsResults, vectorResults),
  };
}

/**
 * Обработка случая, когда ничего не найдено
 */
private async handleNoResults(
  query: SearchQuery, 
  limit: number
): Promise<CatalogSearchResult> {
  const suggestions = this.generateSuggestions(query);
  
  // Fallback 1: Поиск по похожим категориям
  if (query.category) {
    const similarCategories = this.catalogIndex.findSimilarCategories(query.category, 5);
    
    if (similarCategories.length > 0) {
      // Пробуем поискать по первой похожей категории
      const fallbackQuery = {
        ...query,
        category: similarCategories[0],
      };
      
      const fallbackResults = await this.equipmentRepository.fullTextSearch(
        fallbackQuery,
        limit
      );
      
      if (fallbackResults.length > 0) {
        return {
          items: fallbackResults,
          total: fallbackResults.length,
          usedStrategy: 'fallback',
          suggestions: {
            ...suggestions,
            similarCategories,
          },
          message: `Категория "${query.category}" не найдена. Показываем результаты для "${similarCategories[0]}"`,
        };
      }
    }
  }

  // Fallback 2: Текстовый поиск вместо category
  if (query.category && !query.text) {
    const textQuery = {
      ...query,
      text: query.category,
      category: undefined,
    };
    
    const textResults = await this.equipmentRepository.fullTextSearch(textQuery, limit);
    
    if (textResults.length > 0) {
      return {
        items: textResults,
        total: textResults.length,
        usedStrategy: 'fallback',
        suggestions,
        message: `Поиск по тексту "${query.category}" вместо категории`,
      };
    }
  }

  // Fallback 3: Ничего не помогло → показываем подсказки
  return {
    items: [],
    total: 0,
    usedStrategy: 'none',
    suggestions,
    message: this.generateNoResultsMessage(query, suggestions),
  };
}

/**
 * Генерация подсказок в зависимости от запроса
 */
private generateSuggestions(query: SearchQuery): CatalogSuggestions {
  const suggestions: CatalogSuggestions = {};

  // Подсказки по категории
  if (query.category) {
    const similarCategories = this.catalogIndex.findSimilarCategories(query.category, 5);
    if (similarCategories.length > 0) {
      suggestions.similarCategories = similarCategories;
    }
  }

  // Популярные категории (всегда показываем)
  suggestions.popularCategories = this.catalogIndex.getPopularCategories(10);

  // Примеры запросов
  suggestions.exampleQueries = [
    'экскаватор с мощностью 100 л.с.',
    'краны в Москве',
    'самосвалы грузоподъемностью от 20 тонн',
    'автобетоносмесители',
  ];

  return suggestions;
}

/**
 * Генерация сообщения о том, что ничего не найдено
 */
private generateNoResultsMessage(
  query: SearchQuery, 
  suggestions: CatalogSuggestions
): string {
  const parts: string[] = [];

  if (query.category) {
    parts.push(`Категория "${query.category}" не найдена в каталоге.`);
    
    if (suggestions.similarCategories && suggestions.similarCategories.length > 0) {
      parts.push(`Возможно, вы искали: ${suggestions.similarCategories.join(', ')}`);
    }
  } else if (query.text) {
    parts.push(`По запросу "${query.text}" ничего не найдено.`);
  } else {
    parts.push('Ничего не найдено.');
  }

  if (suggestions.popularCategories && suggestions.popularCategories.length > 0) {
    const top3 = suggestions.popularCategories.slice(0, 3)
      .map(c => `${c.name} (${c.count})`)
      .join(', ');
    parts.push(`Популярные категории: ${top3}`);
  }

  return parts.join(' ');
}
```

### 2. Интеграция в CLI

```typescript
// src/cli/index.ts

async function displaySearchResults(result: CatalogSearchResult) {
  if (result.items.length === 0) {
    console.log();
    console.log('❌ Ничего не найдено');
    
    // Показываем сообщение
    if (result.message) {
      console.log();
      console.log('💡', result.message);
    }
    
    // Показываем подсказки
    if (result.suggestions) {
      console.log();
      console.log('📋 Доступные категории:');
      
      // Похожие категории
      if (result.suggestions.similarCategories?.length) {
        console.log();
        console.log('   Похожие:');
        result.suggestions.similarCategories.forEach(cat => {
          console.log(`   - ${cat}`);
        });
      }
      
      // Популярные категории
      if (result.suggestions.popularCategories?.length) {
        console.log();
        console.log('   Популярные (топ-10):');
        result.suggestions.popularCategories.forEach((cat, i) => {
          console.log(`   ${i + 1}. ${cat.name} (${cat.count} шт.)`);
        });
      }
      
      // Примеры запросов
      if (result.suggestions.exampleQueries?.length) {
        console.log();
        console.log('   Примеры запросов:');
        result.suggestions.exampleQueries.forEach(example => {
          console.log(`   • ${example}`);
        });
      }
    }
  } else {
    // Обычный вывод результатов
    console.log(`✅ Найдено: ${result.total} (Стратегия: ${result.usedStrategy})`);
    
    if (result.message) {
      console.log('💡', result.message);
    }
    
    result.items.forEach((item, i) => {
      console.log(`\n${i + 1}. ${item.name}`);
      console.log(`   Категория: ${item.category}`);
      console.log(`   Бренд: ${item.brand}`);
      if (item.price) console.log(`   Цена: ${item.price}`);
    });
  }
}
```

### 3. Интеграция в HTTP API

```typescript
// src/http/server.ts

app.post('/api/v1/search', async (req, res) => {
  try {
    const query = req.body as SearchQuery;
    const result = await searchEngine.search(query);
    
    // Всегда возвращаем подсказки, даже если есть результаты
    const response = {
      items: result.items,
      total: result.total,
      strategy: result.usedStrategy,
      message: result.message,
      suggestions: result.suggestions,
    };
    
    res.json(response);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## Примеры работы

### Пример 1: Не найдена категория

```
Запрос: "какие есть трактора"
LLM: { "category": "Трактор" }

Результат:
{
  "items": [],
  "total": 0,
  "strategy": "none",
  "message": "Категория 'Трактор' не найдена в каталоге. Популярные категории: Краны (34), Тягачи (34), Самосвалы (32)",
  "suggestions": {
    "similarCategories": [],
    "popularCategories": [
      { "name": "Краны", "count": 34 },
      { "name": "Тягачи", "count": 34 },
      { "name": "Самосвалы", "count": 32 },
      // ... еще 7
    ],
    "exampleQueries": [
      "экскаватор с мощностью 100 л.с.",
      "краны в Москве",
      // ...
    ]
  }
}
```

**В CLI:**
```
❌ Ничего не найдено

💡 Категория "Трактор" не найдена в каталоге. 
    Популярные категории: Краны (34), Тягачи (34), Самосвалы (32)

📋 Доступные категории:

   Популярные (топ-10):
   1. Краны (34 шт.)
   2. Тягачи (34 шт.)
   3. Самосвалы (32 шт.)
   4. Гусеничные краны (26 шт.)
   5. Шасси (21 шт.)
   6. Асфальтоукладчики (21 шт.)
   7. Вилочные погрузчики (19 шт.)
   8. Автокраны (19 шт.)
   9. Телескопический погрузчик (18 шт.)
   10. Фронтальные погрузчики (17 шт.)

   Примеры запросов:
   • экскаватор с мощностью 100 л.с.
   • краны в Москве
   • самосвалы грузоподъемностью от 20 тонн
   • автобетоносмесители
```

### Пример 2: Похожая категория найдена

```
Запрос: "покажи кран"
LLM: { "category": "кран" }

Fallback:
1. Ищем похожие: ["Краны", "Автокраны", "Гусеничные краны"]
2. Пробуем искать по "Краны"
3. Нашли 34 результата!

Результат:
{
  "items": [... 10 кранов ...],
  "total": 10,
  "strategy": "fallback",
  "message": "Категория 'кран' не найдена. Показываем результаты для 'Краны'",
  "suggestions": {
    "similarCategories": ["Краны", "Автокраны", "Гусеничные краны"]
  }
}
```

**В CLI:**
```
✅ Найдено: 10 (Стратегия: fallback)
💡 Категория "кран" не найдена. Показываем результаты для "Краны"

1. LIEBHERR LTM 1100-5.2
   Категория: Краны
   Бренд: LIEBHERR
   Цена: 15000000
...
```

### Пример 3: Текстовый fallback

```
Запрос: "что-то с бетоном"
LLM: { "text": "бетон" }

Результат: 14 результатов через search_vector
- Бетонная техника (14)
- Бетонные заводы (10)
- Бетононасосы (15)
- и т.д.
```

## Дополнительные улучшения

### 1. Кэширование популярных запросов

```typescript
class SearchEngine {
  private popularQueriesCache: Map<string, CatalogSearchResult> = new Map();
  
  async search(query: SearchQuery): Promise<CatalogSearchResult> {
    // Проверяем кэш для популярных запросов
    const cacheKey = JSON.stringify(query);
    const cached = this.popularQueriesCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 минута
      return cached.result;
    }
    
    // ... обычный поиск
  }
}
```

### 2. Логирование неудачных запросов

```typescript
private async handleNoResults(query: SearchQuery, limit: number) {
  // Логируем для анализа
  console.warn('[Search] No results for query:', JSON.stringify(query));
  
  // Можно сохранить в БД для аналитики
  await this.logFailedQuery(query);
  
  // ... fallback логика
}
```

### 3. A/B тестирование подсказок

```typescript
interface SuggestionStrategy {
  name: string;
  weight: number;
  generate: (query: SearchQuery) => CatalogSuggestions;
}

const strategies: SuggestionStrategy[] = [
  {
    name: 'popular',
    weight: 0.7,
    generate: (q) => ({ popularCategories: this.getPopular() }),
  },
  {
    name: 'similar',
    weight: 0.3,
    generate: (q) => ({ similarCategories: this.getSimilar(q.category) }),
  },
];
```

## Метрики эффективности

Отслеживать:
1. **Доля успешных fallback** - сколько раз fallback помог найти результаты
2. **Популярные несуществующие категории** - что пользователи ищут, но не находят
3. **CTR на подсказки** - кликают ли пользователи на предложенные категории

```typescript
interface SearchMetrics {
  totalSearches: number;
  successfulSearches: number;
  fallbackSearches: number;
  noResultsSearches: number;
  popularFailedQueries: Map<string, number>;
}
```

## Итого

**Преимущества решения:**

✅ Пользователь всегда получает полезную информацию  
✅ Fallback стратегии увеличивают шанс найти результаты  
✅ Умные подсказки помогают сориентироваться в каталоге  
✅ Логирование помогает улучшать систему  
✅ Гибкая архитектура - легко добавлять новые стратегии  

**Что нужно сделать:**

1. Доработать `SearchEngine.search()` с fallback логикой
2. Обновить CLI для отображения подсказок
3. Обновить HTTP API для возврата suggestions
4. Добавить логирование неудачных запросов
5. Протестировать на реальных запросах

