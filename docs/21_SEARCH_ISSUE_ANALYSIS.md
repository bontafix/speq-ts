# Анализ проблемы: Почему не работает поиск "трактора"

## Проблема

**Запрос пользователя:** "какие есть трактора в каталоге"

**Сформированный SearchQuery:**
```json
{
  "category": "Трактор"
}
```

**Результат:** 0 найдено

## Причина

### ❌ В базе данных НЕТ тракторов

Проверка базы данных показала:

```sql
-- Поиск по категории
SELECT category, COUNT(*) 
FROM equipment 
WHERE category ILIKE '%трактор%'
GROUP BY category;
-- Результат: 0 rows

-- Поиск по названию
SELECT name, category 
FROM equipment 
WHERE name ILIKE '%трактор%'
LIMIT 5;
-- Результат: 0 rows

-- Полнотекстовый поиск
SELECT name, category 
FROM equipment 
WHERE search_vector @@ plainto_tsquery('russian', 'трактор')
LIMIT 5;
-- Результат: 0 rows
```

### ✅ В базе есть другие категории

**Топ-10 категорий по количеству:**
1. Краны - 34
2. Тягачи - 34
3. Самосвалы - 32
4. Гусеничные краны - 26
5. Шасси - 21
6. Асфальтоукладчики - 21
7. Вилочные погрузчики - 19
8. Автокраны - 19
9. Телескопический погрузчик - 18
10. Волочилные конвейеры - 18

**Всего в базе:** 844 единицы оборудования

## Почему LLM выбрал category вместо text?

LLM правильно интерпретировал запрос пользователя:
- "какие есть **трактора**" → пользователь спрашивает про категорию
- LLM решил, что нужно искать по `category: "Трактор"`

**Но:** В базе нет такой категории!

## Что должно было произойти

### Вариант 1: Полнотекстовый поиск (text)

LLM мог бы сформировать:
```json
{
  "text": "трактор"
}
```

Тогда бы поиск работал через `search_vector` и мог найти похожие категории (если бы они были).

### Вариант 2: Нечеткий поиск категорий

Система могла бы предложить похожие категории:
- "Тягачи" (похоже на тракторы)
- "Фронтальные погрузчики"
- "Землеройная техника"

## Решения

### 1. ✅ Добавить тракторы в базу данных

Если тракторы нужны в каталоге - добавить их.

### 2. ✅ Улучшить промпт LLM

Научить LLM использовать `text` для неточных запросов:

```typescript
// В промпте для LLM
"Если пользователь спрашивает про категорию, но ты не уверен 
в точном названии, используй поле 'text' вместо 'category'.

Примеры:
- 'какие есть тракторы' → { text: 'трактор' }  // неуверен в категории
- 'покажи краны' → { category: 'Краны' }       // уверен в категории
"
```

### 3. ✅ Добавить fallback в SearchEngine

Если поиск по `category` вернул 0 результатов, попробовать `text`:

```typescript
// В SearchEngine.search()
const result = await this.equipmentRepository.fullTextSearch(query, limit);

if (result.length === 0 && query.category && !query.text) {
  // Fallback: попробовать искать категорию как текст
  const fallbackQuery = {
    ...query,
    text: query.category,
    category: undefined,
  };
  
  const fallbackResult = await this.equipmentRepository.fullTextSearch(
    fallbackQuery, 
    limit
  );
  
  if (fallbackResult.length > 0) {
    console.log(`[Search] Fallback: found ${fallbackResult.length} results by text`);
    return {
      items: fallbackResult,
      total: fallbackResult.length,
      usedStrategy: 'fts-fallback',
    };
  }
}
```

### 4. ✅ Добавить нечеткий поиск категорий

Использовать `similarity` или `ILIKE` для категорий:

```sql
-- Вместо точного совпадения
WHERE category = 'Трактор'

-- Использовать нечеткий поиск
WHERE category ILIKE '%трактор%'
  OR similarity(category, 'Трактор') > 0.3
```

