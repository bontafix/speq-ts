export interface SearchQuery {
  text?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  region?: string;
  parameters?: Record<string, string | number>;
  limit?: number;
  offset?: number;
}

export interface EquipmentSummary {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: string | number | null;
  mainParameters: Record<string, string | number>;
}

export interface CatalogSearchOptions {
  query: SearchQuery;
}

export interface CatalogSearchResult {
  items: EquipmentSummary[];
  total: number;
  usedStrategy: "fts" | "vector" | "mixed" | "fallback" | "none";
  suggestions?: CatalogSuggestions;
  message?: string;
}

export interface CatalogSuggestions {
  /** Похожие категории (если искали по category) */
  similarCategories?: string[];
  
  /** Популярные категории (топ по количеству) */
  popularCategories?: CategoryInfo[];
  
  /** Доступные бренды (если искали по brand) */
  availableBrands?: string[];
  
  /** Примеры запросов */
  exampleQueries?: string[];
}

export interface CategoryInfo {
  name: string;
  count: number;
}

export interface ParameterInfo {
  name: string;
  count: number;
}


