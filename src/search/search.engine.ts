import { SearchQuery, CatalogSearchResult, EquipmentSummary, CatalogSuggestions, CatalogIndexService } from "../catalog";
import { EquipmentRepository } from "../repository/equipment.repository";
import { QueryParameterNormalizer } from "../normalization/query-parameter-normalizer";
import { ParameterDictionaryService } from "../normalization/parameter-dictionary.service";
import { ConfigService } from "../config/config";
import { LLMProviderFactory } from "../llm";

export class SearchEngine {
  private queryNormalizer: QueryParameterNormalizer | null = null;
  private config: ConfigService;
  private dictionaryInitialized = false;
  private catalogIndex: CatalogIndexService;

  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly dictionaryService?: ParameterDictionaryService,
    private readonly llmFactory?: LLMProviderFactory
  ) {
    this.config = new ConfigService();
    this.catalogIndex = new CatalogIndexService();
    
    // Инициализируем нормализатор, если передан словарь
    if (this.dictionaryService) {
      this.queryNormalizer = new QueryParameterNormalizer(this.dictionaryService);
      // Загружаем словарь асинхронно (не блокируем конструктор)
      this.initializeDictionary();
    }
  }

  /**
   * Получить индекс каталога (для использования в промптах LLM)
   */
  getCatalogIndex(): CatalogIndexService {
    return this.catalogIndex;
  }

  /**
   * Сформировать человеко-понятную подсказку по параметрам для выбранной категории.
   *
   * Используется на уровне диалога: когда понятна категория, но не хватает
   * параметров, мы можем показать пользователю, какие характеристики
   * обычно используются для фильтрации этой техники.
   *
   * Пример результата:
   *  "Для категории «Кран» основные параметры: грузоподъемность (т),
   *   высота подъёма (м), вылет стрелы (м), тип крана, регион, бренд."
   */
  getCategoryParametersHint(category: string, limit: number = 10): string | null {
    if (!this.dictionaryService) {
      return null;
    }

    const trimmed = category.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const params = this.dictionaryService.getSearchableParametersByCategory(trimmed, limit);
      if (!params.length) {
        return null;
      }

      const parts = params.map((p) => {
        const name = p.labelRu || p.key;
        const unit = p.unit ? ` (${p.unit})` : "";
        return `${name}${unit}`;
      });

      const uniqueParts = Array.from(new Set(parts));
      const list = uniqueParts.join(", ");

      return `Для категории «${trimmed}» основные параметры для подбора: ${list}. ` +
        `Спросите пользователя, какие из них для него важны (можно несколько).`;
    } catch (error) {
      if (process.env.DEBUG || process.env.DEBUG_SEARCH) {
        // eslint-disable-next-line no-console
        console.warn("[SearchEngine] Failed to build category parameters hint:", error);
      }
      return null;
    }
  }

  /**
   * Асинхронная инициализация словаря параметров.
   * Вызывается один раз при создании SearchEngine.
   */
  private async initializeDictionary(): Promise<void> {
    if (!this.dictionaryService || this.dictionaryInitialized) {
      return;
    }

    try {
      await this.dictionaryService.loadDictionary();
      this.dictionaryInitialized = true;
      if (process.env.DEBUG) {
        console.log('[SearchEngine] Dictionary initialized successfully');
      }
    } catch (error) {
      console.warn(`[SearchEngine] Failed to initialize dictionary: ${error}`);
      // Не блокируем работу - поиск будет работать без нормализации
    }
  }

  /**
   * Основной вход в движок поиска (Hybrid Search).
   * 1) Нормализует параметры запроса
   * 2) Запускает параллельно FTS и Vector Search
   * 3) Объединяет результаты через Reciprocal Rank Fusion (RRF)
   */
  async search(query: SearchQuery): Promise<CatalogSearchResult> {
    const limit = query.limit ?? 10;
    const offset = query.offset ?? 0;

    // 1. Нормализация параметров
    let normalizedQuery = query;
    if (this.queryNormalizer && query.parameters) {
      try {
        // Словарь уже загружен в конструкторе через initializeDictionary()
        // Если инициализация еще не завершена, ждем (это происходит только в первых запросах)
        if (!this.dictionaryInitialized && this.dictionaryService) {
          await this.dictionaryService.loadDictionary();
          this.dictionaryInitialized = true;
        }
        
        const result = this.queryNormalizer.normalizeQuery(query);
        normalizedQuery = result.normalizedQuery;
        
        if (process.env.DEBUG || process.env.DEBUG_SEARCH) {
          console.log('[SearchEngine] Normalized query params:', JSON.stringify(normalizedQuery, null, 2));
        }

        // Логируем, если есть проблемы, но не мешаем пользователю
        if (result.stats.unresolved > 0 && process.env.DEBUG) {
          console.warn(`[Search] Unresolved params: ${result.stats.unresolved}`);
        }
      } catch (error) {
        console.warn(`[Search] Normalization error: ${error}`);
      }
    }

    // 2. Параллельный запуск стратегий
    
    // Стратегия 1: FTS (Точное совпадение слов + Фильтры)
    const ftsPromise = this.equipmentRepository.fullTextSearch(normalizedQuery, limit, offset);

    // Стратегия 2: Vector (Смысловое совпадение)
    let vectorPromise: Promise<EquipmentSummary[]> = Promise.resolve([]);
    let embeddingPromise: Promise<number[] | null> = Promise.resolve(null);
    
    // Векторный поиск включаем только если есть текст запроса и доступен LLM для эмбеддинга
    const vectorEnabled = process.env.ENABLE_VECTOR_SEARCH !== "false"; // По умолчанию включено

    if (vectorEnabled && normalizedQuery.text && normalizedQuery.text.trim().length > 0 && this.llmFactory) {
      // 2.1 Генерируем эмбеддинг один раз
      embeddingPromise = this.getEmbedding(normalizedQuery.text);
      
      // 2.2 Запускаем строгий поиск с фильтрами
      vectorPromise = embeddingPromise.then(vector => {
        if (!vector) return [];
        
        // Передаем фильтры в vector search (только если они заданы)
        const filters: any = {};
        if (normalizedQuery.category) filters.category = normalizedQuery.category;
        if (normalizedQuery.brand) filters.brand = normalizedQuery.brand;
        if (normalizedQuery.region) filters.region = normalizedQuery.region;
        if (normalizedQuery.parameters) filters.parameters = normalizedQuery.parameters;
        
        return this.equipmentRepository.vectorSearchWithEmbedding(normalizedQuery.text!, vector, limit, filters, offset);
      });
    }

    // Используем Promise.all для ожидания результатов (FTS и Vector запускаются параллельно)
    const [ftsResult, vectorResult, embeddingResult] = await Promise.allSettled([
      ftsPromise, 
      vectorPromise,
      embeddingPromise
    ]);
    
    let ftsResults = ftsResult.status === 'fulfilled' ? ftsResult.value : [];
    let vectorResults = vectorResult.status === 'fulfilled' ? vectorResult.value : [];
    const queryEmbedding = embeddingResult.status === 'fulfilled' ? embeddingResult.value : null;

    // Логируем ошибки
    if (ftsResult.status === 'rejected') console.error('[Search] FTS search failed:', ftsResult.reason);
    if (vectorResult.status === 'rejected') console.warn('[Search] Vector search failed:', vectorResult.reason);

    // 2.3 RELAXED VECTOR SEARCH (FALLBACK)
    // Если результатов мало (< 3), и есть эмбеддинг, пробуем найти что-то "помягче".
    //
    // ВАЖНО: "relaxed" должен ослаблять только "мягкие" фильтры (категория/бренд),
    // но НЕ должен игнорировать технические ограничения (parameters) и/или регион,
    // иначе в выдачу попадут позиции, не соответствующие условиям пользователя.
    const hasFilters =
      normalizedQuery.category ||
      normalizedQuery.brand ||
      normalizedQuery.region ||
      normalizedQuery.parameters;
    let relaxedResults: EquipmentSummary[] = [];

    if (queryEmbedding && (ftsResults.length + vectorResults.length) < 3 && hasFilters) {
      if (process.env.DEBUG_SEARCH) {
        console.log('[Search] Low results with filters. Attempting relaxed vector search...');
      }
      try {
        // Ищем по смыслу, но сохраняем "жесткие" ограничения (parameters/region),
        // ослабляя только category/brand.
        const relaxedFilters: any = {};
        if (normalizedQuery.region) relaxedFilters.region = normalizedQuery.region;
        if (normalizedQuery.parameters) relaxedFilters.parameters = normalizedQuery.parameters;

        relaxedResults = await this.equipmentRepository.vectorSearchWithEmbedding(
            normalizedQuery.text!, 
            queryEmbedding, 
            limit,
            Object.keys(relaxedFilters).length > 0 ? relaxedFilters : undefined
        );
      } catch (e) {
        console.warn('[Search] Relaxed vector search failed:', e);
      }
    }

    // 3. Если ничего не найдено вообще - пробуем fallback (FTS без category)
    if (ftsResults.length === 0 && vectorResults.length === 0 && relaxedResults.length === 0) {
      return await this.handleNoResults(normalizedQuery, limit);
    }

    // 4. Гибридное слияние (RRF)
    const merged = this.hybridFusion(ftsResults, vectorResults, relaxedResults, limit);
    
    // 5. Получаем общее количество записей для правильной пагинации
    const total = await this.equipmentRepository.countEquipment(normalizedQuery);
    
    const strategies: string[] = [];
    if (ftsResults.length > 0) strategies.push("fts");
    if (vectorResults.length > 0) strategies.push("vector_strict");
    if (relaxedResults.length > 0) strategies.push("vector_relaxed");

    return {
      items: merged,
      total: total,
      usedStrategy: strategies.length > 1 ? "mixed" : (strategies[0] as any || "fts"),
    };
  }

  private async getEmbedding(text: string): Promise<number[] | null> {
      try {
        if (!this.llmFactory) return null;
        
        // ВАЖНО: Используем строго ту же модель, что и при индексации (ConfigService.llm.embeddingModel)
        const response = await this.llmFactory.embeddings({ 
            input: text,
            model: this.config.llm.embeddingModel
        });
        return response.embeddings?.[0] || null;
      } catch (e) {
        if (process.env.DEBUG) console.warn("[Search] Embedding generation failed:", e);
        return null;
      }
  }

  private async handleNoResults(query: SearchQuery, limit: number): Promise<CatalogSearchResult> {
    if (process.env.DEBUG_SEARCH) {
        console.log('[Search] No results found. Attempting fallback FTS (no filters)...');
    }
    
    // Fallback: простой текстовый поиск без категорий и атрибутов, если они были
    if (query.category || query.brand || query.parameters) {
        // Создаем копию запроса без строгих фильтров
        const fallbackQuery = { ...query };
        delete fallbackQuery.category;
        delete fallbackQuery.brand;
        delete fallbackQuery.parameters;
        
        // Оставляем только текст
        if (fallbackQuery.text && fallbackQuery.text.trim().length > 0) {
            const results = await this.equipmentRepository.fullTextSearch(fallbackQuery, limit);
            const total = await this.equipmentRepository.countEquipment(fallbackQuery);
            return {
                items: results,
                total: total,
                usedStrategy: "fallback"
            };
        }
    }
    
    return {
        items: [],
        total: 0,
        usedStrategy: "none"
    };
  }

  /**
   * Reciprocal Rank Fusion (RRF)
   * Алгоритм объединения результатов из разных поисковых систем.
   * Чем выше документ в списке, тем больше очков он получает.
   * score = 1 / (k + rank)
   */
  private hybridFusion(
    fts: EquipmentSummary[], 
    vector: EquipmentSummary[], 
    relaxed: EquipmentSummary[],
    limit: number,
    k = 60
  ): EquipmentSummary[] {
    const scores = new Map<string, number>();
    const items = new Map<string, EquipmentSummary>();
    const debugInfo: Record<string, { fts?: number, vector?: number, relaxed?: number, total: number, name: string }> = {};

    // Helper для подсчета скоров
    const addScores = (results: EquipmentSummary[], sourceName: 'fts' | 'vector' | 'relaxed', weight = 1.0) => {
        results.forEach((item, index) => {
            if (!items.has(item.id)) items.set(item.id, item);
            
            // Формула RRF: 1 / (k + rank)
            const rawScore = 1 / (k + index + 1);
            const weightedScore = rawScore * weight;
            
            scores.set(item.id, (scores.get(item.id) || 0) + weightedScore);
            
            // Debug info
            if (process.env.DEBUG_SEARCH) {
                if (!debugInfo[item.id]) debugInfo[item.id] = { total: 0, name: item.name };
                if (debugInfo[item.id]) {
                    debugInfo[item.id]![sourceName] = index + 1; // rank (1-based)
                }
            }
        });
    };

    // 1. FTS (Основной приоритет)
    addScores(fts, 'fts', 1.0);

    // 2. Vector Strict (Тоже высокий приоритет)
    addScores(vector, 'vector', 1.0);

    // 3. Relaxed (Пониженный приоритет - штрафуем, чтобы не перебивали точные)
    // Вес 0.5 означает, что 1-е место в relaxed эквивалентно ~30-му месту в FTS
    // (при k=60: 1/61 vs 0.5/61 = 1/122)
    addScores(relaxed, 'relaxed', 0.5);

    // Сортируем по убыванию скора
    const sortedIds = Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);

    if (process.env.DEBUG_SEARCH) {
        console.log('\n--- RRF Fusion Log ---');
        console.log('Top 5 results merged:');
        sortedIds.slice(0, 5).forEach((id, i) => {
            const info = debugInfo[id];
            if (!info) return;
            const score = scores.get(id)?.toFixed(4);
            console.log(`#${i+1} [${score}] ${info.name.substring(0, 40)}... ` +
                `(FTS:${info.fts || '-'}, Vec:${info.vector || '-'}, Rel:${info.relaxed || '-'})`);
        });
        console.log('----------------------\n');
    }

    return sortedIds
        .slice(0, limit)
        .map(id => items.get(id)!)
        .filter(Boolean);
  }
}
