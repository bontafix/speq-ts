# Обзор и Рефакторинг Архитектуры

## Текущая Архитектура

### Компоненты Системы

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI (Entry Point)                         │
│                   src/cli/index.ts                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                 AppContainer (DI)                            │
│              src/app/container.ts                            │
│   ┌─────────────────────────────────────────────┐           │
│   │ - ConfigService                             │           │
│   │ - EquipmentRepository                       │           │
│   │ - ParameterDictionaryService                │           │
│   │ - LLMProviderFactory                        │           │
│   │ - SearchEngine                              │           │
│   │ - CatalogService                            │           │
│   └─────────────────────────────────────────────┘           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│              ChatController (UI Logic)                       │
│             src/cli/chat.controller.ts                       │
│   ┌─────────────────────────────────────────────┐           │
│   │ - Управление readline                       │           │
│   │ - Отображение UI/UX                         │           │
│   │ - Обработка команд (/reset, /exit)          │           │
│   └─────────────────────────────────────────────┘           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│         InteractiveQueryBuilder (Dialog)                     │
│       src/llm/interactive-query.builder.ts                   │
│   ┌─────────────────────────────────────────────┐           │
│   │ - Ведение диалога с пользователем          │           │
│   │ - История сообщений                         │           │
│   │ - Формирование SearchQuery                  │           │
│   │ - Уточняющие вопросы                        │           │
│   └─────────────────────────────────────────────┘           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│           LLMProviderFactory (Abstraction)                   │
│         src/llm/providers/provider.factory.ts                │
│   ┌─────────────┬─────────────┬─────────────┐               │
│   │   Ollama    │    Groq     │   OpenAI    │               │
│   │  (локально) │  (облако)   │  (облако)   │               │
│   │             │             │             │               │
│   │ Chat ✅     │ Chat ✅     │ Chat ✅     │               │
│   │ Embed ✅    │ Embed ❌    │ Embed ✅    │               │
│   └─────────────┴─────────────┴─────────────┘               │
│                                                               │
│   • Автоматический fallback                                  │
│   • Health checks                                            │
│   • Умная подмена моделей                                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│            CatalogService (Domain Layer)                     │
│             src/catalog/catalog.service.ts                   │
│   ┌─────────────────────────────────────────────┐           │
│   │ - Нормализация запросов                     │           │
│   │ - Валидация параметров                      │           │
│   │ - Форматирование результатов                │           │
│   └─────────────────────────────────────────────┘           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│           SearchEngine (Hybrid Search)                       │
│            src/search/search.engine.ts                       │
│   ┌─────────────────────────────────────────────┐           │
│   │ Стратегия 1: Full-Text Search (FTS)         │           │
│   │   • plainto_tsquery                          │           │
│   │   • ts_rank                                  │           │
│   │   • Фильтры (category, brand, parameters)   │           │
│   │                                              │           │
│   │ Стратегия 2: Vector Search                  │           │
│   │   • Embedding через LLM                      │           │
│   │   • Cosine similarity (<=>)                  │           │
│   │   • pgvector extension                       │           │
│   │                                              │           │
│   │ Слияние: Reciprocal Rank Fusion (RRF)       │           │
│   │   score = 1 / (k + rank)                     │           │
│   └─────────────────────────────────────────────┘           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│        EquipmentRepository (Data Layer)                      │
│         src/repository/equipment.repository.ts               │
│   ┌─────────────────────────────────────────────┐           │
│   │ - fullTextSearch()                          │           │
│   │ - vectorSearchWithEmbedding()               │           │
│   │ - findWithoutEmbedding()                    │           │
│   │ - updateEmbedding()                         │           │
│   └─────────────────────────────────────────────┘           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│             PostgreSQL + pgvector                            │
│   ┌─────────────────────────────────────────────┐           │
│   │ Таблица: equipment                          │           │
│   │   • search_vector (tsvector) - автотриггер  │           │
│   │   • embedding (vector(768)) - через worker  │           │
│   │   • main_parameters (jsonb)                 │           │
│   │   • normalized_parameters (jsonb)           │           │
│   └─────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Процесс Диалога

