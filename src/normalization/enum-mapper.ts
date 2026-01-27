import type { ParameterDictionary } from "./parameter-dictionary.service";

/**
 * Маппер для преобразования enum значений
 */
export class EnumMapper {
  /**
   * Преобразует исходное enum значение в canonical
   */
  mapEnumValue(rawValue: string, paramDef: ParameterDictionary): string | null {
    if (paramDef.paramType !== "enum") return null;
    if (!paramDef.enumValues) return null;

    const normalized = rawValue.toLowerCase().trim();

    // Прямое совпадение
    if (paramDef.enumValues[normalized]) {
      return normalized;
    }

    // Поиск по значениям в enumValues
    for (const [canonical, label] of Object.entries(paramDef.enumValues)) {
      if (typeof label !== 'string') continue;
      
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
