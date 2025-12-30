/**
 * Маппер имен параметров от LLM к именам в БД.
 * 
 * LLM генерирует упрощенные имена ("глубина_копания_max"),
 * а в БД они хранятся с полными названиями и единицами ("Макс. глубина копания, мм.").
 */
export class ParameterNameMapper {
  /**
   * Карта соответствий: упрощенное имя → имя в БД
   */
  private static readonly PARAMETER_MAP: Record<string, string> = {
    // Глубина копания
    "глубина_копания": "Макс. глубина копания, мм.",
    "глубина_копания_max": "Макс. глубина копания, мм.",
    "глубина_копания_min": "Макс. глубина копания, мм.",
    "макс_глубина_копания": "Макс. глубина копания, мм.",
    
    // Объем ковша
    "объем_ковша": "Объем ковша",
    "объем_ковша_min": "Объем ковша",
    "объем_ковша_max": "Объем ковша",
    "емкость_ковша": "Объем ковша",
    
    // Грузоподъемность
    "грузоподъемность": "Грузоподъемность",
    "грузоподъемность_min": "Грузоподъемность",
    "грузоподъемность_max": "Грузоподъемность",
    "грузоподъёмность": "Грузоподъемность",
    
    // Мощность
    "мощность": "Мощность двигателя",
    "мощность_min": "Мощность двигателя",
    "мощность_max": "Мощность двигателя",
    "мощность_двигателя": "Мощность двигателя",
    "номинальная_мощность": "Номин. мощность, кВт.",
    "номин_мощность": "Номин. мощность, кВт.",
    
    // Вес
    "вес": "Вес в рабочем состоянии",
    "вес_min": "Вес в рабочем состоянии",
    "вес_max": "Вес в рабочем состоянии",
    "масса": "Вес в рабочем состоянии",
    "рабочий_вес": "Рабочий вес, т.",
    
    // Высота подъема
    "высота_подъема": "Высота подъема",
    "высота_подъема_max": "Высота подъема",
    "высота_подъема_min": "Высота подъема",
    "макс_высота_подъема": "Высота подъема",
    
    // Вылет стрелы
    "вылет_стрелы": "Вылет стрелы",
    "вылет_стрелы_max": "Вылет стрелы",
    "вылет_стрелы_min": "Вылет стрелы",
    "макс_вылет": "Вылет стрелы",
    
    // Тоннаж
    "тоннаж": "Рабочий вес, т.",
    "тоннаж_min": "Рабочий вес, т.",
    "тоннаж_max": "Рабочий вес, т.",
  };

  /**
   * Коэффициенты конверсии единиц измерения
   */
  private static readonly UNIT_CONVERSIONS: Record<string, { fromUnit: string; toUnit: string; factor: number }> = {
    "Макс. глубина копания, мм.": { fromUnit: "м", toUnit: "мм", factor: 1000 },
    "Высота подъема": { fromUnit: "м", toUnit: "мм", factor: 1000 },
    "Вылет стрелы": { fromUnit: "м", toUnit: "мм", factor: 1000 },
  };

  /**
   * Преобразует имя параметра от LLM к имени в БД.
   * Также обрабатывает суффиксы _min/_max.
   * 
   * @param llmParamName - имя параметра от LLM (например, "глубина_копания_max")
   * @returns имя параметра в БД и информация о суффиксе
   */
  static mapParameterName(llmParamName: string): {
    dbParamName: string;
    suffix?: '_min' | '_max';
    originalName: string;
  } {
    const originalName = llmParamName;
    let suffix: '_min' | '_max' | undefined;
    let baseName = llmParamName;

    // Определяем суффикс
    if (llmParamName.endsWith('_min')) {
      suffix = '_min';
      baseName = llmParamName.slice(0, -4);
    } else if (llmParamName.endsWith('_max')) {
      suffix = '_max';
      baseName = llmParamName.slice(0, -4);
    }

    // Ищем в карте соответствий
    const dbParamName = this.PARAMETER_MAP[llmParamName.toLowerCase()] 
      || this.PARAMETER_MAP[baseName.toLowerCase()]
      || baseName; // Если не нашли, используем как есть

    return {
      dbParamName,
      suffix,
      originalName,
    };
  }

  /**
   * Конвертирует значение с учетом единиц измерения.
   * 
   * Например: 5 метров → 5000 миллиметров для "Макс. глубина копания, мм."
   * 
   * @param dbParamName - имя параметра в БД
   * @param value - значение от LLM (обычно в метрах)
   * @returns сконвертированное значение
   */
  static convertValue(dbParamName: string, value: number): number {
    const conversion = this.UNIT_CONVERSIONS[dbParamName];
    if (conversion) {
      return value * conversion.factor;
    }
    return value;
  }

  /**
   * Получает информацию о единицах измерения для параметра.
   */
  static getUnitInfo(dbParamName: string): { fromUnit: string; toUnit: string } | null {
    return this.UNIT_CONVERSIONS[dbParamName] || null;
  }
}