```
1. Пользователь вводит запрос
         ↓
2. ChatController → InteractiveQueryBuilder.next()
         ↓
3. LLM анализирует запрос
         ↓
4a. action: "ask" → Уточняющий вопрос пользователю
         ↓ (цикл до maxTurns)
4b. action: "final" → SearchQuery готов
         ↓
5. CatalogService.searchEquipment(query)
         ↓
6. SearchEngine запускает параллельно:
   - FTS (точное совпадение слов + фильтры)
   - Vector (семантическое совпадение)
         ↓
7. RRF объединяет результаты
         ↓
8. Результаты выводятся пользователю
         ↓
9. LLM обогащается контекстом результатов
         ↓
10. Пользователь может уточнить запрос (goto 2)
```

## Выявленные Проблемы

### 🔴 Критические

1. **Отсутствие retry логики для LLM**
   - При временных сбоях сети весь диалог прерывается
   - Нет механизма повторных попыток
   - Местоположение: `InteractiveQueryBuilder.next()`, `SearchEngine.performVectorSearch()`

2. **Недостаточная обработка ошибок**
   - Многие catch блоки просто логируют, но не восстанавливают состояние
   - Пользователь не всегда понимает, что произошло
   - Местоположение: `ChatController`, `SearchEngine`

3. **Потенциальная SQL-инъекция**
   - Хотя используются параметризованные запросы, динамическое построение WHERE может быть уязвимым
   - Недостаточная валидация ключей параметров
   - Местоположение: `EquipmentRepository.fullTextSearch()`

### 🟡 Средней важности

4. **Отсутствие валидации входных данных**
   - SearchQuery принимается как есть от LLM
   - Нет проверки на максимальные значения limit
   - Нет санитизации text запросов
   - Местоположение: `CatalogService`, `InteractiveQueryBuilder`

5. **Слабый logging и monitoring**
   - Нет единого логгера
   - console.log/warn разбросаны по коду
   - Нет метрик производительности
   - Нет трассировки запросов

6. **Отсутствие кеширования**
   - Повторные запросы к LLM для идентичных текстов
   - Embeddings пересчитываются каждый раз
   - Словарь параметров загружается многократно

7. **Жесткая связанность компонентов**
   - ChatController знает о деталях InteractiveQueryBuilder
   - SearchEngine зависит от конкретных реализаций
   - Сложно тестировать изолированно

### 🟢 Незначительные

8. **Отсутствие rate limiting**
   - Пользователь может спамить LLM запросами
   - Нет защиты от исчерпания квот

9. **Нет graceful shutdown**
   - При Ctrl+C состояние может потеряться
   - Незавершенные запросы к БД

10. **Отсутствие пагинации результатов**
    - Все результаты выводятся сразу
    - Может быть неудобно при больших выдачах

## Предложения по Улучшению

### Фаза 1: Критические исправления

#### 1.1 Добавить retry логику с экспоненциальной задержкой

```typescript
// src/utils/retry.ts
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    multiplier: number;
  }
): Promise<T> {
  let lastError: Error;
  let delay = options.initialDelay;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === options.maxRetries) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * options.multiplier, options.maxDelay);
    }
  }

  throw lastError!;
}
```

Применить в:
- `InteractiveQueryBuilder.next()`
- `SearchEngine.performVectorSearch()`
- `LLMProviderFactory` методах

#### 1.2 Улучшить обработку ошибок

```typescript
// src/errors/application.errors.ts
export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class LLMError extends ApplicationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'LLM_ERROR', context);
  }
}

export class SearchError extends ApplicationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SEARCH_ERROR', context);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
  }
}
```

#### 1.3 Добавить валидацию и санитизацию

