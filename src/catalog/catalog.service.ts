import { CatalogSearchOptions, CatalogSearchResult, EquipmentSummary, SearchQuery } from "./catalog.types";
import { SearchEngine } from "../search";

/**
 * CatalogService — доменный слой.
 * Не знает о CLI, MCP, LLM и деталях хранилища (SQL).
 * Работает через абстракцию SearchEngine.
 */
export class CatalogService {
  constructor(private readonly searchEngine: SearchEngine) {}

  /**
   * Поиск оборудования по структурированному запросу.
   */
  async searchEquipment(query: SearchQuery): Promise<CatalogSearchResult> {
    // Нормализация запроса: убираем пустые строки и приводим limit к числу
    const normalizedQuery: SearchQuery = {
      limit: 10,
      ...query,
    };

    // Очистка пустых строк
    if (normalizedQuery.text === "") delete normalizedQuery.text;
    if (normalizedQuery.category === "") delete normalizedQuery.category;
    if (normalizedQuery.subcategory === "") delete normalizedQuery.subcategory;
    if (normalizedQuery.brand === "") delete normalizedQuery.brand;
    if (normalizedQuery.region === "") delete normalizedQuery.region;

    // Нормализация limit
    if (normalizedQuery.limit) {
      const limitNum = typeof normalizedQuery.limit === "string" 
        ? parseInt(normalizedQuery.limit, 10) 
        : normalizedQuery.limit;
      normalizedQuery.limit = Number.isNaN(limitNum) || limitNum <= 0 ? 10 : limitNum;
    } else {
      normalizedQuery.limit = 10;
    }

    return this.searchEngine.search(normalizedQuery);
  }

  /**
   * Получить текстовую подсказку по параметрам для указанной категории.
   * Обертка над SearchEngine, чтобы UI-слои не зависели напрямую от него.
   */
  getCategoryParametersHint(category: string, limit: number = 10): string | null {
    return this.searchEngine.getCategoryParametersHint(category, limit);
  }

  /**
   * Утилита для краткого представления оборудования (для CLI / UI слоёв).
   */
  formatSummary(item: EquipmentSummary): string {
    const paramsPreview = Object.entries(item.mainParameters || {})
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");

    let price: string;
    if (item.price == null) {
      price = "цена по запросу";
    } else if (typeof item.price === "number") {
      price = `${item.price.toLocaleString("ru-RU")} ₽`;
    } else {
      price = item.price;
    }

    return `${item.name} (${item.brand}, ${item.category}) — ${price}${paramsPreview ? ` | ${paramsPreview}` : ""}`;
  }
}


