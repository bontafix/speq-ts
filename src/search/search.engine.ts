import { SearchQuery, CatalogSearchResult, EquipmentSummary } from "../catalog";
import { EquipmentRepository } from "../repository/equipment.repository";

export class SearchEngine {
  constructor(private readonly equipmentRepository: EquipmentRepository) {}

  /**
   * Основной вход в движок поиска.
   * 1) сначала FTS
   * 2) если результатов < 3 — дозакачиваем через vector search
   */
  async search(query: SearchQuery): Promise<CatalogSearchResult> {
    const limit = query.limit ?? 10;

    const ftsResults = await this.equipmentRepository.fullTextSearch(query, limit);

    const vectorEnabled = process.env.ENABLE_VECTOR_SEARCH === "true";

    if (!vectorEnabled || ftsResults.length >= 3) {
      return {
        items: ftsResults,
        total: ftsResults.length,
        usedStrategy: "fts",
      };
    }

    const remaining = limit - ftsResults.length;
    const vectorResults =
      remaining > 0 ? await this.equipmentRepository.vectorSearch(query, remaining) : [];

    const merged = this.mergeResults(ftsResults, vectorResults);

    return {
      items: merged,
      total: merged.length,
      usedStrategy: vectorResults.length > 0 ? "mixed" : "fts",
    };
  }

  private mergeResults(primary: EquipmentSummary[], fallback: EquipmentSummary[]): EquipmentSummary[] {
    const byId = new Map<string, EquipmentSummary>();

    for (const item of primary) {
      byId.set(item.id, item);
    }
    for (const item of fallback) {
      if (!byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }

    return Array.from(byId.values());
  }
}


