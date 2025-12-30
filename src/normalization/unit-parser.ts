/**
 * Парсер единиц измерения для нормализации параметров
 */
export class UnitParser {
  /**
   * Парсит значение с единицами измерения и конвертирует в целевую единицу
   */
  parseValue(rawValue: string | number, targetUnit: string): number | null {
    if (typeof rawValue === "number") {
      return rawValue;
    }

    const str = String(rawValue).trim();

    // Извлекаем число
    const numberMatch = str.match(/[\d.,]+/);
    if (!numberMatch) return null;

    const numValue = parseFloat(numberMatch[0].replace(",", "."));
    if (isNaN(numValue)) return null;

    // Определяем единицу из исходного значения
    const sourceUnit = this.detectUnit(str);

    // Конвертируем в целевую единицу
    return this.convertUnit(numValue, sourceUnit, targetUnit);
  }

  /**
   * Определяет единицу измерения из строки
   */
  private detectUnit(str: string): string {
    const lower = str.toLowerCase();

    // Масса
    if (lower.includes("тонн") || lower.includes("т")) return "t";
    if (lower.includes("кг") || lower.includes("kg")) return "kg";
    if (lower.includes("г") && !lower.includes("кг")) return "g";

    // Мощность
    if (lower.includes("л.с.") || lower.includes("hp") || lower.includes("лс")) return "hp";
    if (lower.includes("квт") || lower.includes("кw") || lower.includes("kw")) return "kw";
    if (lower.includes("вт") && !lower.includes("квт") && !lower.includes("kw")) return "w";

    // Длина
    if (lower.includes("км") || lower.includes("km")) return "km";
    if (lower.includes("мм") || lower.includes("mm")) return "mm";
    if (lower.includes("см") || lower.includes("cm")) return "cm";
    if (lower.includes("м") && !lower.includes("мм") && !lower.includes("см")) return "m";

    // Объём
    if (lower.includes("м³") || lower.includes("м3") || lower.includes("m³") || lower.includes("m3")) return "m3";
    if (lower.includes("л") || lower.includes("литр") || lower.includes("l")) return "l";

    // Производительность
    if (lower.includes("т/ч") || lower.includes("t/h") || lower.includes("tph")) return "tph";
    if (lower.includes("м³/ч") || lower.includes("m3/h") || lower.includes("m3h")) return "m3h";

    // Скорость
    if (lower.includes("м/с") || lower.includes("m/s") || lower.includes("mps")) return "mps";

    // Частота
    if (lower.includes("гц") || lower.includes("hz")) return "hz";
    if (lower.includes("об/мин") || lower.includes("rpm")) return "rpm";

    return "unknown";
  }

  /**
   * Конвертирует значение из одной единицы в другую
   */
  private convertUnit(value: number, from: string, to: string): number {
    if (from === to) return value;

    const conversions: Record<string, Record<string, number>> = {
      // Масса
      t: { kg: 1000, g: 1000000 },
      kg: { t: 0.001, g: 1000 },
      g: { kg: 0.001, t: 0.000001 },

      // Мощность
      hp: { kw: 0.736, w: 736 },
      kw: { hp: 1.36, w: 1000 },
      w: { kw: 0.001, hp: 0.00136 },

      // Длина
      km: { m: 1000, cm: 100000, mm: 1000000 },
      m: { km: 0.001, cm: 100, mm: 1000 },
      cm: { m: 0.01, mm: 10, km: 0.00001 },
      mm: { m: 0.001, cm: 0.1, km: 0.000001 },

      // Объём
      m3: { l: 1000 },
      l: { m3: 0.001 },
    };

    if (conversions[from]?.[to]) {
      return value * conversions[from][to];
    }

    // Если конверсия неизвестна, возвращаем как есть
    return value;
  }
}