```typescript
// src/validation/search-query.validator.ts
export class SearchQueryValidator {
  private readonly MAX_LIMIT = 100;
  private readonly MAX_TEXT_LENGTH = 500;
  private readonly ALLOWED_PARAMETER_KEYS = /^[a-zA-Z0-9_а-яА-Я]+(_min|_max)?$/;

  validate(query: SearchQuery): ValidationResult {
    const errors: string[] = [];

    // Валидация text
    if (query.text) {
      if (query.text.length > this.MAX_TEXT_LENGTH) {
        errors.push(`text слишком длинный (максимум ${this.MAX_TEXT_LENGTH})`);
      }
      // Проверка на подозрительные символы
      if (/<script|javascript:|onerror=/i.test(query.text)) {
        errors.push('text содержит недопустимые символы');
      }
    }

    // Валидация limit
    if (query.limit !== undefined) {
      if (query.limit < 1 || query.limit > this.MAX_LIMIT) {
        errors.push(`limit должен быть от 1 до ${this.MAX_LIMIT}`);
      }
    }

    // Валидация параметров
    if (query.parameters) {
      for (const key of Object.keys(query.parameters)) {
        if (!this.ALLOWED_PARAMETER_KEYS.test(key)) {
          errors.push(`Недопустимое имя параметра: ${key}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  sanitize(query: SearchQuery): SearchQuery {
    const sanitized = { ...query };

    // Санитизация text
    if (sanitized.text) {
      sanitized.text = sanitized.text.trim().slice(0, this.MAX_TEXT_LENGTH);
    }

    // Санитизация limit
    if (sanitized.limit) {
      sanitized.limit = Math.min(Math.max(1, sanitized.limit), this.MAX_LIMIT);
    }

    return sanitized;
  }
}
```

### Фаза 2: Средней важности

#### 2.1 Создать единый Logger

```typescript
// src/utils/logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  component?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    if (level < this.level) return;

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const contextStr = context ? JSON.stringify(context) : '';

    console.log(`[${timestamp}] ${levelName} ${message} ${contextStr}`);
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    const fullContext = {
      ...context,
      error: error ? {
        message: error.message,
        stack: error.stack,
      } : undefined,
    };
    this.log(LogLevel.ERROR, message, fullContext);
  }
}

// Singleton instance
export const logger = new Logger(
  process.env.LOG_LEVEL === 'DEBUG' ? LogLevel.DEBUG : LogLevel.INFO
);
```

#### 2.2 Добавить кеширование

```typescript
// src/cache/simple-cache.ts
export class SimpleCache<K, V> {
  private cache = new Map<K, { value: V; expiresAt: number }>();
  
  constructor(private readonly ttlMs: number = 60000) {}

  set(key: K, value: V): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }
}

// В SearchEngine добавить:
private embeddingCache = new SimpleCache<string, number[]>(300000); // 5 min

async performVectorSearch(text: string, limit: number) {
  const cacheKey = `${text}:${this.config.llm.embeddingModel}`;
  let vector = this.embeddingCache.get(cacheKey);

  if (!vector) {
    const response = await this.llmFactory.embeddings({ 
      input: text,
      model: this.config.llm.embeddingModel
    });
    vector = response.embeddings[0];
    this.embeddingCache.set(cacheKey, vector);
  }

  return await this.equipmentRepository.vectorSearchWithEmbedding(text, vector, limit);
}
```

#### 2.3 Улучшить тестируемость через интерфейсы

```typescript
// src/catalog/catalog.service.interface.ts
export interface ICatalogService {
  searchEquipment(query: SearchQuery): Promise<CatalogSearchResult>;
  formatSummary(item: EquipmentSummary): string;
}

// src/search/search.engine.interface.ts
export interface ISearchEngine {
  search(query: SearchQuery): Promise<CatalogSearchResult>;
}

