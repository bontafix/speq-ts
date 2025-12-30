import type { LLMProvider, ChatOptions, ChatResponse, EmbeddingOptions, EmbeddingResponse } from "./llm-provider.interface";
import { OllamaProvider } from "./ollama.provider";
import { GroqProvider } from "./groq.provider";
import { OpenAIProvider } from "./openai.provider";

export type ProviderType = "ollama" | "groq" | "openai";

export interface ProviderConfig {
  /**
   * Основной провайдер для chat completion.
   */
  chatProvider: ProviderType;

  /**
   * Провайдер для embeddings.
   */
  embeddingsProvider: ProviderType;

  /**
   * Fallback провайдеры (в порядке приоритета).
   * Если основной провайдер недоступен, используется первый доступный из списка.
   */
  fallbackProviders?: ProviderType[];

  /**
   * Тихий режим — не логировать ошибки fallback.
   */
  silent?: boolean;
}

/**
 * Фабрика для создания и управления LLM провайдерами.
 * Поддерживает автоматический fallback при недоступности основного провайдера.
 */
export class LLMProviderFactory {
  private providers: Map<ProviderType, LLMProvider> = new Map();
  private config: ProviderConfig;
  private readonly defaultOllamaChatModel = "qwen2.5:7b-instruct-q4_K_M";

  constructor(config?: Partial<ProviderConfig>) {
    const envEmbeddingsProvider = process.env.LLM_EMBEDDINGS_PROVIDER;

    this.config = {
      // Важно: в этом проекте чат-провайдер фиксирован и не должен переключаться
      // ни через ENV, ни через runtime API.
      chatProvider: "groq",
      embeddingsProvider: this.normalizeEmbeddingsProvider(envEmbeddingsProvider),
      fallbackProviders: this.parseFallbackProviders(process.env.LLM_FALLBACK_PROVIDERS),
      silent: process.env.LLM_FALLBACK_SILENT === "true",
      ...config,
    };

    this.initializeProviders();
  }

