import { pgPool } from "../db/pg";
import { 
  ParameterDictionary, 
  ParameterDictionaryRow, 
  rowToParameterDictionary 
} from "../shared/types/parameter-dictionary";

export type { ParameterDictionary };

/**
 * Сервис для работы со справочником параметров
 */
export class ParameterDictionaryService {
  private dictionary: ParameterDictionary[] = [];
  private dictionaryLoaded = false;
  
  // Indexes for O(1) lookup
  private keyIndex: Map<string, ParameterDictionary> = new Map();
  private aliasIndex: Map<string, ParameterDictionary> = new Map();

  /**
   * Загружает справочник из БД
   */
  async loadDictionary(): Promise<void> {
    if (this.dictionaryLoaded) {
      return;
    }

    const sql = `
      SELECT 
        key,
        label_ru,
        description_ru,
        category,
        param_type,
        unit,
        min_value,
        max_value,
        enum_values,
        aliases,
        sql_expression,
        priority
      FROM parameter_dictionary
      ORDER BY priority, key
    `;

    const result = await pgPool.query<ParameterDictionaryRow>(sql);
    this.dictionary = result.rows.map(rowToParameterDictionary);

    // Build indexes
    this.keyIndex.clear();
    this.aliasIndex.clear();
    
    for (const param of this.dictionary) {
      const key = param.key.toLowerCase();
      this.keyIndex.set(key, param);
      
      if (param.aliases) {
        for (const alias of param.aliases) {
          // Алиасы тоже индексируем в нижнем регистре
          this.aliasIndex.set(alias.toLowerCase(), param);
        }
      }
    }

    this.dictionaryLoaded = true;
  }

  /**
   * Получить весь справочник
   */
  getDictionary(): ParameterDictionary[] {
    if (!this.dictionaryLoaded) {
      throw new Error("Справочник не загружен. Вызовите loadDictionary() сначала.");
    }
    return this.dictionary;
  }

  /**
   * Получить параметры, доступные для поиска (фильтрации)
   * (общий список без учета категории)
   * @param limit - макс. кол-во параметров (default 10)
   */
  getSearchableParameters(limit: number = 10): ParameterDictionary[] {
    if (!this.dictionaryLoaded) {
      throw new Error("Справочник не загружен.");
    }

    // Возвращаем параметры с высоким приоритетом (0-49 для основных фильтров)
    // Сортируем по приоритету (desc): чем больше priority, тем важнее
    return this.dictionary
      .filter((p) => (p.priority ?? 100) < 50) // Отсекаем детали и мусор
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .slice(0, limit);
  }

  /**
   * Получить параметры для поиска по конкретной категории
   *
   * Используется для подсказок пользователю: какие параметры
   * имеет смысл уточнять для выбранной категории техники.
   *
   * Правила:
   * - фильтруем по точному совпадению category (case-insensitive)
   * - учитываем только "важные" параметры (priority < 50)
   * - если по категории ничего не нашли, возвращаем общий список,
   *   чтобы не оставлять пользователя без подсказок
   *
   * @param category - значение поля category из словаря (каноническое имя категории)
   * @param limit - макс. кол-во параметров (default 10)
   */
  getSearchableParametersByCategory(category: string, limit: number = 10): ParameterDictionary[] {
    if (!this.dictionaryLoaded) {
      throw new Error("Справочник не загружен.");
    }

    const normalizedCategory = category.trim().toLowerCase();
    if (!normalizedCategory) {
      return this.getSearchableParameters(limit);
    }

    const byCategory = this.dictionary
      .filter((p) => (p.priority ?? 100) < 50)
      .filter((p) => p.category && p.category.toLowerCase() === normalizedCategory)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .slice(0, limit);

    if (byCategory.length > 0) {
      return byCategory;
    }

    // Fallback: если в словаре category не совпало (например, новая категория
    // или опечатка), возвращаем общий список, чтобы подсказка всё равно была.
    return this.getSearchableParameters(limit);
  }

  /**
   * Найти canonical key по алиасу
   * 
   * Важно: возвращает ТОЛЬКО ОДИН параметр для одного исходного ключа.
   * Приоритет: точное совпадение > точное совпадение алиаса > частичное совпадение
   */
  findCanonicalKey(rawKey: string): ParameterDictionary | null {
    if (!this.dictionaryLoaded) {
      throw new Error("Справочник не загружен. Вызовите loadDictionary() сначала.");
    }

    const normalizedKey = rawKey.toLowerCase().trim();

    // 1. Сначала ищем точные совпадения в индексах (O(1))
    // Проверяем точное совпадение ключа
    if (this.keyIndex.has(normalizedKey)) {
      return this.keyIndex.get(normalizedKey)!;
    }

    // Проверяем точное совпадение алиаса
    if (this.aliasIndex.has(normalizedKey)) {
      return this.aliasIndex.get(normalizedKey)!;
    }

    // 2. Затем ищем частичные совпадения (только если нет точных) - O(N)
    // Используем приоритет параметра для выбора лучшего совпадения
    let bestMatch: ParameterDictionary | null = null;
    let bestPriority = Infinity;

    for (const param of this.dictionary) {
      // Проверяем частичные совпадения алиасов
      const hasPartialMatch = param.aliases?.some(
        (alias) => {
          const aliasLower = alias.toLowerCase();
          // Частичное совпадение: исходный ключ содержит алиас или алиас содержит исходный ключ
          return normalizedKey.includes(aliasLower) || aliasLower.includes(normalizedKey);
        }
      );

      if (hasPartialMatch) {
        // Выбираем параметр с наименьшим приоритетом (0 = самый важный)
        const priority = param.priority ?? 100;
        if (priority < bestPriority) {
          bestMatch = param;
          bestPriority = priority;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Получить параметр по canonical key
   */
  getByKey(key: string): ParameterDictionary | null {
    if (!this.dictionaryLoaded) {
      throw new Error("Справочник не загружен. Вызовите loadDictionary() сначала.");
    }

    // Используем индекс для быстрого поиска
    return this.keyIndex.get(key.toLowerCase()) || null;
  }
}
