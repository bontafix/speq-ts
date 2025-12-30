# Дизайн системы подсказок для каталога

## Проблема

Пользователь спрашивает: "какие есть трактора в каталоге"
- LLM формирует: `{ "category": "Трактор" }`
- Результат: 0 найдено
- Пользователь не знает, что есть в каталоге

## Решения

### Вариант 1: Умный Fallback с подсказками (РЕКОМЕНДУЕТСЯ)

**Идея:** Если поиск вернул 0 результатов, предложить:
1. Fallback поиск по тексту
2. Список похожих категорий
3. Популярные категории

**Архитектура:**

```
SearchEngine.search()
    ↓
Основной поиск (FTS + Vector)
    ↓
0 результатов?
    ↓
Fallback механизм:
    ├─ 1. Попробовать поиск по text (если был category)
    ├─ 2. Найти похожие категории (similarity)
    ├─ 3. Показать популярные категории
    └─ 4. Сформировать подсказку для пользователя
```

**Расширенный интерфейс:**

```typescript
// src/catalog/catalog.types.ts

export interface CatalogSearchResult {
  items: EquipmentSummary[];
  total: number;
  usedStrategy: "fts" | "vector" | "mixed" | "fallback" | "none";
  
  // Новые поля для подсказок
  suggestions?: CatalogSuggestions;
  message?: string;
}

export interface CatalogSuggestions {
  // Похожие категории (если искали по category)
  similarCategories?: string[];
  
  // Популярные категории (топ по количеству)
  popularCategories?: CategoryInfo[];
  
  // Доступные бренды (если искали по brand)
  availableBrands?: string[];
  
  // Примеры запросов
  exampleQueries?: string[];
}

export interface CategoryInfo {
  name: string;
  count: number;
}
```

### Вариант 2: Интерактивные подсказки в процессе

**Идея:** LLM сам спрашивает у базы, что доступно, ПЕРЕД формированием запроса

```
Пользователь: "какие есть трактора"
    ↓
LLM вызывает функцию: getCatalogInfo()
    ↓
Система возвращает: { categories: [...], brands: [...], totalItems: 844 }
    ↓
LLM видит: "трактора" нет в списке категорий
    ↓
LLM отвечает: "В каталоге нет тракторов. Доступны: Краны, Тягачи, Самосвалы..."
```

**Реализация через Function Calling:**

```typescript
// Функция для LLM
const tools = [
  {
    name: "get_catalog_info",
    description: "Получить информацию о доступных категориях, брендах и параметрах в каталоге",
    parameters: {
      type: "object",
      properties: {
        infoType: {
          type: "string",
          enum: ["categories", "brands", "regions", "all"],
          description: "Тип информации"
        }
      }
    }
  }
];
```

### Вариант 3: Кэшированный индекс каталога

**Идея:** Хранить в памяти структуру каталога для быстрых подсказок

```typescript
// src/catalog/catalog-index.service.ts

export class CatalogIndexService {
  private index: CatalogIndex | null = null;
  
  async buildIndex(): Promise<void> {
    const sql = `
      SELECT 
        category,
        COUNT(*) as count
      FROM equipment
      WHERE is_active = true
      GROUP BY category
      ORDER BY count DESC
    `;
    
    const result = await pgPool.query(sql);
    
    this.index = {
      categories: result.rows,
      totalItems: result.rows.reduce((sum, r) => sum + r.count, 0),
      lastUpdated: new Date(),
    };
  }
  
  // Поиск похожих категорий
  findSimilarCategories(query: string, limit = 5): string[] {
    if (!this.index) return [];
    
    return this.index.categories
      .filter(c => 
        c.category.toLowerCase().includes(query.toLowerCase()) ||
        this.similarity(c.category, query) > 0.3
      )
      .slice(0, limit)
      .map(c => c.category);
  }
  
  getPopularCategories(limit = 10): CategoryInfo[] {
    if (!this.index) return [];
    return this.index.categories.slice(0, limit);
  }
}
```

### Вариант 4: Умный промпт для LLM

**Идея:** Включить в системный промпт информацию о каталоге

```typescript
// При инициализации чата
const catalogInfo = await catalogIndexService.buildIndex();

const systemPrompt = `
Ты — помощник по поиску строительной техники.

ВАЖНО: В нашем каталоге ${catalogInfo.totalItems} единиц техники.

