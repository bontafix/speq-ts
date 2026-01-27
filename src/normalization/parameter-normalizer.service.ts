import { ParameterDictionaryService, type ParameterDictionary } from "./parameter-dictionary.service";
import { UnitParser } from "./unit-parser";
import { EnumMapper } from "./enum-mapper";

export interface NormalizationResult {
  normalized: Record<string, any>;
  unresolved: Record<string, any>;
  confidence: number;
}

/**
 * Сервис для нормализации параметров оборудования
 */
export class ParameterNormalizerService {
  private unitParser: UnitParser;
  private enumMapper: EnumMapper;

  constructor(private dictionaryService: ParameterDictionaryService) {
    this.unitParser = new UnitParser();
    this.enumMapper = new EnumMapper();
  }

  /**
   * Нормализует raw параметры в canonical
   */
  normalize(rawParams: Record<string, any>): NormalizationResult {
    const normalized: Record<string, any> = {};
    const unresolved: Record<string, any> = {};

    for (const [rawKey, rawValue] of Object.entries(rawParams)) {
      // Пропускаем null/undefined
      if (rawValue == null) continue;

      // Находим canonical key
      const paramDef = this.dictionaryService.findCanonicalKey(rawKey);
      if (!paramDef) {
        unresolved[rawKey] = rawValue;
        continue;
      }

      // Нормализуем значение в зависимости от типа
      let normalizedValue: any = null;

      if (paramDef.paramType === "number") {
        normalizedValue = this.unitParser.parseValue(rawValue, paramDef.unit || "");

        // Мягкая валидация диапазона (только предупреждение, не отбрасываем значение)
        if (normalizedValue != null && process.env.DEBUG) {
          if (paramDef.minValue != null && normalizedValue < paramDef.minValue) {
            console.warn(
              `[Normalization] Значение ${normalizedValue} ниже рекомендованного минимума ${paramDef.minValue} для ${paramDef.key} (единица: ${paramDef.unit})`
            );
          }
          if (paramDef.maxValue != null && normalizedValue > paramDef.maxValue) {
            console.warn(
              `[Normalization] Значение ${normalizedValue} выше рекомендованного максимума ${paramDef.maxValue} для ${paramDef.key} (единица: ${paramDef.unit})`
            );
          }
        }
      } else if (paramDef.paramType === "enum") {
        normalizedValue = this.enumMapper.mapEnumValue(String(rawValue), paramDef);
      } else if (paramDef.paramType === "boolean") {
        const str = String(rawValue).toLowerCase();
        if (str === "true" || str === "1" || str === "да" || str === "yes") {
          normalizedValue = true;
        } else if (str === "false" || str === "0" || str === "нет" || str === "no") {
          normalizedValue = false;
        }
      } else if (paramDef.paramType === "string") {
        // Для строковых полей (например, "Шины", "Кабина") сохраняем как есть.
        // Важно: пустые строки считаем невалидными.
        if (typeof rawValue === "string") {
          const s = rawValue.trim();
          normalizedValue = s.length > 0 ? s : null;
        } else if (typeof rawValue === "number" || typeof rawValue === "boolean") {
          normalizedValue = String(rawValue);
        } else {
          // объекты/массивы
          const s = JSON.stringify(rawValue);
          normalizedValue = s && s !== "{}" && s !== "[]" ? s : null;
        }
      }

      if (normalizedValue != null) {
        normalized[paramDef.key] = normalizedValue;
      } else {
        unresolved[rawKey] = rawValue;
      }
    }

    const total = Object.keys(rawParams).length;
    const normalizedCount = Object.keys(normalized).length;
    const confidence = total > 0 ? normalizedCount / total : 0;

    return {
      normalized,
      unresolved,
      confidence,
    };
  }

  /**
   * Получить статистику нормализации
   */
  getNormalizationStats(rawParams: Record<string, any>): {
    total: number;
    normalized: number;
    unresolved: number;
    confidence: number;
  } {
    const result = this.normalize(rawParams);
    return {
      total: Object.keys(rawParams).length,
      normalized: Object.keys(result.normalized).length,
      unresolved: Object.keys(result.unresolved).length,
      confidence: result.confidence,
    };
  }
}
