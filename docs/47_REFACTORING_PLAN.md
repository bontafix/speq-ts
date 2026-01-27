# План рефакторинга проекта speq-ts

> Дата создания: 27 января 2026  
> Приоритизированный план устранения технического долга

## Общая информация

**Цель**: Устранение дублирования кода, оптимизация архитектуры, удаление мёртвого кода  
**Ожидаемый эффект**: Сокращение кода на 5-7%, снижение нагрузки на БД в 2 раза  
**Общее время**: 19-30 часов

---

## Приоритет 1: Критичные исправления

**Время**: 5-8 часов  
**Цель**: Устранение критичных проблем, влияющих на производительность и стабильность

### Задача 1.1: Удаление мёртвого кода

**Время**: 1-2 часа  
**Сложность**: Низкая  
**Риск**: Минимальный

#### Шаги:

1. **Проверить отсутствие импортов** (10 минут)
   ```bash
   # Проверка каждого файла перед удалением
   grep -r "from.*ollama.client" src/
   grep -r "from.*parameter-name-mapper" src/
   grep -r "from.*telegram.search" src/
   grep -r "from.*category.match" src/
   grep -r "from.*shared/utils/password" src/
   ```

2. **Удалить файлы** (5 минут)
   ```bash
   # API дубликат
   rm src/api/shared/utils/password.ts
   
   # LLM устаревший код
   rm src/llm/ollama.client.ts
   
   # Нормализация устаревший код
   rm src/normalization/parameter-name-mapper.ts
   
   # Telegram неиспользуемые модули
   rm src/telegram/telegram.search.ts
   rm src/telegram/category.match.ts
   
   # Устаревшие скрипты
   rm src/scripts/seed-parameter-dictionary.ts
   rm src/scripts/check-equipment-params.ts
   ```

3. **Обновить экспорты** (15 минут)
   - `src/llm/index.ts` — удалить экспорт `OllamaClient`
   - `src/normalization/index.ts` — удалить экспорт `ParameterNameMapper`

4. **Запустить сборку и проверить** (30 минут)
   ```bash
   npm run build
   npm run api:dev # проверить что API запускается
   npm run bot:dev # проверить что бот запускается
   ```

**Результат**: -700 строк мёртвого кода, 7 файлов удалено

---

### Задача 1.2: Создание общих утилит

**Время**: 2-3 часа  
**Сложность**: Средняя  
**Риск**: Средний (нужно обновить множество файлов)

#### Шаг 1: Создать утилиты (30 минут)

**src/api/shared/utils/date.ts**:
```typescript
/**
 * Форматирует дату в ISO строку
 */
export function formatDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return date instanceof Date 
    ? date.toISOString() 
    : new Date(date).toISOString();
}

/**
 * Форматирует даты created_at и updated_at из строки БД
 */
export function formatTimestamps(row: { created_at?: any; updated_at?: any }) {
  return {
    createdAt: row.created_at ? formatDate(row.created_at) : null,
    updatedAt: row.updated_at ? formatDate(row.updated_at) : null,
  };
}
```

**src/api/shared/utils/validation.ts**:
```typescript
import { AppError } from '../../core/errors/app-error';

/**
 * Парсит строковый ID в число с валидацией
 */
export function parseId(id: string, entityName: string): number {
  const parsed = parseInt(id, 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new AppError(`Invalid ${entityName} ID: ${id}`, 400);
  }
  return parsed;
}

/**
 * Валидирует положительное число
 */
export function validatePositiveNumber(
  value: any, 
  fieldName: string, 
  defaultValue?: number
): number | undefined {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  
  if (isNaN(num) || num <= 0) {
    throw new AppError(`${fieldName} must be a positive number`, 400);
  }
  
  return num;
}
```

**src/api/shared/utils/pagination.ts**:
```typescript
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Вычисляет параметры пагинации с безопасными значениями по умолчанию
 */
export function calculatePagination(
  page?: number, 
  limit?: number,
  defaultLimit = 20,
  maxLimit = 100
): PaginationParams {
  const safePage = page && page > 0 ? page : 1;
  let safeLimit = limit && limit > 0 ? limit : defaultLimit;
  
  // Ограничиваем максимальный limit
  if (safeLimit > maxLimit) {
    safeLimit = maxLimit;
  }
  
  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  };
}

/**
 * Формирует ответ с пагинацией
 */
export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  pagination: PaginationParams
) {
  return {
    items,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}
```

