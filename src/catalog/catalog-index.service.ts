import { pgPool } from "../db/pg";
import type { CategoryInfo, ParameterInfo } from "./catalog.types";

/**
 * Индекс каталога для быстрого доступа к статистике
 */
export interface CatalogIndex {
  categories: Array<{ name: string; count: number }>;
  brands: Array<{ name: string; count: number }>;
  regions: Array<{ name: string; count: number }>;
  totalItems: number;
  lastUpdated: Date;
}

/**
 * Сервис для кэшированного доступа к статистике каталога
 * 
 * Используется для:
 * - Подсказок пользователю о доступных категориях
 * - Промпта LLM с информацией о каталоге
 * - Fallback поиска похожих категорий
 */
export class CatalogIndexService {
  private index: CatalogIndex | null = null;
  private refreshInterval = 5 * 60 * 1000; // 5 минут
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(autoRefresh = true) {
    if (autoRefresh) {
      this.startAutoRefresh();
    }
  }

  /**
   * Построить индекс каталога из БД
   */
  async buildIndex(): Promise<CatalogIndex> {
    try {
      const [categoriesResult, brandsResult, regionsResult, totalResult] = 
        await Promise.all([
          // Категории из таблицы categories (только активные, с учетом активности брендов)
          pgPool.query(`
            SELECT 
              c.name,
              COUNT(e.id) as count
            FROM categories c
            INNER JOIN equipment e ON e.category = c.name AND e.is_active = true
            INNER JOIN brands b ON e.brand = b.name AND b.is_active = true
            WHERE c.is_active = true
            GROUP BY c.id, c.name
            HAVING COUNT(e.id) > 0
            ORDER BY count DESC, c.name
          `),
          
          // Бренды из таблицы brands (только активные)
          pgPool.query(`
            SELECT 
              b.name,
              COUNT(e.id) as count
            FROM brands b
            LEFT JOIN equipment e ON e.brand = b.name AND e.is_active = true
            WHERE b.is_active = true
            GROUP BY b.id, b.name
            ORDER BY count DESC, b.name
          `),
          
          // Регионы
          pgPool.query(`
            SELECT region as name, COUNT(*) as count
            FROM equipment
            WHERE is_active = true AND region IS NOT NULL AND region != ''
            GROUP BY region
            ORDER BY count DESC
          `),
          
          // Всего (только с активными брендами)
          pgPool.query(`
            SELECT COUNT(*) as total
            FROM equipment e
            INNER JOIN brands b ON e.brand = b.name AND b.is_active = true
            WHERE e.is_active = true
          `),
        ]);

      this.index = {
        categories: categoriesResult.rows,
        brands: brandsResult.rows,
        regions: regionsResult.rows,
        totalItems: parseInt(totalResult.rows[0].total),
        lastUpdated: new Date(),
      };

      if (process.env.DEBUG) {
        console.log(`[CatalogIndex] Index built: ${this.index.totalItems} items, ${this.index.categories.length} categories`);
      }

      return this.index;
    } catch (error) {
      console.error('[CatalogIndex] Failed to build index:', error);
      throw error;
    }
  }

  /**
   * Получить текущий индекс (может быть null, если еще не построен)
   */
  getIndex(): CatalogIndex | null {
    return this.index;
  }

  /**
   * Дождаться загрузки индекса (если еще не загружен)
   */
  async ensureIndex(): Promise<CatalogIndex> {
    if (this.index) {
      return this.index;
    }
    return await this.buildIndex();
  }

  /**
   * Получить список параметров для категории
   */
  async getCategoryParameters(category: string): Promise<string[]> {
    try {
      const result = await pgPool.query(`
        SELECT DISTINCT jsonb_object_keys(e.main_parameters) as param
        FROM equipment e
        INNER JOIN brands b ON e.brand = b.name AND b.is_active = true
        WHERE e.is_active = true 
          AND e.category = $1
          AND e.main_parameters IS NOT NULL 
          AND e.main_parameters != '{}'::jsonb
        ORDER BY param
      `, [category]);
      
      return result.rows.map(r => r.param);
    } catch (error) {
      console.error(`[CatalogIndex] Failed to get parameters for category ${category}:`, error);
      return [];
    }
  }