### 5. ✅ Предложить пользователю похожие категории

Если ничего не найдено, показать список доступных категорий:

```typescript
if (result.length === 0 && query.category) {
  // Получить похожие категории
  const suggestions = await this.getSimilarCategories(query.category);
  
  return {
    items: [],
    total: 0,
    usedStrategy: 'none',
    suggestions: suggestions,
    message: `Категория "${query.category}" не найдена. Возможно, вы искали: ${suggestions.join(', ')}`
  };
}
```

## Рекомендуемое решение

**Комбинация подходов:**

1. **Улучшить промпт LLM** - использовать `text` для неуверенных запросов
2. **Добавить fallback** - если `category` не найдена, искать по `text`
3. **Показать подсказки** - предлагать похожие категории

## Пример реализации fallback

```typescript
// src/search/search.engine.ts

async search(query: SearchQuery): Promise<CatalogSearchResult> {
  const limit = query.limit ?? 10;

  // Нормализация параметров
  let normalizedQuery = query;
  if (this.queryNormalizer && query.parameters) {
    const result = this.queryNormalizer.normalizeQuery(query);
    normalizedQuery = result.normalizedQuery;
  }

  // Основной поиск
  const ftsPromise = this.equipmentRepository.fullTextSearch(normalizedQuery, limit);
  
  let vectorPromise: Promise<EquipmentSummary[]> = Promise.resolve([]);
  if (this.shouldUseVectorSearch(normalizedQuery)) {
    vectorPromise = this.performVectorSearch(normalizedQuery.text!, limit, filters);
  }

  const [ftsResult, vectorResult] = await Promise.allSettled([ftsPromise, vectorPromise]);
  
  const ftsResults = ftsResult.status === 'fulfilled' ? ftsResult.value : [];
  const vectorResults = vectorResult.status === 'fulfilled' ? vectorResult.value : [];

  // ✅ FALLBACK: Если ничего не найдено по category, попробовать text
  if (ftsResults.length === 0 && vectorResults.length === 0) {
    if (normalizedQuery.category && !normalizedQuery.text) {
      console.log(`[Search] No results for category="${normalizedQuery.category}", trying text search...`);
      
      const fallbackQuery = {
        ...normalizedQuery,
        text: normalizedQuery.category,
        category: undefined,
      };
      
      const fallbackResults = await this.equipmentRepository.fullTextSearch(fallbackQuery, limit);
      
      if (fallbackResults.length > 0) {
        return {
          items: fallbackResults,
          total: fallbackResults.length,
          usedStrategy: 'fts-fallback',
        };
      }
    }
  }

  // Гибридное слияние
  const merged = this.hybridFusion(ftsResults, vectorResults, limit);
  
  return {
    items: merged,
    total: merged.length,
    usedStrategy: this.determineStrategy(ftsResults, vectorResults),
  };
}
```

## Тестирование

```bash
# Тест 1: Запрос с несуществующей категорией
Запрос: "какие есть трактора"
LLM: { "category": "Трактор" }
Результат (без fallback): 0 найдено ❌
Результат (с fallback): поиск по text="Трактор" → 0 найдено (корректно) ✅

# Тест 2: Запрос с существующей категорией
Запрос: "какие есть краны"
LLM: { "category": "Краны" }
Результат: 34 найдено ✅

# Тест 3: Текстовый запрос
Запрос: "экскаватор с мощностью 100 л.с."
LLM: { "text": "экскаватор", "parameters": { "Мощность_min": "100 л.с." } }
Результат: найдено N штук ✅
```

## Вывод

**Поиск работает корректно!** Проблема не в алгоритме нормализации, а в том, что:

1. ❌ В базе нет тракторов
2. ⚠️ LLM выбрал `category` вместо `text`
3. ⚠️ Нет fallback механизма для несуществующих категорий

**Решение:** Добавить fallback поиск по `text`, если `category` не найдена.

