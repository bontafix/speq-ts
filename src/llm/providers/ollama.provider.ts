import { BaseHTTPProvider } from "./base-http.provider";
import type {
  ChatOptions,
  ChatResponse,
  EmbeddingOptions,
  EmbeddingResponse,
} from "./llm-provider.interface";

/**
 * Ollama провайдер — работает с локальным Ollama сервером.
 * Использует OpenAI-совместимый API (/v1/chat/completions, /v1/embeddings).
 */
export class OllamaProvider extends BaseHTTPProvider {
  readonly name = "ollama";
  // Увеличиваем таймаут до 120 секунд (2 минуты) для локальной работы
  protected defaultTimeout = 120000;

  constructor(private readonly baseUrl: string = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434") {
    super();
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const url = new URL("/v1/chat/completions", this.baseUrl);

    const payload = JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens,
      stream: false,
    });

    const response = await this.makeRequest(url, "POST", payload, {});
    return this.extractChatResponse(response);
  }

  async embeddings(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    const url = new URL("/v1/embeddings", this.baseUrl);

    const payload = JSON.stringify({
      model: options.model,
      input: options.input,
    });

    const startTime = Date.now();
    const response = await this.makeRequest(url, "POST", payload, {});
    
    const duration = Date.now() - startTime;
    if (duration > 10000 && process.env.DEBUG) {
        console.warn(`[Ollama] Slow embedding request: ${duration}ms`);
    }

    return this.extractEmbeddingResponse(response);
  }

  async ping(): Promise<boolean> {
    try {
      const url = new URL("/", this.baseUrl);
      // Ping с коротким таймаутом 3 сек
      await this.makeRequest(url, "GET", null, {}, 3000);
      return true;
    } catch {
      return false;
    }
  }
}
