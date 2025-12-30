import { SearchQuery } from "../catalog";

/**
 * Валидатор SearchQuery от LLM.
 * Проверяет и нормализует JSON, полученный от языковой модели.
 */
export class SearchQueryValidator {
  /**
   * Проверка и нормализация имени параметра.
   * Разрешены только буквы (латиница + кириллица), цифры и подчеркивания.
   */
  private static isValidParameterKey(key: string): boolean {
    return /^[a-zA-Zа-яА-ЯёЁ0-9_]+$/.test(key) && key.length > 0 && key.length < 100;
  }

  /**
   * Валидация и нормализация SearchQuery.
   * Возвращает очищенный объект с корректными типами данных.
   */
  static validate(query: any): SearchQuery {
    if (!query || typeof query !== "object") {
      throw new Error("SearchQuery должен быть объектом");
    }

    const validated: SearchQuery = {};
    const issues: string[] = [];

    // Валидация text
    if (query.text !== undefined) {
      if (typeof query.text === "string") {
        const trimmed = query.text.trim();
        if (trimmed.length > 0 && trimmed.length <= 500) {
          validated.text = trimmed;
        } else if (trimmed.length > 500) {
          validated.text = trimmed.substring(0, 500);
          issues.push(`text обрезан до 500 символов`);
        }
      } else {
        issues.push(`text должен быть строкой, получено: ${typeof query.text}`);
      }
    }

    // Валидация category
    if (query.category !== undefined) {
      if (typeof query.category === "string") {
        const trimmed = query.category.trim();
        if (trimmed.length > 0 && trimmed.length <= 100) {
          validated.category = trimmed;
        } else if (trimmed.length > 100) {
          validated.category = trimmed.substring(0, 100);
          issues.push(`category обрезан до 100 символов`);
        }
      } else {
        issues.push(`category должен быть строкой, получено: ${typeof query.category}`);
      }
    }

    // Валидация subcategory
    if (query.subcategory !== undefined) {
      if (typeof query.subcategory === "string") {
        const trimmed = query.subcategory.trim();
        if (trimmed.length > 0 && trimmed.length <= 100) {
          validated.subcategory = trimmed;
        } else if (trimmed.length > 100) {
          validated.subcategory = trimmed.substring(0, 100);
          issues.push(`subcategory обрезан до 100 символов`);
        }
      } else {
        issues.push(`subcategory должен быть строкой, получено: ${typeof query.subcategory}`);
      }
    }

    // Валидация brand
    if (query.brand !== undefined) {
      if (typeof query.brand === "string") {
        const trimmed = query.brand.trim();
        if (trimmed.length > 0 && trimmed.length <= 100) {
          validated.brand = trimmed;
        } else if (trimmed.length > 100) {
          validated.brand = trimmed.substring(0, 100);
          issues.push(`brand обрезан до 100 символов`);
        }
      } else {
        issues.push(`brand должен быть строкой, получено: ${typeof query.brand}`);
      }
    }

    // Валидация region
    if (query.region !== undefined) {
      if (typeof query.region === "string") {
        const trimmed = query.region.trim();
        if (trimmed.length > 0 && trimmed.length <= 100) {
          validated.region = trimmed;
        } else if (trimmed.length > 100) {
          validated.region = trimmed.substring(0, 100);
          issues.push(`region обрезан до 100 символов`);
        }
      } else {
        issues.push(`region должен быть строкой, получено: ${typeof query.region}`);
      }
    }

    // Валидация limit
    if (query.limit !== undefined) {
      if (typeof query.limit === "number") {
        const limitNum = Math.floor(query.limit);
        validated.limit = Math.min(Math.max(limitNum, 1), 100);
        if (limitNum !== query.limit || limitNum < 1 || limitNum > 100) {
          issues.push(`limit нормализован: ${query.limit} → ${validated.limit}`);
        }
      } else if (typeof query.limit === "string") {
        const limitNum = parseInt(query.limit, 10);
        if (!isNaN(limitNum)) {
          validated.limit = Math.min(Math.max(limitNum, 1), 100);
          issues.push(`limit преобразован из строки: "${query.limit}" → ${validated.limit}`);
        } else {
          issues.push(`limit не является числом: "${query.limit}" (игнорирован)`);
        }
      } else {
        issues.push(`limit должен быть числом, получено: ${typeof query.limit}`);
      }
    }

    // Валидация parameters
    if (query.parameters !== undefined) {
      if (typeof query.parameters === "object" && !Array.isArray(query.parameters)) {
        validated.parameters = {};
        
        for (const [key, value] of Object.entries(query.parameters)) {
          // Проверяем имя параметра
          if (!this.isValidParameterKey(key)) {
            issues.push(`Некорректное имя параметра: "${key}" (пропущено)`);
            continue;
          }

          // Проверяем значение параметра
          if (typeof value === "number") {
            if (Number.isFinite(value)) {
              validated.parameters[key] = value;
            } else {
              issues.push(`Параметр "${key}" имеет некорректное числовое значение: ${value}`);
            }
          } else if (typeof value === "string") {
            const trimmed = (value as string).trim();
            if (trimmed.length > 0 && trimmed.length <= 200) {
              validated.parameters[key] = trimmed;
            } else if (trimmed.length > 200) {
              validated.parameters[key] = trimmed.substring(0, 200);
              issues.push(`Значение параметра "${key}" обрезано до 200 символов`);
            }
          } else {
            issues.push(`Параметр "${key}" имеет некорректный тип: ${typeof value} (пропущено)`);
          }
        }

        // Если нет валидных параметров, удаляем поле
        if (Object.keys(validated.parameters).length === 0) {
          delete validated.parameters;
        }
      } else {
        issues.push(`parameters должен быть объектом, получено: ${typeof query.parameters}`);
      }
    }

    // Логируем проблемы, если есть
    if (issues.length > 0) {
      console.warn(`[SearchQueryValidator] Обнаружены проблемы при валидации:`);
      issues.forEach(issue => console.warn(`  - ${issue}`));
    }

    // Если после валидации не осталось ни одного поля, это ошибка
    if (Object.keys(validated).length === 0) {
      throw new Error("SearchQuery не содержит валидных полей после валидации");
    }

    return validated;
  }
}

