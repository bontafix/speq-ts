import type {
  LLMProvider,
  ChatOptions,
  ChatResponse,
  EmbeddingOptions,
  EmbeddingResponse,
} from "./llm-provider.interface";

// Важно: используем require(), чтобы TypeScript не падал на этапе компиляции,
// если зависимости ещё не установлены. При запуске проекта groq-sdk должен быть
// установлен через `npm install`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Groq } = require("groq-sdk") as { Groq: new (opts: any) => any };

/**
 * Groq провайдер — работает через Groq Cloud API.
 * Очень быстрый inference на их кастомных LPU чипах.
 * API совместим с OpenAI.
 *
 * Документация: https://console.groq.com/docs/quickstart
 */
export class GroqProvider implements LLMProvider {
  readonly name = "groq";

  private readonly client: any;

  constructor(apiKey?: string, baseUrl?: string) {
    const resolvedApiKey = apiKey ?? process.env.GROQ_API_KEY ?? "";
    const envBase = process.env.GROQ_BASE_URL;

    // groq-sdk сам добавляет "/openai/v1" в пути ресурсов.
    // Поэтому baseURL должен быть вида "https://api.groq.com", а не ".../openai/v1".
    const resolvedBaseUrlRaw = baseUrl ?? envBase ?? "https://api.groq.com";
    const resolvedBaseUrl = resolvedBaseUrlRaw.replace(/\/openai\/v1\/?$/i, "");

    if (!resolvedApiKey) {
      throw new Error("GROQ_API_KEY is required for GroqProvider");
    }

    this.client = new Groq({
      apiKey: resolvedApiKey,
      baseURL: resolvedBaseUrl,
      timeout: 30000,
    });
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    try {
      const response: any = await this.client.chat.completions.create({
        model: options.model,
        messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens,
        stream: false,
      });

      const message = response.choices?.[0]?.message;
      if (!message || typeof message.content !== "string") {
        throw new Error("Unexpected Groq response shape");
      }

      return {
        message: {
          role: "assistant",
          content: message.content,
        },
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens ?? 0,
              completionTokens: response.usage.completion_tokens ?? 0,
              totalTokens: response.usage.total_tokens ?? 0,
            }
          : undefined,
      };
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : String(err);
      throw new Error(`Groq API error: ${msg}`);
    }
  }

  async embeddings(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    // Groq пока не поддерживает embeddings API напрямую.
    // Можно использовать их через другой сервис или fallback на Ollama.
    throw new Error("Groq does not support embeddings API yet. Use Ollama or OpenAI for embeddings.");
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Получить список доступных моделей Groq.
   */
  async listModels(): Promise<string[]> {
    try {
      const result: any = await this.client.models.list();
      const models: Array<{ id?: string }> = result?.data ?? [];
      return models.map((m) => m.id).filter((id): id is string => Boolean(id));
    } catch (err) {
      throw new Error(`Ошибка при получении списка моделей Groq: ${err}`);
    }
  }
}

