import http from "http";
import type {
  LLMProvider,
  ChatOptions,
  ChatResponse,
  EmbeddingOptions,
  EmbeddingResponse,
} from "./llm-provider.interface";

/**
 * Ollama провайдер — работает с локальным Ollama сервером.
 * Использует OpenAI-совместимый API (/v1/chat/completions, /v1/embeddings).
 */
export class OllamaProvider implements LLMProvider {
  readonly name = "ollama";

  constructor(private readonly baseUrl: string = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434") {}

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const url = new URL("/v1/chat/completions", this.baseUrl);

    const payload = JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens,
      stream: false,
    });

    return new Promise<ChatResponse>((resolve, reject) => {
      const req = http.request(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
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
                let errorMessage = `Ollama API error: HTTP ${res.statusCode}`;
                try {
                  const parsed = JSON.parse(body);
                  if (parsed.error) {
                    errorMessage = `Ollama API error: ${parsed.error.message || JSON.stringify(parsed.error)}`;
                  } else if (body) {
                    errorMessage = `Ollama API error: ${body}`;
                  }
                } catch {
                  if (body) {
                    errorMessage = `Ollama API error: ${body}`;
                  }
                }
                return reject(new Error(errorMessage));
              }

              const parsed = JSON.parse(body);

              // Проверяем наличие ошибки в ответе
              if (parsed.error) {
                return reject(new Error(`Ollama API error: ${parsed.error.message || JSON.stringify(parsed.error)}`));
              }

              const firstChoice = parsed.choices?.[0];
              if (!firstChoice) {
                return reject(
                  new Error(
                    `Unexpected Ollama response shape: нет choices в ответе. Ответ: ${JSON.stringify(parsed).substring(0, 500)}`,
                  ),
                );
              }

              const message = firstChoice?.message;
              if (!message) {
                return reject(
                  new Error(
                    `Unexpected Ollama response shape: нет message в choice. Ответ: ${JSON.stringify(parsed).substring(0, 500)}`,
                  ),
                );
              }

              if (typeof message.content !== "string") {
                return reject(
                  new Error(
                    `Unexpected Ollama response shape: message.content не является строкой. Тип: ${typeof message.content}, значение: ${JSON.stringify(message.content).substring(0, 200)}`,
                  ),
                );
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
              if (err instanceof SyntaxError) {
                return reject(new Error(`Ошибка парсинга JSON от Ollama: ${err.message}. Тело ответа: ${Buffer.concat(chunks).toString("utf8").substring(0, 500)}`));
              }
              reject(err);
            }
          });
        },
      );

      req.on("error", (err) => {
        reject(new Error(`Ошибка подключения к Ollama (${this.baseUrl}): ${err.message}`));
      });
      // Увеличиваем таймаут до 120 секунд (2 минуты), так как генерация эмбеддингов
      // для больших батчей на локальном CPU может занимать много времени.
      req.setTimeout(120000, () => {
        req.destroy();
        reject(new Error("Ollama API request timeout (120s limit exceeded)"));
      });
      req.write(payload);
      req.end();
    });
  }

  async embeddings(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    const url = new URL("/v1/embeddings", this.baseUrl);

    const payload = JSON.stringify({
      model: options.model,
      input: options.input,
    });

    return new Promise<EmbeddingResponse>((resolve, reject) => {
      const startTime = Date.now();
      const req = http.request(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            const duration = Date.now() - startTime;
            if (duration > 10000 && process.env.DEBUG) {
               console.warn(`[Ollama] Slow embedding request: ${duration}ms`);
            }
            
            try {
              const body = Buffer.concat(chunks).toString("utf8");
              
              // Проверяем HTTP статус код
              if (res.statusCode && res.statusCode >= 400) {
                let errorMessage = `Ollama API error: HTTP ${res.statusCode}`;
                try {
                  const parsed = JSON.parse(body);
                  if (parsed.error) {
                    errorMessage = `Ollama API error: ${parsed.error.message || JSON.stringify(parsed.error)}`;
                  } else if (body) {
                    errorMessage = `Ollama API error: ${body}`;
                  }
                } catch {
                  if (body) {
                    errorMessage = `Ollama API error: ${body}`;
                  }
                }
                return reject(new Error(errorMessage));
              }

              const parsed = JSON.parse(body);

              // Проверяем наличие ошибки в ответе
              if (parsed.error) {
                return reject(new Error(`Ollama API error: ${parsed.error.message || JSON.stringify(parsed.error)}`));
              }

              const data = parsed.data;
              if (!Array.isArray(data) || data.length === 0) {
                return reject(
                  new Error(
                    `Unexpected Ollama embeddings response shape: нет data или data пустой. Ответ: ${JSON.stringify(parsed).substring(0, 500)}`,
                  ),
                );
              }
              const embeddings = data.map((item: any) => item.embedding as number[]);
              resolve({
                embeddings,
                usage: parsed.usage
                  ? {
                      promptTokens: parsed.usage.prompt_tokens ?? 0,
                      totalTokens: parsed.usage.total_tokens ?? 0,
                    }
                  : undefined,
              });
            } catch (err) {
              if (err instanceof SyntaxError) {
                return reject(new Error(`Ошибка парсинга JSON от Ollama: ${err.message}. Тело ответа: ${Buffer.concat(chunks).toString("utf8").substring(0, 500)}`));
              }
              reject(err);
            }
          });
        },
      );

      req.on("error", (err) => {
        reject(new Error(`Ошибка подключения к Ollama (${this.baseUrl}): ${err.message}`));
      });
      // Увеличиваем таймаут до 120 секунд для эмбеддингов
      req.setTimeout(120000, () => {
        req.destroy();
        reject(new Error("Ollama API request timeout (120s limit exceeded)"));
      });
      req.write(payload);
      req.end();
    });
  }

  async ping(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const url = new URL("/", this.baseUrl);
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(3000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }
}

