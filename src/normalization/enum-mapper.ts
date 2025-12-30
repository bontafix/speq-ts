import type { ParameterDictionary } from "./parameter-dictionary.service";

/**
 * Маппер для преобразования enum значений
 */
export class EnumMapper {
  /**
   * Преобразует исходное enum значение в canonical
   */
  mapEnumValue(rawValue: string, paramDef: ParameterDictionary): string | null {
    if (paramDef.param_type !== "enum") return null;
    if (!paramDef.enum_values) return null;

    const normalized = rawValue.toLowerCase().trim();

    // Прямое совпадение
    if (paramDef.enum_values[normalized]) {
      return normalized;
    }

    // Поиск по значениям в enum_values
    for (const [canonical, label] of Object.entries(paramDef.enum_values)) {
      const normalizedLabel = label.toLowerCase();
      if (
        normalizedLabel === normalized ||
        normalized.includes(normalizedLabel) ||
        normalizedLabel.includes(normalized)
      ) {
        return canonical;
      }
    }

    return null;
  }
}

