# Запросы для получения параметров категорий

## Обзор

Бот выводит список параметров для каждой категории оборудования. В этом документе описаны SQL запросы, которые используются для получения этих данных.

## Таблица данных

Все данные берутся из таблицы **`equipment`**:
- Поле `category` - название категории
- Поле `main_parameters` - JSONB объект с параметрами оборудования
- Поле `is_active` - флаг активности записи

## Текущий запрос (только список параметров)

### Метод: `getCategoryParameters(category: string)`

**Файл:** `src/catalog/catalog-index.service.ts`

**SQL запрос:**
```sql
SELECT DISTINCT jsonb_object_keys(main_parameters) as param
FROM equipment
WHERE is_active = true 
  AND category = $1
  AND main_parameters IS NOT NULL 
  AND main_parameters != '{}'::jsonb
ORDER BY param
```

**Что делает:**
1. Извлекает все уникальные ключи из JSONB поля `main_parameters`
2. Фильтрует только активное оборудование (`is_active = true`)
3. Фильтрует по указанной категории (`category = $1`)
4. Исключает записи с пустыми параметрами
5. Сортирует по имени параметра

**Возвращает:** Массив строк с именами параметров

**Пример использования:**
```typescript
const params = await catalogIndex.getCategoryParameters("Экскаватор");
// Результат: ["Вес в рабочем состоянии", "Мощность двигателя", "Объем ковша", ...]
```

## Улучшенный запрос (параметры с количеством)

### Метод: `getCategoryParametersWithCount(category: string)`

**Файл:** `src/catalog/catalog-index.service.ts`

**SQL запрос:**
```sql
SELECT 
  param_name as name,
  COUNT(*) as count
FROM (
  SELECT 
    jsonb_object_keys(main_parameters) as param_name,
    id
  FROM equipment
  WHERE is_active = true 
    AND category = $1
    AND main_parameters IS NOT NULL 
    AND main_parameters != '{}'::jsonb
) subquery
GROUP BY param_name
ORDER BY count DESC, param_name
```

**Что делает:**
1. Во внутреннем подзапросе извлекает все ключи из `main_parameters` для каждой записи
2. Группирует по имени параметра
3. Считает количество записей (оборудования) для каждого параметра
4. Сортирует по количеству (по убыванию), затем по имени параметра

**Возвращает:** Массив объектов `{ name: string, count: number }`

**Пример использования:**
```typescript
const paramsWithCount = await catalogIndex.getCategoryParametersWithCount("Экскаватор");
// Результат: [
//   { name: "Мощность двигателя", count: 45 },
//   { name: "Вес в рабочем состоянии", count: 42 },
//   { name: "Объем ковша", count: 38 },
//   ...
// ]
```

## Как работает `jsonb_object_keys()`

Функция `jsonb_object_keys()` - это встроенная функция PostgreSQL, которая:
- Принимает JSONB объект
- Возвращает множество (set) всех ключей этого объекта
- Используется в SELECT для "разворачивания" JSONB в строки

**Пример:**
```sql
-- Если main_parameters = {"Мощность": "132 л.с.", "Вес": "13500 кг"}
-- То jsonb_object_keys() вернет:
-- "Мощность"
-- "Вес"
```

## Использование в боте

### Где вызывается

**Файл:** `src/telegram/index.ts`

**Обработчик callback:** `cat_p:<categoryIndex>`

**Код:**
```typescript
const paramsWithCount = await catalogIndex.getCategoryParametersWithCount(categoryName);

let msg = `⚙️ **Параметры для категории «${categoryName}»**:\n\n`;
if (paramsWithCount.length === 0) {
    msg += "_Параметры не найдены._";
} else {
    msg += paramsWithCount.map(p => `• ${p.name} (${p.count} шт.)`).join("\n");
}
```

**Результат в боте:**
```
⚙️ **Параметры для категории «Экскаватор»**:

• Мощность двигателя (45 шт.)
• Вес в рабочем состоянии (42 шт.)
• Объем ковша (38 шт.)
• Макс. глубина копания, мм. (35 шт.)
...
```

## Производительность

### Индексы

Для оптимизации запросов используются следующие индексы:
- `idx_equipment_category` - индекс по полю `category` (с фильтром `is_active = true`)
- GIN индекс на `main_parameters` (если создан) - для быстрого поиска по JSONB

### Рекомендации

1. Запросы выполняются быстро для категорий с небольшим количеством оборудования
2. Для категорий с большим количеством записей (>10000) может потребоваться оптимизация
3. Можно добавить GIN индекс на `main_parameters` для ускорения:
   ```sql
   CREATE INDEX idx_equipment_main_parameters ON equipment USING GIN(main_parameters);
   ```

## Альтернативные варианты запросов

### Вариант 1: Использование LATERAL JOIN

```sql
SELECT 
  param_name as name,
  COUNT(DISTINCT e.id) as count
FROM equipment e
CROSS JOIN LATERAL jsonb_object_keys(e.main_parameters) as param_name
WHERE e.is_active = true 
  AND e.category = $1
  AND e.main_parameters IS NOT NULL 
  AND e.main_parameters != '{}'::jsonb
GROUP BY param_name
ORDER BY count DESC, param_name
```

### Вариант 2: Использование jsonb_each_text()

```sql
SELECT 
  key as name,
  COUNT(*) as count
FROM equipment,
LATERAL jsonb_each_text(main_parameters) as param
WHERE is_active = true 
  AND category = $1
  AND main_parameters IS NOT NULL 
  AND main_parameters != '{}'::jsonb
GROUP BY key
ORDER BY count DESC, key
```

Оба варианта эквивалентны по результату, но могут отличаться по производительности в зависимости от размера данных.