**src/api/shared/utils/query-builder.ts**:
```typescript
/**
 * Билдер для построения динамических UPDATE запросов
 */
export class UpdateQueryBuilder {
  private updates: string[] = [];
  private values: any[] = [];
  private paramIndex = 1;
  
  /**
   * Добавляет поле для обновления
   * @param field - имя поля в объекте данных
   * @param value - значение поля
   * @param dbField - имя поля в БД (если отличается от field)
   */
  addField(field: string, value: any, dbField?: string): this {
    if (value !== undefined) {
      this.updates.push(`${dbField || field} = $${this.paramIndex++}`);
      this.values.push(value);
    }
    return this;
  }
  
  /**
   * Добавляет поле с преобразованием snake_case
   */
  addFieldSnakeCase(field: string, value: any): this {
    if (value !== undefined) {
      const dbField = this.toSnakeCase(field);
      return this.addField(field, value, dbField);
    }
    return this;
  }
  
  /**
   * Строит финальный SQL запрос
   */
  build(table: string, idField: string, idValue: any): { sql: string; values: any[] } {
    if (this.updates.length === 0) {
      throw new Error('No fields to update');
    }
    
    const sql = `
      UPDATE ${table} 
      SET ${this.updates.join(', ')} 
      WHERE ${idField} = $${this.paramIndex} 
      RETURNING *
    `.trim();
    
    return {
      sql,
      values: [...this.values, idValue],
    };
  }
  
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
```

#### Шаг 2: Обновить сервисы (1.5-2 часа)

**Файлы для обновления**:
1. `src/api/modules/brands/brand.service.ts`
2. `src/api/modules/categories/category.service.ts`
3. `src/api/modules/equipment/equipment.service.ts`
4. `src/api/modules/users/user.service.ts`
5. `src/api/modules/parameter-dictionary/parameter-dictionary.service.ts`
6. `src/api/modules/auth/auth.service.ts`

**Пример рефакторинга для brand.service.ts**:

```typescript
// Было:
const createdAt = row.created_at instanceof Date 
  ? row.created_at.toISOString() 
  : new Date(row.created_at).toISOString();

// Стало:
import { formatTimestamps } from '../../shared/utils/date';
const { createdAt, updatedAt } = formatTimestamps(row);
```

```typescript
// Было:
const safePage = page > 0 ? page : 1;
const safeLimit = limit > 0 ? limit : 20;
const offset = (safePage - 1) * safeLimit;

// Стало:
import { calculatePagination } from '../../shared/utils/pagination';
const { page: safePage, limit: safeLimit, offset } = calculatePagination(page, limit);
```

```typescript
// Было:
const updates: string[] = [];
const values: any[] = [];
let paramIndex = 1;
if (data.name !== undefined) {
  updates.push(`name = $${paramIndex++}`);
  values.push(data.name);
}
// ... и так далее

// Стало:
import { UpdateQueryBuilder } from '../../shared/utils/query-builder';
const builder = new UpdateQueryBuilder();
builder
  .addField('name', data.name)
  .addField('description', data.description)
  .addFieldSnakeCase('logoUrl', data.logoUrl);

const { sql, values } = builder.build('brands', 'id', id);
```

#### Шаг 3: Обновить контроллеры (30 минут)

**Файлы для обновления**:
1. `src/api/modules/users/user.controller.ts`
2. `src/api/modules/brands/brand.controller.ts`
3. `src/api/modules/categories/category.controller.ts`

```typescript
// Было:
const userId = parseInt(id, 10);
if (isNaN(userId)) {
  throw new Error("Invalid user ID");
}

// Стало:
import { parseId } from '../../shared/utils/validation';
const userId = parseId(id, 'user');
```

#### Шаг 4: Тестирование (30 минут)

```bash
npm run build
npm test # если есть тесты
npm run api:dev # ручная проверка endpoints
```

**Результат**: Устранено ~500 строк дублирования, создано 4 переиспользуемых утилиты

---

### Задача 1.3: Унификация подключения к БД