Доступные категории (топ-20):
${catalogInfo.categories.slice(0, 20).map(c => `- ${c.category} (${c.count} шт.)`).join('\n')}

Если пользователь спрашивает про категорию, которой НЕТ в списке выше:
1. Сначала используй text поиск вместо category
2. Предложи похожие категории из списка
3. Спроси, что именно нужно найти

Примеры:
❌ "трактора" → НЕТ в каталоге → предложи "Тягачи" или "Фронтальные погрузчики"
✅ "краны" → ЕСТЬ в каталоге → { category: "Краны" }
`;
```

## РЕКОМЕНДУЕМАЯ РЕАЛИЗАЦИЯ

Комбинация **Вариант 1 + Вариант 3 + Вариант 4**

### Шаг 1: Расширить типы

```typescript
// src/catalog/catalog.types.ts

export interface CatalogSearchResult {
  items: EquipmentSummary[];
  total: number;
  usedStrategy: "fts" | "vector" | "mixed" | "fallback" | "none";
  suggestions?: CatalogSuggestions;
  message?: string;
}

export interface CatalogSuggestions {
  similarCategories?: string[];
  popularCategories?: CategoryInfo[];
  availableBrands?: string[];
  exampleQueries?: string[];
}

export interface CategoryInfo {
  name: string;
  count: number;
}
```

### Шаг 2: Создать CatalogIndexService

```typescript
// src/catalog/catalog-index.service.ts

import { pgPool } from "../db/pg";

export interface CatalogIndex {
  categories: Array<{ name: string; count: number }>;
  brands: Array<{ name: string; count: number }>;
  regions: Array<{ name: string; count: number }>;
  totalItems: number;
  lastUpdated: Date;
}

export class CatalogIndexService {
  private index: CatalogIndex | null = null;
  private refreshInterval = 5 * 60 * 1000; // 5 минут

  constructor() {
    // Автоматическое обновление индекса
    this.startAutoRefresh();
  }

  async buildIndex(): Promise<CatalogIndex> {
    const [categoriesResult, brandsResult, regionsResult, totalResult] = 
      await Promise.all([
        // Категории
        pgPool.query(`
          SELECT category as name, COUNT(*) as count
          FROM equipment
          WHERE is_active = true AND category IS NOT NULL
          GROUP BY category
          ORDER BY count DESC
        `),
        
        // Бренды
        pgPool.query(`
          SELECT brand as name, COUNT(*) as count
          FROM equipment
          WHERE is_active = true AND brand IS NOT NULL
          GROUP BY brand
          ORDER BY count DESC
        `),
        
        // Регионы
        pgPool.query(`
          SELECT region as name, COUNT(*) as count
          FROM equipment
          WHERE is_active = true AND region IS NOT NULL
          GROUP BY region
          ORDER BY count DESC
        `),
        
        // Всего
        pgPool.query(`
          SELECT COUNT(*) as total
          FROM equipment
          WHERE is_active = true
        `),
      ]);

    this.index = {
      categories: categoriesResult.rows,
      brands: brandsResult.rows,
      regions: regionsResult.rows,
      totalItems: parseInt(totalResult.rows[0].total),
      lastUpdated: new Date(),
    };

    return this.index;
  }

  getIndex(): CatalogIndex | null {
    return this.index;
  }

  /**
   * Найти похожие категории по запросу
   */
  findSimilarCategories(query: string, limit = 5): string[] {
    if (!this.index) return [];

    const queryLower = query.toLowerCase().trim();
    
    // Фильтруем категории по вхождению подстроки
    const matches = this.index.categories
      .filter(c => {
        const catLower = c.name.toLowerCase();
        return catLower.includes(queryLower) || 
               queryLower.includes(catLower) ||
               this.levenshteinDistance(catLower, queryLower) <= 3;
      })
      .slice(0, limit)
      .map(c => c.name);

    return matches;
  }

  /**
   * Получить популярные категории
   */
  getPopularCategories(limit = 10): CategoryInfo[] {
    if (!this.index) return [];
    
    return this.index.categories
      .slice(0, limit)
      .map(c => ({ name: c.name, count: c.count }));
  }

  /**
   * Получить все категории для промпта LLM
   */
  getCategoriesForPrompt(limit = 30): string {
    if (!this.index) return "Индекс не загружен";
    
    return this.index.categories
      .slice(0, limit)
      .map((c, i) => `${i + 1}. ${c.name} (${c.count} шт.)`)
      .join('\n');
  }

  /**
   * Расстояние Левенштейна для нечеткого поиска
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  private startAutoRefresh(): void {
    // Первая загрузка
    this.buildIndex().catch(err => 
      console.error('[CatalogIndex] Failed to build index:', err)
    );

    // Периодическое обновление
    setInterval(() => {
      this.buildIndex().catch(err => 
        console.error('[CatalogIndex] Failed to refresh index:', err)
      );
    }, this.refreshInterval);
  }
}
```