  /**
   * Получить список параметров для категории с количеством оборудования
   * 
   * Запрос получает данные из таблицы equipment:
   * - Извлекает все ключи из JSONB поля main_parameters
   * - Считает количество записей, где каждый параметр присутствует
   * - Фильтрует только активное оборудование указанной категории
   * 
   * SQL запрос:
   * 1. Использует jsonb_object_keys() для извлечения всех ключей из main_parameters
   * 2. Группирует по имени параметра и считает количество записей
   * 3. Фильтрует по is_active = true и category
   */
  async getCategoryParametersWithCount(category: string): Promise<ParameterInfo[]> {
    try {
      const result = await pgPool.query(`
        SELECT 
          param_name as name,
          COUNT(*) as count
        FROM (
          SELECT 
            jsonb_object_keys(e.main_parameters) as param_name,
            e.id
          FROM equipment e
          INNER JOIN brands b ON e.brand = b.name AND b.is_active = true
          WHERE e.is_active = true 
            AND e.category = $1
            AND e.main_parameters IS NOT NULL 
            AND e.main_parameters != '{}'::jsonb
        ) subquery
        GROUP BY param_name
        ORDER BY count DESC, param_name
      `, [category]);
      
      return result.rows.map(r => ({
        name: r.name,
        count: parseInt(r.count)
      }));
    } catch (error) {
      console.error(`[CatalogIndex] Failed to get parameters with count for category ${category}:`, error);
      return [];
    }
  }

  /**
   * Найти похожие категории по запросу
   * 
   * Использует:
   * - Вхождение подстроки
   * - Расстояние Левенштейна
   */
  findSimilarCategories(query: string, limit = 5): string[] {
    if (!this.index) return [];

    const queryLower = query.toLowerCase().trim();
    
    // Сначала ищем точные вхождения
    const exactMatches = this.index.categories
      .filter(c => {
        const catLower = c.name.toLowerCase();
        return catLower.includes(queryLower) || queryLower.includes(catLower);
      })
      .slice(0, limit)
      .map(c => c.name);

    if (exactMatches.length >= limit) {
      return exactMatches;
    }

    // Если не хватает точных, добавляем по расстоянию Левенштейна
    const fuzzyMatches = this.index.categories
      .filter(c => {
        const catLower = c.name.toLowerCase();
        // Пропускаем уже найденные точные совпадения
        if (exactMatches.includes(c.name)) return false;
        // Расстояние не больше 3 символов
        return this.levenshteinDistance(catLower, queryLower) <= 3;
      })
      .slice(0, limit - exactMatches.length)
      .map(c => c.name);

    return [...exactMatches, ...fuzzyMatches];
  }

  /**
   * Получить популярные категории
   */
  getPopularCategories(limit = 10): CategoryInfo[] {
    if (!this.index) return [];
    
    return this.index.categories
      .slice(0, limit)
      .map(c => ({ name: c.name, count: c.count }));
  }

  /**
   * Получить популярные бренды
   */
  getPopularBrands(limit = 10): string[] {
    if (!this.index) return [];
    
    return this.index.brands
      .slice(0, limit)
      .map(b => b.name);
  }

  /**
   * Получить все категории для промпта LLM
   */
  getCategoriesForPrompt(limit = 30): string {
    if (!this.index) return "Индекс каталога загружается...";
    
    return this.index.categories
      .slice(0, limit)
      .map((c, i) => `${i + 1}. ${c.name} (${c.count} шт.)`)
      .join('\n');
  }

  /**
   * Проверить, существует ли категория
   */
  categoryExists(category: string): boolean {
    if (!this.index) return false;
    
    const categoryLower = category.toLowerCase();
    return this.index.categories.some(
      c => c.name.toLowerCase() === categoryLower
    );
  }

  /**
   * Расстояние Левенштейна для нечеткого поиска
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // замена
            matrix[i]![j - 1]! + 1,     // вставка
            matrix[i - 1]![j]! + 1      // удаление
          );
        }
      }
    }

    return matrix[b.length]![a.length]!;
  }

  /**
   * Запустить автоматическое обновление индекса
   */
  private startAutoRefresh(): void {
    // Первая загрузка
    this.buildIndex().catch(err => 
      console.error('[CatalogIndex] Failed to build initial index:', err)
    );

    // Периодическое обновление
    this.refreshTimer = setInterval(() => {
      this.buildIndex().catch(err => 
        console.error('[CatalogIndex] Failed to refresh index:', err)
      );
    }, this.refreshInterval);
  }

  /**
   * Остановить автоматическое обновление (для тестов и graceful shutdown)
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
