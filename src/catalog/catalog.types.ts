export interface SearchQuery {
  text?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  region?: string;
  parameters?: Record<string, string | number>;
  limit?: number;
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
  usedStrategy: "fts" | "vector" | "mixed";
}