**Время**: 2-3 часа  
**Сложность**: Средняя  
**Риск**: Средний (критичная инфраструктура)

#### Шаг 1: Анализ текущего состояния (15 минут)

```bash
# Проверить где используется каждый пул
grep -r "import.*pgPool" src/
grep -r "fastify.db" src/
```

#### Шаг 2: Обновить databasePlugin (30 минут)

**src/api/core/database/index.ts**:
```typescript
import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { pgPool } from '../../../db/pg'; // Используем общий пул
import { checkDatabaseHealth } from '../../../db/pg'; // Используем общую функцию

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }
}

/**
 * Плагин для регистрации database pool в Fastify
 * Использует общий pgPool из src/db/pg.ts
 */
export default fp(async function databasePlugin(fastify: FastifyInstance) {
  // Регистрируем общий пул
  fastify.decorate('db', pgPool);
  
  // Проверяем подключение при старте
  try {
    const health = await checkDatabaseHealth();
    if (!health.connected) {
      throw new Error('Database connection failed');
    }
    fastify.log.info('Database connected successfully');
    fastify.log.info(`PostgreSQL version: ${health.version}`);
  } catch (error) {
    fastify.log.error('Failed to connect to database:', error);
    throw error;
  }
  
  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing database connections...');
    await pgPool.end();
  });
}, {
  name: 'database',
});
```

#### Шаг 3: Удалить дублирующие файлы (5 минут)

```bash
# Эти файлы больше не нужны
rm src/api/core/database/pool.ts
rm src/api/core/database/health.ts
```

#### Шаг 4: Обновить EquipmentRepository для DI (30 минут)

**src/repository/equipment.repository.ts**:
```typescript
import { Pool, QueryResult } from 'pg';
// Удалить: import { pgPool } from "../db/pg";

export class EquipmentRepository {
  // Было: конструктор без параметров, использовал глобальный pgPool
  // Стало: принимает пул через DI
  constructor(private readonly pool: Pool) {}
  
  async fullTextSearch(query: SearchQuery, limit: number, offset = 0): Promise<EquipmentSummary[]> {
    // Было: const result = await pgPool.query(...)
    // Стало:
    const result = await this.pool.query(...);
    // ...
  }
  
  // Аналогично обновить все методы
}
```

#### Шаг 5: Обновить использование репозитория (30 минут)

**src/api/modules/search/index.ts**:
```typescript
// Было:
const repo = new EquipmentRepository();

// Стало:
const repo = new EquipmentRepository(fastify.db);
```

**src/app/container.ts**:
```typescript
import { pgPool } from '../db/pg';

// Было:
this.equipmentRepository = new EquipmentRepository();

// Стало:
this.equipmentRepository = new EquipmentRepository(pgPool);
```

**src/telegram/index.ts**:
```typescript
import { pgPool } from '../db/pg';

// В setupBot():
const equipmentRepository = new EquipmentRepository(pgPool);
```

#### Шаг 6: Обновить конфигурацию БД (15 минут)

Убедиться что `src/db/pg.ts` читает конфигурацию корректно:

```typescript
// Добавить логирование при инициализации
console.log('[DB] Initializing PostgreSQL connection pool');
console.log('[DB] Max connections:', process.env.DB_MAX_CONNECTIONS || 20);
```

#### Шаг 7: Тестирование (45 минут)

```bash
# Запустить все компоненты по очереди
npm run build

# 1. API
npm run api:dev
# Проверить endpoints, должны работать

# 2. Bot
npm run bot:dev
# Проверить команды в Telegram

# 3. Скрипты
ts-node src/scripts/show-normalized-data.ts
# Должны работать без ошибок

# 4. Проверить количество соединений в БД
# SELECT count(*) FROM pg_stat_activity WHERE datname = 'your_db_name';
```

**Результат**: 1 пул вместо 2, -100 строк дублирования, максимум 20 соединений вместо 40

---

## Приоритет 2: Улучшение архитектуры

**Время**: 10-15 часов  
**Цель**: Улучшение поддерживаемости и расширяемости

### Задача 2.1: Рефакторинг telegram/index.ts

**Время**: 4-6 часов  
**Сложность**: Высокая  
**Риск**: Средний

#### План разделения:

