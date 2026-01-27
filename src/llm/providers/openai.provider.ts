import { BaseHTTPProvider } from "./base-http.provider";
import type {
  ChatOptions,
  ChatResponse,
  EmbeddingOptions,
  EmbeddingResponse,
} from "./llm-provider.interface";

/**
 * OpenAI провайдер — работает через официальный OpenAI API.
 * Поддерживает GPT-4, GPT-3.5-turbo и embeddings модели.
 */
export class OpenAIProvider extends BaseHTTPProvider {
  readonly name = "openai";
  protected defaultTimeout = 30000;

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey?: string, baseUrl?: string) {
    super();
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.baseUrl = baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is required for OpenAIProvider");
    }
  }

  private buildUrl(path: string): URL {
    const base = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
    const rel = path.replace(/^\//, "");
    return new URL(rel, base);
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const url = this.buildUrl("/chat/completions");

    const payload = JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens,
      stream: false,
    });

    const response = await this.makeRequest(url, "POST", payload, this.getHeaders());
    return this.extractChatResponse(response);
  }

  async embeddings(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    const url = this.buildUrl("/embeddings");

    const payload = JSON.stringify({
      model: options.model,
      input: options.input,
    });

    const response = await this.makeRequest(url, "POST", payload, this.getHeaders());
    return this.extractEmbeddingResponse(response);
  }

  async ping(): Promise<boolean> {
    try {
      const url = this.buildUrl("/models");
      // Ping с коротким таймаутом 5 сек
      await this.makeRequest(url, "GET", null, this.getHeaders(), 5000);
      return true;
    } catch {
      return false;
    }
  }
}
