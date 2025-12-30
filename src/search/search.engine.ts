import { SearchQuery, CatalogSearchResult, EquipmentSummary } from "../catalog";
import { EquipmentRepository } from "../repository/equipment.repository";
import { QueryParameterNormalizer } from "../normalization/query-parameter-normalizer";
import { ParameterDictionaryService } from "../normalization/parameter-dictionary.service";
import { ConfigService } from "../config/config";
import { LLMProviderFactory } from "../llm";

export class SearchEngine {
  private queryNormalizer: QueryParameterNormalizer | null = null;
  private config: ConfigService;
  private dictionaryInitialized = false;

  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly dictionaryService?: ParameterDictionaryService,
    private readonly llmFactory?: LLMProviderFactory
  ) {
    this.config = new ConfigService();
    // Инициализируем нормализатор, если передан словарь
    if (this.dictionaryService) {
      this.queryNormalizer = new QueryParameterNormalizer(this.dictionaryService);
      // Загружаем словарь асинхронно (не блокируем конструктор)
      this.initializeDictionary();
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
    const ftsPromise = this.equipmentRepository.fullTextSearch(normalizedQuery, limit);

    // Стратегия 2: Vector (Смысловое совпадение)
    let vectorPromise: Promise<EquipmentSummary[]> = Promise.resolve([]);
    // Векторный поиск включаем только если есть текст запроса и доступен LLM для эмбеддинга
    const vectorEnabled = process.env.ENABLE_VECTOR_SEARCH !== "false"; // По умолчанию включено

    if (vectorEnabled && normalizedQuery.text && normalizedQuery.text.trim().length > 0 && this.llmFactory) {
      // Передаем фильтры в vector search (только если они заданы)
      const filters: {
        category?: string;
        subcategory?: string;
        brand?: string;
        region?: string;
        parameters?: Record<string, string | number>;
      } = {};
      
      if (normalizedQuery.category) filters.category = normalizedQuery.category;
      if (normalizedQuery.subcategory) filters.subcategory = normalizedQuery.subcategory;
      if (normalizedQuery.brand) filters.brand = normalizedQuery.brand;
      if (normalizedQuery.region) filters.region = normalizedQuery.region;
      if (normalizedQuery.parameters) filters.parameters = normalizedQuery.parameters;
      
      vectorPromise = this.performVectorSearch(normalizedQuery.text, limit, filters);
    }

    // Используем Promise.allSettled вместо Promise.all для надежности:
    // Если vector search упадет, FTS результаты все равно будут доступны
    const [ftsResult, vectorResult] = await Promise.allSettled([ftsPromise, vectorPromise]);
    
    const ftsResults = ftsResult.status === 'fulfilled' ? ftsResult.value : [];
    const vectorResults = vectorResult.status === 'fulfilled' ? vectorResult.value : [];
    
    // Логируем ошибки для мониторинга
    if (ftsResult.status === 'rejected') {
      console.error('[Search] FTS search failed:', ftsResult.reason);
    }
    if (vectorResult.status === 'rejected') {
      console.warn('[Search] Vector search failed (using FTS only):', vectorResult.reason);
    }

    // 3. Гибридное слияние (RRF)
    const merged = this.hybridFusion(ftsResults, vectorResults, limit);
    
    const strategies: string[] = [];
    if (ftsResults.length > 0) strategies.push("fts");
    if (vectorResults.length > 0) strategies.push("vector");

    return {
      items: merged,
      total: merged.length,
      usedStrategy: strategies.length > 1 ? "mixed" : (strategies[0] as any || "fts"),
    };
  }

  private async performVectorSearch(
    text: string, 
    limit: number,
    filters?: {
      category?: string;
      subcategory?: string;
      brand?: string;
      region?: string;
      parameters?: Record<string, string | number>;
    }
  ): Promise<EquipmentSummary[]> {
    try {
        if (!this.llmFactory) return [];
        
        // Генерируем вектор запроса через LLM
        // ВАЖНО: Используем ту же модель эмбеддингов, что и worker заполнения БД
        const response = await this.llmFactory.embeddings({ 
            input: text,
            model: this.config.llm.embeddingModel
        });
        
        if (!response.embeddings || response.embeddings.length === 0) return [];
        
        const vector = response.embeddings[0];

        if (!vector) return [];
        
        // Ищем в БД по вектору с учетом фильтров
        return await this.equipmentRepository.vectorSearchWithEmbedding(text, vector!, limit, filters);
    } catch (e) {
        // Если эмбеддинги не работают (например модель не та), не ломаем весь поиск
        if (process.env.DEBUG) console.warn("[Search] Vector search failed:", e);
        return [];
    }
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
    limit: number,
    k = 60
  ): EquipmentSummary[] {
    const scores = new Map<string, number>();
    const items = new Map<string, EquipmentSummary>();

    // Считаем скоры для FTS
    fts.forEach((item, index) => {
        items.set(item.id, item);
        const score = 1 / (k + index + 1);
        scores.set(item.id, (scores.get(item.id) || 0) + score);
    });

    // Считаем скоры для Vector
    vector.forEach((item, index) => {
        // Если такой item уже был в FTS, он получит буст
        if (!items.has(item.id)) {
            items.set(item.id, item);
        }
        const score = 1 / (k + index + 1);
        scores.set(item.id, (scores.get(item.id) || 0) + score);
    });

    // Сортируем по убыванию скора
    const sortedIds = Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);

    return sortedIds
        .slice(0, limit)
        .map(id => items.get(id)!)
        .filter(Boolean);
  }
}