**Новая структура**:
```
src/telegram/
├── index.ts (главный файл, ~150 строк)
├── handlers/
│   ├── command.handler.ts (~150 строк)
│   ├── text.handler.ts (~100 строк)
│   └── callback.handler.ts (~200 строк)
├── services/
│   └── session.service.ts (~100 строк)
├── utils/
│   └── message.utils.ts (~100 строк)
├── keyboards.ts (существующий)
├── view.format.ts (существующий)
├── text.utils.ts (существующий)
├── session.store.ts (существующий)
└── types.ts (существующий)
```

#### Шаг 1: Создать утилиты сообщений (1 час)

**src/telegram/utils/message.utils.ts**:
```typescript
import { Context } from 'telegraf';
import { SessionStore } from '../session.store';
import { TelegramSession } from '../types';

/**
 * Отправляет сообщение и сохраняет message_id
 */
export async function sendAndTrack(
  ctx: Context,
  sessions: SessionStore,
  text: string,
  extra?: any
) {
  const message = await ctx.reply(text, extra);
  
  if (message?.message_id && ctx.from?.id) {
    await addMessageId(ctx.from.id, message.message_id, sessions);
  }
  
  return message;
}

/**
 * Добавляет message_id в сессию
 */
export async function addMessageId(
  userId: number,
  messageId: number,
  sessions: SessionStore
) {
  const session = await getOrCreateSession(userId, sessions);
  
  if (!session.messageIds) {
    session.messageIds = [];
  }
  
  session.messageIds.push(messageId);
  await sessions.set(session);
}

/**
 * Получает или создает сессию
 */
export async function getOrCreateSession(
  userId: number,
  sessions: SessionStore
): Promise<TelegramSession> {
  const existing = await sessions.get(userId);
  if (existing) return existing;
  
  return {
    telegramId: userId,
    state: 'chat',
    chatHistory: [],
    messageIds: [],
  };
}

/**
 * Удаляет предыдущие сообщения бота
 */
export async function deletePreviousMessages(
  ctx: Context,
  sessions: SessionStore
) {
  if (!ctx.from?.id) return;
  
  const session = await sessions.get(ctx.from.id);
  if (!session?.messageIds || session.messageIds.length === 0) return;
  
  for (const messageId of session.messageIds) {
    try {
      await ctx.deleteMessage(messageId);
    } catch (error) {
      // Сообщение уже удалено или недоступно
    }
  }
  
  // Очищаем список
  session.messageIds = [];
  await sessions.set(session);
}
```

#### Шаг 2: Создать SessionService (45 минут)

**src/telegram/services/session.service.ts**:
```typescript
import { SessionStore } from '../session.store';
import { TelegramSession } from '../types';

export class SessionService {
  constructor(private sessions: SessionStore) {}
  
  async get(userId: number): Promise<TelegramSession | null> {
    return this.sessions.get(userId);
  }
  
  async getOrCreate(userId: number): Promise<TelegramSession> {
    const existing = await this.sessions.get(userId);
    if (existing) return existing;
    
    return this.createNew(userId);
  }
  
  async reset(userId: number, state: TelegramSession['state'] = 'chat'): Promise<void> {
    const session: TelegramSession = {
      ...this.createNew(userId),
      state,
    };
    await this.sessions.set(session);
  }
  
  async update(session: TelegramSession): Promise<void> {
    await this.sessions.set(session);
  }
  
  async clear(userId: number): Promise<void> {
    await this.sessions.clear(userId);
  }
  
  private createNew(userId: number): TelegramSession {
    return {
      telegramId: userId,
      state: 'chat',
      chatHistory: [],
      messageIds: [],
    };
  }
}
```

#### Шаг 3-5: Вынести обработчики (2-3 часа)

Создать файлы `handlers/command.handler.ts`, `handlers/text.handler.ts`, `handlers/callback.handler.ts` с функциями обработчиков.

#### Шаг 6: Обновить главный файл (1 час)