  private getEnvModelForProvider(providerType: ProviderType): string | undefined {
    // Позволяет задать разные модели для разных провайдеров:
    // LLM_MODEL_OLLAMA, LLM_MODEL_GROQ, LLM_MODEL_OPENAI
    const key = `LLM_MODEL_${providerType.toUpperCase()}` as const;
    const value = (process.env as Record<string, string | undefined>)[key];
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private resolveChatModel(providerType: ProviderType, requestedModel: string): string {
    const perProvider = this.getEnvModelForProvider(providerType);
    if (perProvider) return perProvider;

    // Если модель взята из общего LLM_MODEL и произошёл fallback на Ollama,
    // то очень частый кейс — LLM_MODEL настроен под Groq/OpenAI (например mixtral-*),
    // из-за чего Ollama падает "model not found". В этом случае даём безопасный дефолт.
    const globalModel = process.env.LLM_MODEL?.trim();
    if (providerType === "ollama" && globalModel && requestedModel.trim() === globalModel) {
      return this.defaultOllamaChatModel;
    }

    return requestedModel;
  }

  private isProviderType(value: string): value is ProviderType {
    return value === "ollama" || value === "groq" || value === "openai";
  }

  private normalizeEmbeddingsProvider(envValue?: string): ProviderType {
    if (!envValue) return "ollama";
    const trimmed = envValue.trim();
    // Groq не поддерживает embeddings — даже если ключ задан и ping успешен.
    if (trimmed === "groq") {
      // Логируем только если не silent: здесь ещё нет this.config, поэтому проверяем ENV напрямую.
      if (process.env.LLM_FALLBACK_SILENT !== "true") {
        console.warn('LLM_EMBEDDINGS_PROVIDER="groq" не поддерживается. Используем "ollama".');
      }
      return "ollama";
    }
    if (this.isProviderType(trimmed)) return trimmed;
    return "ollama";
  }

  private parseFallbackProviders(envVar?: string): ProviderType[] {
    if (!envVar) return ["ollama"];
    const raw = envVar
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const result: ProviderType[] = [];
    for (const value of raw) {
      if (!this.isProviderType(value)) continue;
      if (!result.includes(value)) result.push(value);
    }

    return result.length > 0 ? result : ["ollama"];
  }

  private initializeProviders(): void {
    // Инициализируем Groq, если есть API ключ
    if (process.env.GROQ_API_KEY) {
      try {
        this.providers.set("groq", new GroqProvider());
      } catch (err) {
        if (!this.config.silent) {
          console.warn(`Не удалось инициализировать Groq провайдер: ${err}`);
        }
      }
    }

    // Для embeddings/векторного поиска можно использовать локальный Ollama.
    // Для чата он в этом проекте не применяется.
    try {
      this.providers.set("ollama", new OllamaProvider());
    } catch (err) {
      if (!this.config.silent) {
        console.warn(`Не удалось инициализировать Ollama провайдер: ${err}`);
      }
    }

    // Инициализируем OpenAI, если есть API ключ
    if (process.env.OPENAI_API_KEY) {
      try {
        this.providers.set("openai", new OpenAIProvider());
      } catch (err) {
        if (!this.config.silent) {
          console.warn(`Не удалось инициализировать OpenAI провайдер: ${err}`);
        }
      }
    }
  }

  /**
   * Получить провайдер с поддержкой fallback.
   */
  private async getProviderWithFallback(
    preferredType: ProviderType,
    operation: "chat" | "embeddings",
  ): Promise<LLMProvider> {
    // Жёсткое правило проекта: для chat используем только Groq (без fallback).
    if (operation === "chat") {
      const groq = this.providers.get("groq");
      if (!groq) {
        throw new Error('Groq провайдер не инициализирован. Укажите GROQ_API_KEY.');
      }
      const ok = await groq.ping();
      if (!ok) {
        throw new Error("Groq провайдер недоступен (ping failed).");
      }
      return groq;
    }

    // Для embeddings Groq принципиально не подходит.
    if (operation === "embeddings" && preferredType === "groq") {
      if (!this.config.silent) {
        console.warn('Провайдер "groq" не поддерживает embeddings, переключаемся на fallback...');
      }
      preferredType = "ollama";
    }

    // Пытаемся использовать предпочтительный провайдер
    const preferred = this.providers.get(preferredType);
    if (!preferred) {
      if (!this.config.silent) {
        console.warn(
          `Провайдер ${preferredType} не инициализирован (возможно, не задан API ключ или провайдер отключён). Переключаемся на fallback...`,
        );
      }
    } else {
      const isAvailable = await preferred.ping();
      if (isAvailable) {
        return preferred;
      }
      if (!this.config.silent) {
        console.warn(`Провайдер ${preferredType} недоступен, переключаемся на fallback...`);
      }
    }

    // Перебираем fallback провайдеры
    const fallbacks = this.config.fallbackProviders ?? [];
    for (const fallbackType of fallbacks) {
      if (fallbackType === preferredType) continue; // Уже проверили

      const fallback = this.providers.get(fallbackType);
      if (!fallback) continue;

      // Для embeddings проверяем, что провайдер их поддерживает
      if (operation === "embeddings" && fallbackType === "groq") {
        continue; // Groq не поддерживает embeddings
      }

      const isAvailable = await fallback.ping();
      if (isAvailable) {
        if (!this.config.silent) {
          console.log(`Используется fallback провайдер: ${fallbackType}`);
        }
        return fallback;
      }
    }

    throw new Error(
      `Ни один LLM провайдер не доступен. Проверьте подключение к ${preferredType} или fallback провайдерам.`,
    );
  }

  /**
   * Выполнить chat completion с автоматическим fallback.
   */
  async chat(options: ChatOptions): Promise<ChatResponse> {
    const provider = await this.getProviderWithFallback(this.config.chatProvider, "chat");
    const providerType = provider.name as ProviderType;
    const model = this.resolveChatModel(providerType, options.model);
    return provider.chat({ ...options, model });
  }

  /**
   * Выполнить chat completion с указанным провайдером (без fallback).
   */
  async chatWithProvider(providerType: ProviderType, options: ChatOptions): Promise<ChatResponse> {
    // В этом проекте запрещено выполнять chat через не-Groq провайдеры.
    if (providerType !== "groq") {
      throw new Error(`Chat через провайдер "${providerType}" запрещён. Разрешён только "groq".`);
    }
    const provider = this.providers.get("groq");
    if (!provider) throw new Error('Groq провайдер не инициализирован. Укажите GROQ_API_KEY.');
    const model = this.resolveChatModel("groq", options.model);
    return provider.chat({ ...options, model });
  }

  /**
   * Получить embeddings с автоматическим fallback.
   */
  async embeddings(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    const provider = await this.getProviderWithFallback(this.config.embeddingsProvider, "embeddings");
    return provider.embeddings(options);
  }

  /**
   * Получить embeddings с указанным провайдером (без fallback).
   */
  async embeddingsWithProvider(providerType: ProviderType, options: EmbeddingOptions): Promise<EmbeddingResponse> {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Провайдер ${providerType} не инициализирован или недоступен`);
    }
    if (providerType === "groq") {
      throw new Error("Groq не поддерживает embeddings API");
    }
    return provider.embeddings(options);
  }

  /**
   * Получить конкретный провайдер по имени (без fallback).
   */
  getProvider(type: ProviderType): LLMProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Проверить доступность всех провайдеров.
   */
  async checkHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [name, provider] of this.providers.entries()) {
      health[name] = await provider.ping();
    }

    return health;
  }

  /**
   * Изменить основной провайдер для chat completion.
   */
  setChatProvider(providerType: ProviderType): void {
    // Важно: чат-провайдер в этом проекте фиксирован.
    if (providerType !== "groq") {
      throw new Error(`Нельзя установить chat provider "${providerType}". Разрешён только "groq".`);
    }
    if (!this.providers.has("groq")) {
      throw new Error('Groq провайдер не инициализирован. Укажите GROQ_API_KEY.');
    }
    this.config.chatProvider = "groq";
  }

  /**
   * Изменить основной провайдер для embeddings.
   */
  setEmbeddingsProvider(providerType: ProviderType): void {
    if (!this.providers.has(providerType)) {
      throw new Error(`Провайдер ${providerType} не инициализирован`);
    }
    if (providerType === "groq") {
      throw new Error("Groq не поддерживает embeddings API");
    }
    this.config.embeddingsProvider = providerType;
  }

  /**
   * Получить текущую конфигурацию провайдеров.
   */
  getConfig(): Readonly<ProviderConfig> {
    return { ...this.config };
  }

  /**
   * Получить список доступных провайдеров.
   */
  getAvailableProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }
}

