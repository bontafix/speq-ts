# Отчет об анализе размещения модулей

## Дата анализа: 2026-01-25

## Найденные проблемы

### 1. ❌ Неправильная инициализация в `src/api/modules/search/index.ts`

**Проблема:**
- `EquipmentRepository` создается без параметра `dictionaryService` (строка 9)
- `SearchEngine` создается без третьего параметра `llmFactory` (строка 19)

**Текущий код:**
```typescript
const repository = new EquipmentRepository();  // ❌ Без dictionaryService
const dictionaryService = new ParameterDictionaryService();
const searchEngine = new SearchEngine(repository, dictionaryService);  // ❌ Без llmFactory
```

**Правильная инициализация (как в `AppContainer`):**
```typescript
const dictionaryService = new ParameterDictionaryService();
const repository = new EquipmentRepository(dictionaryService);  // ✅ С dictionaryService
const llmFactory = new LLMProviderFactory();
const searchEngine = new SearchEngine(repository, dictionaryService, llmFactory);  // ✅ С llmFactory
```

**Последствия:**
- Нормализация параметров может работать некорректно в API модуле поиска
- Генерация эмбеддингов может быть недоступна в API модуле поиска

**Файл:** `src/api/modules/search/index.ts`

---

### 2. ❌ КРИТИЧЕСКАЯ ПРОБЛЕМА: TypeScript установлен не полностью

**Проблема:**
При запуске `npm run build` возникают ошибки:
- `Cannot find global type 'Array'`, `Boolean`, `Function`, `Number`, `Object`, `String` и т.д.
- `Cannot find type definition file for 'node'`
- `File '/home/boris/dev/speq-ts/node_modules/typescript/lib/lib.es2020.full.d.ts' not found`

**Диагностика:**
- ✅ `node_modules` существует
- ✅ `node_modules/typescript` существует (версия 5.9.3, размер 20M)
- ✅ `node_modules/@types/node` существует
- ❌ **КРИТИЧНО: Файлы библиотек TypeScript полностью отсутствуют**
  - `node_modules/typescript/lib/lib*.d.ts` - не найдены
  - `node_modules/typescript/lib/typescript.d.ts` - отсутствует
  - `node_modules/typescript/lib/lib.es2020.full.d.ts` - отсутствует
  - В папке `lib/` есть только исполняемые файлы (tsc.js, tsserver.js) и локали

**Причина:**
TypeScript установлен не полностью или поврежден. В папке `node_modules/typescript/lib/` отсутствуют файлы библиотек типов (lib*.d.ts), которые необходимы для компиляции.

**Решение:**
```bash
# Переустановить TypeScript
npm uninstall typescript
npm install --save-dev typescript@^5.9.3

# Или полная переустановка зависимостей
rm -rf node_modules package-lock.json
npm install
```

**Файлы:**
- `tsconfig.json` - конфигурация правильная, но TypeScript не может найти свои библиотеки
- `package.json` - зависимости указаны правильно
- `node_modules/typescript/lib/` - отсутствуют файлы библиотек

---

### 3. ✅ Проверка структуры модулей

**Результат:** Все модули на месте, структура корректна:
- ✅ `src/api/` - существует
- ✅ `src/telegram/index.ts` - существует
- ✅ `src/app/container.ts` - существует
- ✅ `src/catalog/index.ts` - существует
- ✅ `src/search/index.ts` - существует
- ✅ `src/normalization/index.ts` - существует
- ✅ `src/llm/index.ts` - существует
- ✅ `src/repository/equipment.repository.ts` - существует

---

### 4. ❌ КРИТИЧЕСКАЯ ПРОБЛЕМА: Неправильные относительные пути в `src/api/modules/`

**Проблема:**
Все импорты в модулях `src/api/modules/*` используют неправильные относительные пути `../../`, которые ведут к несуществующим модулям.

**Неправильные пути:**
- `src/api/modules/llm/index.ts` → `../../llm` ❌ (ведет к `src/api/llm`, которого нет)
- `src/api/modules/search/index.ts` → `../../catalog` ❌ (ведет к `src/api/catalog`, которого нет)
- `src/api/modules/search/index.ts` → `../../search` ❌ (ведет к `src/api/search`, которого нет)
- `src/api/modules/search/index.ts` → `../../normalization` ❌ (ведет к `src/api/normalization`, которого нет)
- `src/api/modules/search/index.ts` → `../../repository/equipment.repository` ❌ (ведет к `src/api/repository`, которого нет)
- `src/api/modules/telegram/index.ts` → `../../telegram` ❌ (ведет к `src/api/telegram`, которого нет)

