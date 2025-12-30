import { ConfigService } from "../config/config";
import { EquipmentRepository } from "../repository/equipment.repository";
import { ParameterDictionaryService } from "../normalization";
import { SearchEngine } from "../search";
import { CatalogService } from "../catalog";
import { LLMProviderFactory } from "../llm";

export class AppContainer {
  readonly config: ConfigService;
  readonly repository: EquipmentRepository;
  readonly dictionaryService: ParameterDictionaryService;
  readonly searchEngine: SearchEngine;
  readonly catalogService: CatalogService;
  readonly llmFactory: LLMProviderFactory;

  constructor() {
    this.config = new ConfigService();
    this.config.validate();

    // Инициализация в правильном порядке
    this.dictionaryService = new ParameterDictionaryService();
    this.repository = new EquipmentRepository(this.dictionaryService); // Передаем словарь
    this.llmFactory = new LLMProviderFactory();
    
    // Inject llmFactory into SearchEngine for vector generation
    this.searchEngine = new SearchEngine(
      this.repository, 
      this.dictionaryService,
      this.llmFactory
    );
    
    this.catalogService = new CatalogService(this.searchEngine);
  }

  async init() {
    try {
      await this.dictionaryService.loadDictionary();
      // console.log("✅ Dictionary loaded");
    } catch (e) {
      console.warn("⚠️ Dictionary load failed, normalization disabled");
    }
    
    const health = await this.llmFactory.checkHealth();
    const anyAvailable = Object.values(health).some(v => v);
    
    if (!anyAvailable) {
      console.error("Health check failed:", health);
      // We don't throw here to allow app to start and show error in CLI
    }
  }
}

