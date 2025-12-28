import https from "https";
import type {
  LLMProvider,
  ChatOptions,
  ChatResponse,
  EmbeddingOptions,
  EmbeddingResponse,
} from "./llm-provider.interface";

/**
 * Groq провайдер — работает через Groq Cloud API.
 * Очень быстрый inference на их кастомных LPU чипах.
 * API совместим с OpenAI.
 * 
 * Документация: https://console.groq.com/docs/quickstart
 */
export class GroqProvider implements LLMProvider {
  readonly name = "groq";

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? process.env.GROQ_API_KEY ?? "";
    this.baseUrl = baseUrl ?? process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";

    if (!this.apiKey) {
      throw new Error("GROQ_API_KEY is required for GroqProvider");
    }
  }

  private buildUrl(path: string): URL {
    // Важно: GROQ_BASE_URL по умолчанию содержит "/openai/v1".
    // Если использовать new URL("/chat/completions", baseUrl), то "/openai/v1" будет отброшен.
    // Поэтому делаем относительный путь без ведущего "/".
    const base = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
    const rel = path.replace(/^\//, "");
    return new URL(rel, base);
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

    return new Promise<ChatResponse>((resolve, reject) => {
      const req = https.request(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            try {
              const body = Buffer.concat(chunks).toString("utf8");
              
              // Проверяем HTTP статус код
              if (res.statusCode && res.statusCode >= 400) {
                let errorMessage = `Groq API error: HTTP ${res.statusCode}`;
                try {
                  const parsed = JSON.parse(body);
                  if (parsed.error) {
                    errorMessage = `Groq API error: ${parsed.error.message || JSON.stringify(parsed.error)}`;
                  }
                } catch {
                  // Если не удалось распарсить JSON, используем тело ответа
                  if (body) {
                    errorMessage = `Groq API error: ${body}`;
                  }
                }
                return reject(new Error(errorMessage));
              }

              const parsed = JSON.parse(body);

              if (parsed.error) {
                return reject(new Error(`Groq API error: ${parsed.error.message || JSON.stringify(parsed.error)}`));
              }

              const firstChoice = parsed.choices?.[0];
              const message = firstChoice?.message;
              if (!message || typeof message.content !== "string") {
                return reject(new Error("Unexpected Groq response shape"));
              }

              resolve({
                message,
                usage: parsed.usage
                  ? {
                      promptTokens: parsed.usage.prompt_tokens ?? 0,
                      completionTokens: parsed.usage.completion_tokens ?? 0,
                      totalTokens: parsed.usage.total_tokens ?? 0,
                    }
                  : undefined,
              });
            } catch (err) {
              reject(err);
            }
          });
        },
      );

      req.on("error", (err) => reject(err));
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error("Groq API request timeout"));
      });
      req.write(payload);
      req.end();
    });
  }

  async embeddings(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    // Groq пока не поддерживает embeddings API напрямую.
    // Можно использовать их через другой сервис или fallback на Ollama.
    throw new Error("Groq does not support embeddings API yet. Use Ollama or OpenAI for embeddings.");
  }

  async ping(): Promise<boolean> {
    try {
      const url = this.buildUrl("/models");

      return await new Promise<boolean>((resolve) => {
        const req = https.get(
          url,
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
          },
          (res) => {
            res.resume();
            // Проверяем успешный статус (200-299)
            const ok = res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300;
            if (!ok && process.env.LLM_DEBUG === "true") {
              // eslint-disable-next-line no-console
              console.warn(`Groq ping failed: HTTP ${res.statusCode ?? "unknown"} (${url.toString()})`);
            }
            resolve(ok);
          },
        );

        req.on("error", (err) => {
          if (process.env.LLM_DEBUG === "true") {
            // eslint-disable-next-line no-console
            console.warn(`Groq ping error (${url.toString()}): ${err.message}`);
          }
          resolve(false);
        });
        req.setTimeout(5000, () => {
          req.destroy();
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }

  /**
   * Получить список доступных моделей Groq.
   */
  async listModels(): Promise<string[]> {
    try {
      const url = this.buildUrl("/models");

      return await new Promise<string[]>((resolve, reject) => {
        const req = https.get(
          url,
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk) => chunks.push(chunk as Buffer));
            res.on("end", () => {
              try {
                const body = Buffer.concat(chunks).toString("utf8");
                const parsed = JSON.parse(body);

                if (parsed.error) {
                  return reject(new Error(`Groq API error: ${parsed.error.message || JSON.stringify(parsed.error)}`));
                }

                if (res.statusCode && res.statusCode >= 400) {
                  return reject(new Error(`Groq API error: HTTP ${res.statusCode}`));
                }

                const models = parsed.data || [];
                const modelIds = models.map((m: any) => m.id as string).filter(Boolean);
                resolve(modelIds);
              } catch (err) {
                reject(err);
              }
            });
          },
        );

        req.on("error", (err) => reject(err));
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error("Groq API request timeout"));
        });
      });
    } catch (err) {
      throw new Error(`Ошибка при получении списка моделей Groq: ${err}`);
    }
  }
}