### Шаг 3: Добавить fallback в SearchEngine

```typescript
// src/search/search.engine.ts

import { CatalogIndexService } from "../catalog/catalog-index.service";

export class SearchEngine {
  private catalogIndex: CatalogIndexService;

  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly dictionaryService?: ParameterDictionaryService,
    private readonly llmFactory?: LLMProviderFactory
  ) {
    this.config = new ConfigService();
    this.catalogIndex = new CatalogIndexService();
    
    if (this.dictionaryService) {
      this.queryNormalizer = new QueryParameterNormalizer(this.dictionaryService);
      this.initializeDictionary();
    }
  }

  async search(query: SearchQuery): Promise<CatalogSearchResult> {
    const limit = query.limit ?? 10;

    // 1. Нормализация параметров
    let normalizedQuery = query;
    if (this.queryNormalizer && query.parameters) {
      // ... существующий код ...
    }

    // 2. Основной поиск
    const [ftsResult, vectorResult] = await Promise.allSettled([
      this.equipmentRepository.fullTextSearch(normalizedQuery, limit),
      this.performVectorSearch(normalizedQuery.text!, limit, filters)
    ]);
    
    const ftsResults = ftsResult.status === 'fulfilled' ? ftsResult.value : [];
    const vectorResults = vectorResult.status === 'fulfilled' ? vectorResult.value : [];

    // 3. Если ничего не найдено - FALLBACK
    if (ftsResults.length === 0 && vectorResults.length === 0) {
      return await this.handleNoResults(normalizedQuery, limit);
    }

    // 4. Гибридное слияние
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
    const suggestions: CatalogSuggestions = {};
    let message = "Подходящее оборудование не найдено.";

    // FALLBACK 1: Если искали по category, попробовать text
    if (query.category && !query.text) {
      console.log(`[Search] No results for category="${query.category}", trying text fallback...`);
      
      const fallbackQuery: SearchQuery = {
        ...query,
        text: query.category,
        category: undefined,
      };
      
      const fallbackResults = await this.equipmentRepository.fullTextSearch(
        fallbackQuery, 
        limit
      );
      
      if (fallbackResults.length > 0) {
        // Нашли через text!
        suggestions.similarCategories = this.catalogIndex.findSimilarCategories(query.category);
        
        return {
          items: fallbackResults,
          total: fallbackResults.length,
          usedStrategy: 'fallback',
          suggestions,
          message: `Категория "${query.category}" не найдена. Показаны результаты текстового поиска.`
        };
      }
      
      // Не нашли даже через text
      suggestions.similarCategories = this.catalogIndex.findSimilarCategories(query.category);
      
      if (suggestions.similarCategories.length > 0) {
        message = `Категория "${query.category}" не найдена. Возможно, вы искали: ${suggestions.similarCategories.join(', ')}?`;
      }
    }

    // FALLBACK 2: Показать популярные категории
    suggestions.popularCategories = this.catalogIndex.getPopularCategories(10);
    
    if (suggestions.popularCategories.length > 0) {
      message += `\n\nДоступные категории:\n${
        suggestions.popularCategories
          .map(c => `• ${c.name} (${c.count} шт.)`)
          .join('\n')
      }`;
    }

    // FALLBACK 3: Примеры запросов
    suggestions.exampleQueries = [
      "Покажи краны",
      "Найди экскаваторы с мощностью больше 100 л.с.",
      "Какие есть погрузчики марки Caterpillar",
    ];

    return {
      items: [],
      total: 0,
      usedStrategy: 'none',
      suggestions,
      message,
    };
  }

  private determineStrategy(fts: any[], vector: any[]): "fts" | "vector" | "mixed" {
    if (fts.length > 0 && vector.length > 0) return "mixed";
    if (vector.length > 0) return "vector";
    return "fts";
  }
}
```

### Шаг 4: Обновить CLI для показа подсказок

