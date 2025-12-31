import type { SearchQuery } from "../catalog";
import { ParameterNormalizerService } from "./parameter-normalizer.service";
import { ParameterDictionaryService } from "./parameter-dictionary.service";

/**
 * Результат нормализации параметров запроса
 */
export interface QueryNormalizationResult {
  /**
   * Нормализованный SearchQuery с canonical параметрами
   */
  normalizedQuery: SearchQuery;
  /**
   * Статистика нормализации
   */
  stats: {
    total: number;
    normalized: number;
    unresolved: number;
    confidence: number;
  };
}

/**
 * Сервис для нормализации параметров в SearchQuery от LLM
 * 
 * Преобразует параметры из любого формата (например, "Мощность": "132 л.с.")
 * в canonical формат (например, "power_hp": 132) для использования в SQL запросах
 */
export class QueryParameterNormalizer {
  private normalizer: ParameterNormalizerService;

  constructor(dictionaryService: ParameterDictionaryService) {
    this.normalizer = new ParameterNormalizerService(dictionaryService);
  }

  /**
   * Нормализует параметры в SearchQuery
   * 
   * @param query - Исходный SearchQuery от LLM (параметры могут быть в любом формате)
   * @returns Нормализованный SearchQuery с canonical параметрами
   * 
   * @example
   * // Входной запрос от LLM:
   * {
   *   text: "экскаватор",
   *   parameters: {
   *     "Мощность": "132 л.с.",
   *     "Рабочий вес_max": "25000 кг",
   *     "Тип питания": "Дизельный"
   *   }
   * }
   * 
   * // Выходной нормализованный запрос:
   * {
   *   text: "экскаватор",
   *   parameters: {
   *     "power_hp": 132,
   *     "weight_kg_max": 25000,
   *     "fuel_type": "diesel"
   *   }
   * }
   */
  normalizeQuery(query: SearchQuery): QueryNormalizationResult {
    const normalizedQuery: SearchQuery = {
      ...query,
    };

    // Если параметров нет, возвращаем как есть
    if (!query.parameters || Object.keys(query.parameters).length === 0) {
      return {
        normalizedQuery,
        stats: {
          total: 0,
          normalized: 0,
          unresolved: 0,
          confidence: 1.0,
        },
      };
    }

    // Разделяем параметры на обычные и с суффиксами _min/_max
    const regularParams: Record<string, any> = {};
    const minParams: Record<string, any> = {};
    const maxParams: Record<string, any> = {};

    for (const [key, value] of Object.entries(query.parameters)) {
      if (key.endsWith("_min")) {
        const baseKey = key.replace("_min", "");
        minParams[baseKey] = value;
      } else if (key.endsWith("_max")) {
        const baseKey = key.replace("_max", "");
        maxParams[baseKey] = value;
      } else {
        regularParams[key] = value;
      }
    }

    // Нормализуем обычные параметры
    const regularResult = this.normalizer.normalize(regularParams);

    // Нормализуем параметры с _min
    const minResult = this.normalizer.normalize(minParams);

    // Нормализуем параметры с _max
    const maxResult = this.normalizer.normalize(maxParams);

    // Собираем нормализованные параметры
    const normalizedParameters: Record<string, string | number> = {};

    // Добавляем обычные параметры
    for (const [key, value] of Object.entries(regularResult.normalized)) {
      normalizedParameters[key] = value;
    }

    // Добавляем параметры с _min
    for (const [key, value] of Object.entries(minResult.normalized)) {
      normalizedParameters[`${key}_min`] = value;
    }

    // Добавляем параметры с _max
    for (const [key, value] of Object.entries(maxResult.normalized)) {
      normalizedParameters[`${key}_max`] = value;
    }

    // Обновляем запрос нормализованными параметрами
    normalizedQuery.parameters = normalizedParameters;

    // Подсчитываем статистику
    const total =
      Object.keys(regularParams).length +
      Object.keys(minParams).length +
      Object.keys(maxParams).length;

    const normalized =
      Object.keys(regularResult.normalized).length +
      Object.keys(minResult.normalized).length +
      Object.keys(maxResult.normalized).length;

    const unresolved =
      Object.keys(regularResult.unresolved).length +
      Object.keys(minResult.unresolved).length +
      Object.keys(maxResult.unresolved).length;

    return {
      normalizedQuery,
      stats: {
        total,
        normalized,
        unresolved,
        confidence: total > 0 ? normalized / total : 1.0,
      },
    };
  }

  /**
   * Создает SQL условия WHERE для нормализованных параметров
   * 
   * @param normalizedParameters - Нормализованные параметры (canonical формат)
   * @param values - Массив значений для параметризованного запроса (будет модифицирован)
   * @returns Массив SQL условий для WHERE
   * 
   * @example
   * const values: any[] = [];
   * const conditions = normalizer.buildSQLConditions(
   *   { power_hp: 132, weight_kg_max: 25000, fuel_type: "diesel" },
   *   values
   * );
   * // conditions = [
   * //   "(main_parameters->>'power_hp')::numeric = $1",
   * //   "(main_parameters->>'weight_kg')::numeric <= $2",
   * //   "main_parameters->>'fuel_type' = $3::text"
   * // ]
   * // values = ['power_hp', 132, 'weight_kg', 25000, 'fuel_type', 'diesel']
   */
  buildSQLConditions(
    normalizedParameters: Record<string, string | number>,
    values: any[]
  ): string[] {
    const conditions: string[] = [];

    for (const [key, value] of Object.entries(normalizedParameters)) {
      // Обработка суффиксов _min и _max
      if (key.endsWith("_min")) {
        const paramKey = key.replace("_min", "");
        const numValue = typeof value === "string" ? parseFloat(value) : Number(value);
        if (!Number.isNaN(numValue)) {
          values.push(paramKey, numValue);
          const keyIndex = values.length - 1;
          const valueIndex = values.length;
          conditions.push(
            `(normalized_parameters->>$${keyIndex})::numeric >= $${valueIndex}`
          );
        }
      } else if (key.endsWith("_max")) {
        const paramKey = key.replace("_max", "");
        const numValue = typeof value === "string" ? parseFloat(value) : Number(value);
        if (!Number.isNaN(numValue)) {
          values.push(paramKey, numValue);
          const keyIndex = values.length - 1;
          const valueIndex = values.length;
          conditions.push(
            `(normalized_parameters->>$${keyIndex})::numeric <= $${valueIndex}`
          );
        }
      } else {
        // Точное совпадение
        values.push(key, value);
        const keyIndex = values.length - 1;
        const valueIndex = values.length;

        // Для чисел используем numeric сравнение, для строк - text
        if (typeof value === "number") {
          conditions.push(
            `(normalized_parameters->>$${keyIndex})::numeric = $${valueIndex}`
          );
        } else {
          conditions.push(
            `normalized_parameters->>$${keyIndex} = $${valueIndex}::text`
          );
        }
      }
    }

    return conditions;
  }
}