**src/telegram/index.ts** (сокращённый):
```typescript
import { setupCommandHandlers } from './handlers/command.handler';
import { setupTextHandler } from './handlers/text.handler';
import { setupCallbackHandlers } from './handlers/callback.handler';
import { SessionService } from './services/session.service';

export async function setupBot() {
  // ... инициализация зависимостей
  
  const sessionService = new SessionService(sessions);
  
  // Регистрация обработчиков
  setupCommandHandlers(bot, { sessionService, catalogService, /* ... */ });
  setupTextHandler(bot, { sessionService, llmFactory, catalogService, /* ... */ });
  setupCallbackHandlers(bot, { sessionService, catalogIndex, catalogService, /* ... */ });
  
  // ... запуск бота
}
```

#### Шаг 7: Тестирование (30 минут)

Полное тестирование всех команд и сценариев бота.

**Результат**: 881 строка → ~750 строк в 7 файлах, улучшена читаемость и тестируемость

---

### Задача 2.2: Унификация интерфейсов

**Время**: 1-2 часа  
**Сложность**: Низкая  
**Риск**: Низкий

#### Шаг 1: Создать общий интерфейс (30 минут)

**src/shared/types/parameter-dictionary.ts**:
```typescript
/**
 * Общий интерфейс для parameter dictionary
 * Используется как в API, так и в нормализации
 */
export interface ParameterDictionary {
  key: string;
  labelRu: string;
  labelEn?: string;
  descriptionRu?: string;
  category: string;
  paramType: 'number' | 'enum' | 'boolean' | 'string';
  unit?: string;
  minValue?: number;
  maxValue?: number;
  enumValues?: Record<string, string>;
  aliases: string[];
  sqlExpression?: string;
  isSearchable: boolean;
  isFilterable: boolean;
  priority: number;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Внутренний формат из БД (snake_case)
 */
export interface ParameterDictionaryRow {
  key: string;
  label_ru: string;
  label_en?: string;
  description_ru?: string;
  category: string;
  param_type: 'number' | 'enum' | 'boolean' | 'string';
  unit?: string;
  min_value?: number;
  max_value?: number;
  enum_values?: Record<string, string>;
  aliases: string[];
  sql_expression?: string;
  is_searchable: boolean;
  is_filterable: boolean;
  priority: number;
  version: number;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Преобразует row из БД в ParameterDictionary
 */
export function rowToParameterDictionary(row: ParameterDictionaryRow): ParameterDictionary {
  return {
    key: row.key,
    labelRu: row.label_ru,
    labelEn: row.label_en,
    descriptionRu: row.description_ru,
    category: row.category,
    paramType: row.param_type,
    unit: row.unit,
    minValue: row.min_value,
    maxValue: row.max_value,
    enumValues: row.enum_values,
    aliases: row.aliases,
    sqlExpression: row.sql_expression,
    isSearchable: row.is_searchable,
    isFilterable: row.is_filterable,
    priority: row.priority,
    version: row.version,
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };
}
```

#### Шаг 2: Обновить модули (1 час)

Обновить `src/normalization/parameter-dictionary.service.ts` и `src/api/modules/parameter-dictionary/parameter-dictionary.service.ts` для использования общих типов.

**Результат**: Устранено несоответствие интерфейсов, улучшена типобезопасность

---

### Задача 2.3: Рефакторинг LLM провайдеров

**Время**: 3-4 часа  
**Сложность**: Средняя  
**Риск**: Низкий

#### Шаг 1: Создать базовый класс (1.5 часа)