```typescript
// src/cli/index.ts

// После получения результатов
const result = await searchEngine.search(searchQuery);

if (result.total === 0) {
  console.log('\n❌', result.message || 'Ничего не найдено');
  
  // Показать подсказки
  if (result.suggestions) {
    if (result.suggestions.similarCategories && result.suggestions.similarCategories.length > 0) {
      console.log('\n💡 Похожие категории:');
      result.suggestions.similarCategories.forEach(cat => {
        console.log(`   • ${cat}`);
      });
    }
    
    if (result.suggestions.popularCategories && result.suggestions.popularCategories.length > 0) {
      console.log('\n📊 Популярные категории:');
      result.suggestions.popularCategories.slice(0, 5).forEach(cat => {
        console.log(`   • ${cat.name} (${cat.count} шт.)`);
      });
    }
    
    if (result.suggestions.exampleQueries && result.suggestions.exampleQueries.length > 0) {
      console.log('\n💬 Примеры запросов:');
      result.suggestions.exampleQueries.forEach(q => {
        console.log(`   • "${q}"`);
      });
    }
  }
} else {
  console.log(`\n✅ Найдено: ${result.total} (Стратегия: ${result.usedStrategy})`);
  // ... показ результатов ...
}
```

### Шаг 5: Обновить промпт LLM

```typescript
// src/llm/chat.service.ts

async initializeConversation(): Promise<void> {
  // Получить информацию о каталоге
  const catalogIndex = await this.catalogIndexService.getIndex();
  
  const systemPrompt = `
Ты — помощник по поиску строительной техники и оборудования.

ВАЖНАЯ ИНФОРМАЦИЯ О КАТАЛОГЕ:
• Всего единиц техники: ${catalogIndex?.totalItems || 'загрузка...'}
• Последнее обновление: ${catalogIndex?.lastUpdated.toLocaleString('ru-RU')}

ДОСТУПНЫЕ КАТЕГОРИИ (топ-30):
${this.catalogIndexService.getCategoriesForPrompt(30)}

ПРАВИЛА ФОРМИРОВАНИЯ ЗАПРОСОВ:

1. Если пользователь спрашивает про категорию из списка выше:
   → Используй поле "category" с точным названием

2. Если пользователь спрашивает про категорию НЕ из списка:
   → Используй поле "text" для текстового поиска
   → В ответе предложи похожие категории из списка

3. Если пользователь спрашивает "что есть в каталоге" или "какие категории":
   → Перечисли топ-10 категорий из списка выше
   → НЕ делай запрос к базе

ПРИМЕРЫ:

✅ Хорошо:
Пользователь: "какие есть краны"
Ты: { "category": "Краны" }

Пользователь: "трактора"
Ты: В каталоге нет тракторов. Возможно, вас интересуют: Тягачи, Фронтальные погрузчики?

❌ Плохо:
Пользователь: "трактора"
Ты: { "category": "Трактор" }  // Такой категории нет!
`;

  this.messages.push({
    role: 'system',
    content: systemPrompt,
  });
}
```

## Результат

### До:
```
Пользователь: какие есть трактора
LLM: { "category": "Трактор" }
Система: Найдено: 0
```

### После:
```
Пользователь: какие есть трактора

Вариант 1 (LLM знает о каталоге):
LLM: В каталоге нет тракторов. Возможно, вас интересуют:
     • Тягачи (34 шт.)
     • Фронтальные погрузчики (17 шт.)
     • Самосвалы (32 шт.)

Вариант 2 (fallback поиск):
Система: Категория "Трактор" не найдена. Показаны результаты текстового поиска.
💡 Похожие категории:
   • Тягачи
   • Фронтальные погрузчики

📊 Популярные категории:
   • Краны (34 шт.)
   • Тягачи (34 шт.)
   • Самосвалы (32 шт.)
```

## Преимущества решения

1. ✅ **Умный LLM** - знает, что есть в каталоге
2. ✅ **Fallback** - если LLM ошибся, система исправит
3. ✅ **Подсказки** - пользователь видит, что доступно
4. ✅ **Производительность** - индекс кэшируется в памяти
5. ✅ **UX** - пользователь всегда получает полезный ответ

## См. также

- `docs/21_SEARCH_ISSUE_ANALYSIS.md` - Анализ проблемы
- `docs/16_QUERY_PARAMETER_NORMALIZATION.md` - Нормализация параметров