// Теперь можно легко мокировать в тестах
class MockSearchEngine implements ISearchEngine {
  async search(query: SearchQuery): Promise<CatalogSearchResult> {
    return {
      items: [],
      total: 0,
      usedStrategy: 'fts',
    };
  }
}
```

### Фаза 3: Оптимизации

#### 3.1 Rate Limiting

```typescript
// src/utils/rate-limiter.ts
export class RateLimiter {
  private requests: number[] = [];

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    
    // Удаляем старые запросы
    this.requests = this.requests.filter(t => t > now - this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.acquire();
    }

    this.requests.push(now);
  }
}

// В InteractiveQueryBuilder:
private rateLimiter = new RateLimiter(10, 60000); // 10 запросов в минуту

async next(userText: string): Promise<InteractiveQueryStep> {
  await this.rateLimiter.acquire();
  // ... rest of the code
}
```

#### 3.2 Graceful Shutdown

```typescript
// src/cli/index.ts
let isShuttingDown = false;

async function shutdown(app: AppContainer, chat: ChatController) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n🛑 Завершение работы...');
  
  // Дождаться завершения текущих операций
  await Promise.race([
    chat.waitForCompletion(),
    new Promise(resolve => setTimeout(resolve, 5000)) // Таймаут 5 сек
  ]);

  // Закрыть соединения
  await app.close();

  console.log('✅ Завершено');
  process.exit(0);
}

process.on('SIGINT', () => shutdown(app, chat));
process.on('SIGTERM', () => shutdown(app, chat));
```

#### 3.3 Пагинация результатов

```typescript
// В ChatController добавить команду /more
if (text === "/more") {
  if (this.lastResult && this.currentOffset < this.lastResult.total) {
    this.currentOffset += 10;
    const moreResults = await this.app.catalogService.searchEquipment({
      ...this.lastQuery,
      offset: this.currentOffset,
      limit: 10,
    });
    // Показать следующую страницу
  }
  continue;
}
```

## Рекомендации по Приоритетам

### Немедленно (в течение недели)
1. ✅ Добавить retry логику для LLM запросов
2. ✅ Улучшить обработку ошибок (typed errors)
3. ✅ Добавить валидацию SearchQuery

### Краткосрочно (1-2 недели)
4. ✅ Создать единый Logger
5. ✅ Добавить кеширование embeddings
6. ✅ Улучшить SQL-безопасность

### Среднесрочно (1 месяц)
7. ✅ Добавить rate limiting
8. ✅ Graceful shutdown
9. ✅ Юнит-тесты для критических компонентов
10. ✅ Мониторинг и метрики (опционально)

### Долгосрочно (по необходимости)
11. ⏳ Пагинация результатов
12. ⏳ История диалогов (persistent sessions)
13. ⏳ Распределенный кеш (Redis)
14. ⏳ Веб-интерфейс (опционально)

## Сильные Стороны Текущей Архитектуры

✅ **Четкое разделение слоев**
- CLI, Domain, Data Access хорошо разделены
- Каждый слой имеет свою ответственность

✅ **Гибкая система LLM провайдеров**
- Автоматический fallback работает отлично
- Легко добавить новые провайдеры
- Умная подмена моделей при fallback

✅ **Продвинутый гибридный поиск**
- FTS + Vector Search через RRF
- Нормализация параметров запроса
- Поддержка диапазонов (_min, _max)

✅ **Интерактивный диалог**
- LLM может задавать уточняющие вопросы
- История сохраняется между запросами
- Контекст результатов обогащает следующие запросы

✅ **Dependency Injection**
- AppContainer управляет зависимостями
- Легко подменить компоненты для тестов

## Заключение

Архитектура проекта **хорошо спроектирована** и следует best practices:
- Clean Architecture / Layered Architecture
- Dependency Injection
- Factory Pattern (LLM Providers)
- Strategy Pattern (FTS vs Vector Search)
- Builder Pattern (Interactive Query)

Основные проблемы связаны с **production-ready** аспектами:
- Обработка ошибок и восстановление
- Валидация и безопасность
- Monitoring и logging
- Производительность (кеширование)

Рекомендую **поэтапное улучшение** начиная с критических исправлений (retry, errors, validation), затем переходя к оптимизациям.