**Правильные пути:**
От `src/api/modules/*/index.ts` до `src/*/index.ts` нужно подняться на **3 уровня вверх**, а не 2:
- `src/api/modules/llm/index.ts` → `../../../llm` ✅
- `src/api/modules/search/index.ts` → `../../../catalog` ✅
- `src/api/modules/search/index.ts` → `../../../search` ✅
- `src/api/modules/search/index.ts` → `../../../normalization` ✅
- `src/api/modules/search/index.ts` → `../../../repository/equipment.repository` ✅
- `src/api/modules/telegram/index.ts` → `../../../telegram` ✅

**Файлы с ошибками:**
1. `src/api/modules/llm/index.ts` (строка 2) - `../../llm` → должно быть `../../../llm`
2. `src/api/modules/search/index.ts` (строки 2, 3, 4, 5, 6) - все пути `../../*` → должны быть `../../../*`
3. `src/api/modules/telegram/index.ts` (строка 2) - `../../telegram` → должно быть `../../../telegram`

**Примечание:** Импорты внутри `src/api/` (например, `../../shared`, `../../core`, `../../modules`) - правильные, так как они остаются внутри `src/api/`.

---

## Резюме

### Критические проблемы:
1. **❌ Неправильные относительные пути в `src/api/modules/*`** - БЛОКИРУЕТ КОМПИЛЯЦИЮ
   - Все импорты используют `../../` вместо `../../../`
   - Это основная причина ошибок компиляции после переустановки TypeScript
   - Затронуты файлы: `llm/index.ts`, `search/index.ts`, `telegram/index.ts`

2. **Неправильная инициализация в `src/api/modules/search/index.ts`** - функциональная проблема
   - `EquipmentRepository` создается без `dictionaryService`
   - `SearchEngine` создается без `llmFactory`

### Все в порядке:
- Структура модулей корректна
- Импорты используют правильные относительные пути
- Все необходимые файлы на месте

---

## ✅ ИСПРАВЛЕНО

Все критические проблемы с путями исправлены:
- ✅ `src/api/modules/llm/index.ts` - путь исправлен на `../../../llm`
- ✅ `src/api/modules/search/index.ts` - все пути исправлены на `../../../*`
- ✅ `src/api/modules/telegram/index.ts` - путь исправлен на `../../../telegram`
- ✅ `src/api/modules/search/index.ts` - инициализация исправлена (добавлены `dictionaryService` и `llmFactory`)

Ошибки компиляции с путями (`error TS2307: Cannot find module`) устранены.

Остались только ошибки в скрипте `src/scripts/auto-generate-dictionary.ts`, которые не влияют на работу бота.

---

## Рекомендации по исправлению (для оставшихся проблем)

### Приоритет 1 (КРИТИЧНО - блокирует компиляцию):

1. **Исправить относительные пути в `src/api/modules/*`:**

   **Файл: `src/api/modules/llm/index.ts` (строка 2)**
   ```typescript
   // Было:
   import { LLMProviderFactory, ProviderType } from "../../llm";
   
   // Должно быть:
   import { LLMProviderFactory, ProviderType } from "../../../llm";
   ```

   **Файл: `src/api/modules/search/index.ts` (строки 2-6)**
   ```typescript
   // Было:
   import { CatalogService } from "../../catalog";
   import { SearchEngine } from "../../search";
   import { EquipmentRepository } from "../../repository/equipment.repository";
   import { ParameterDictionaryService } from "../../normalization";
   import { SearchQuery } from "../../catalog";
   
   // Должно быть:
   import { CatalogService } from "../../../catalog";
   import { SearchEngine } from "../../../search";
   import { EquipmentRepository } from "../../../repository/equipment.repository";
   import { ParameterDictionaryService } from "../../../normalization";
   import { SearchQuery } from "../../../catalog";
   ```

   **Файл: `src/api/modules/telegram/index.ts` (строка 2)**
   ```typescript
   // Было:
   import { handleUpdate, setWebhook, deleteWebhook, getWebhookInfo } from "../../telegram";
   
   // Должно быть:
   import { handleUpdate, setWebhook, deleteWebhook, getWebhookInfo } from "../../../telegram";
   ```

2. **Проверить компиляцию:**
   ```bash
   npm run build
   ```

### Приоритет 2 (Функциональные проблемы):

3. **Исправить инициализацию в `src/api/modules/search/index.ts`:**
   - Передать `dictionaryService` в конструктор `EquipmentRepository`
   - Добавить `llmFactory` в конструктор `SearchEngine`