**src/llm/providers/base-http.provider.ts**:
```typescript
import { LLMProvider, ChatOptions, ChatResponse, EmbeddingOptions, EmbeddingResponse } from './llm-provider.interface';

export abstract class BaseHTTPProvider implements LLMProvider {
  protected abstract protocol: 'http:' | 'https:';
  protected abstract defaultTimeout: number;
  
  /**
   * Выполняет HTTP запрос с таймаутом
   */
  protected async makeRequest(
    url: URL,
    payload: string,
    headers: Record<string, string>,
    timeout: number = this.defaultTimeout
  ): Promise<any> {
    const http = this.protocol === 'https:' ? require('https') : require('http');
    
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            ...headers,
          },
          timeout,
        },
        (res: any) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          
          res.on('end', () => {
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
              return;
            }
            
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(new Error(`Invalid JSON response: ${data}`));
            }
          });
        }
      );
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeout}ms`));
      });
      
      req.write(payload);
      req.end();
    });
  }
  
  /**
   * Извлекает текст ответа из chat response
   */
  protected extractChatContent(response: any): ChatResponse {
    if (!response.choices?.[0]?.message?.content) {
      throw new Error('Invalid chat response structure');
    }
    
    return {
      text: response.choices[0].message.content,
      usage: this.extractUsage(response.usage),
    };
  }
  
  /**
   * Извлекает embeddings из response
   */
  protected extractEmbeddings(response: any): EmbeddingResponse {
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid embeddings response structure');
    }
    
    return {
      embeddings: response.data.map((item: any) => item.embedding),
      usage: this.extractUsage(response.usage),
    };
  }
  
  /**
   * Извлекает usage информацию
   */
  protected extractUsage(usage: any) {
    if (!usage) return undefined;
    
    return {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    };
  }
  
  abstract chat(options: ChatOptions): Promise<ChatResponse>;
  abstract embeddings(options: EmbeddingOptions): Promise<EmbeddingResponse>;
  abstract ping(): Promise<boolean>;
}
```

#### Шаг 2-3: Обновить провайдеры (1.5-2 часа)

Переписать `OllamaProvider` и `OpenAIProvider` на использование `BaseHTTPProvider`.

#### Шаг 4: Тестирование (30 минут)

**Результат**: -200 строк дублирования, улучшена согласованность

---

### Задача 2.4: Оптимизация нормализации

**Время**: 2-3 часа  
**Сложность**: Средняя  
**Риск**: Низкий

#### Оптимизации:

1. **HashMap-индексы для поиска O(1)** (1 час)
2. **Глобальный кэш словаря** (1 час)
3. **Удаление ParameterNameMapper** (уже сделано в Приоритет 1)

**Результат**: Ускорение поиска в ~20 раз, снижение нагрузки на БД

---

## Приоритет 3: Дополнительная оптимизация

**Время**: 4-7 часов  
**Цель**: Полировка и дополнительные улучшения

### Задачи:

- Объединение дублирующихся скриптов
- Кэширование индекса категорий
- Улучшение типизации (использование типов Telegraf вместо any)

---

## Чеклист выполнения

### Приоритет 1 (5-8 часов)
- [x] 1.1. Удалить мёртвый код (7 файлов)
- [x] 1.2. Создать общие утилиты (4 файла)
- [x] 1.2. Обновить сервисы (6 файлов)
- [x] 1.2. Обновить контроллеры (3 файла)
- [x] 1.3. Унифицировать подключение к БД
- [x] 1.3. Обновить EquipmentRepository
- [x] Запустить полное тестирование

### Приоритет 2 (10-15 часов)
- [x] 2.1. Разделить telegram/index.ts
- [ ] 2.2. Унифицировать интерфейсы
- [x] 2.3. Рефакторинг LLM провайдеров
- [ ] 2.4. Оптимизация нормализации

### Приоритет 3 (4-7 часов)
- [ ] Объединить дублирующиеся скрипты
- [ ] Добавить кэширование индекса категорий
- [ ] Улучшить типизацию

---

## Метрики прогресса

После каждой задачи проверяйте:

```bash
# Размер кода
find src -name "*.ts" | xargs wc -l

# Количество файлов
find src -name "*.ts" | wc -l

# Тесты
npm test

# Сборка
npm run build

# Статический анализ
npm run lint # если есть
```

---

## Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Поломка существующего функционала | Средняя | Тщательное тестирование после каждой задачи |
| Конфликты при работе в команде | Низкая | Делать рефакторинг в отдельной ветке |
| Рост времени выполнения | Средняя | Разбить на небольшие PR, можно прерваться |

---

## Следующие шаги

1. **Создать ветку для рефакторинга**
   ```bash
   git checkout -b refactor/priority-1-critical-fixes
   ```

2. **Начать с Задачи 1.1** (удаление мёртвого кода)
   - Самая простая задача
   - Быстрый результат
   - Минимальный риск

3. **Коммитить часто**
   ```bash
   git commit -m "refactor: remove dead code (ollama.client.ts)"
   git commit -m "refactor: create date utilities"
   # и т.д.
   ```

4. **После Приоритета 1 - создать PR и получить ревью**

5. **Продолжить с Приоритетом 2 в новой ветке**
