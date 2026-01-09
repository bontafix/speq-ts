import { pgPool } from "../db/pg";

export interface ParameterDictionary {
  key: string;
  label_ru: string;
  description_ru?: string;
  category: string;
  // string нужен для грузовых текстовых характеристик (шины/кабина/мосты и т.п.)
  param_type: "number" | "enum" | "boolean" | "string";
  unit?: string;
  min_value?: number;
  max_value?: number;
  enum_values?: Record<string, string>;
  aliases: string[];
  sql_expression: string;
  priority: number;
}

/**
 * Сервис для работы со справочником параметров
 */
export class ParameterDictionaryService {
  private dictionary: ParameterDictionary[] = [];
  private dictionaryLoaded = false;

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

    const result = await pgPool.query(sql);
    this.dictionary = result.rows.map((row) => {
      const entry: ParameterDictionary = {
        key: row.key,
        label_ru: row.label_ru,
        category: row.category,
        param_type: row.param_type,
        aliases: row.aliases || [],
        sql_expression: row.sql_expression,
        priority: row.priority,
      };

      if (row.description_ru) entry.description_ru = row.description_ru;
      if (row.unit) entry.unit = row.unit;
      if (row.min_value != null) entry.min_value = Number(row.min_value);
      if (row.max_value != null) entry.max_value = Number(row.max_value);
      if (row.enum_values) entry.enum_values = row.enum_values;

      return entry;
    });

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
   * @param categoryId - (опционально) ID категории оборудования для уточнения релевантности
   * @param limit - макс. кол-во параметров (default 10)
   */
  getSearchableParameters(limit: number = 10): ParameterDictionary[] {
    if (!this.dictionaryLoaded) {
      throw new Error("Справочник не загружен.");
    }

    // Возвращаем параметры с высоким приоритетом (0-29 для основных фильтров)
    // Сортируем по приоритету (asc)
    return this.dictionary
      .filter((p) => p.priority < 50) // Отсекаем детали и мусор
      .sort((a, b) => a.priority - b.priority)
      .slice(0, limit);
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

    // Сначала ищем точные совпадения (приоритет выше)
    for (const param of this.dictionary) {
      // Проверяем точное совпадение ключа
      if (param.key.toLowerCase() === normalizedKey) {
        return param;
      }

      // Проверяем точное совпадение алиаса
      if (
        param.aliases.some(
          (alias) => alias.toLowerCase() === normalizedKey
        )
      ) {
        return param;
      }
    }

    // Затем ищем частичные совпадения (только если нет точных)
    // Используем приоритет параметра для выбора лучшего совпадения
    let bestMatch: ParameterDictionary | null = null;
    let bestPriority = Infinity;

    for (const param of this.dictionary) {
      // Проверяем частичные совпадения алиасов
      const hasPartialMatch = param.aliases.some(
        (alias) => {
          const aliasLower = alias.toLowerCase();
          // Частичное совпадение: исходный ключ содержит алиас или алиас содержит исходный ключ
          return normalizedKey.includes(aliasLower) || aliasLower.includes(normalizedKey);
        }
      );

      if (hasPartialMatch) {
        // Выбираем параметр с наименьшим приоритетом (0 = самый важный)
        if (param.priority < bestPriority) {
          bestMatch = param;
          bestPriority = param.priority;
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

    return this.dictionary.find((p) => p.key === key) || null;
  }
}

