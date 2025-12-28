import http from "http";

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaChatOptions {
  model: string;
  messages: OllamaChatMessage[];
  temperature?: number;
}

export interface OllamaChatResponse {
  message: {
    role: "assistant";
    content: string;
  };
}

export interface OllamaEmbeddingOptions {
  model: string;
  input: string | string[];
}

export interface OllamaEmbeddingResponse {
  embeddings: number[][];
}

/**
 * Простой HTTP-клиент для обращения к локальному Ollama.
 * Без внешних SDK, максимально прозрачный.
 */
export class OllamaClient {
  constructor(private readonly baseUrl: string = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434") {}

  async chat(options: OllamaChatOptions): Promise<OllamaChatResponse> {
    const url = new URL("/v1/chat/completions", this.baseUrl);

    const payload = JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      stream: false,
    });

    return new Promise<OllamaChatResponse>((resolve, reject) => {
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
              const parsed = JSON.parse(body);
              const firstChoice = parsed.choices?.[0];
              const message = firstChoice?.message;
              if (!message || typeof message.content !== "string") {
                return reject(new Error("Unexpected Ollama response shape"));
              }
              resolve({ message });
            } catch (err) {
              reject(err);
            }
          });
        },
      );

      req.on("error", (err) => reject(err));
      req.write(payload);
      req.end();
    });
  }

  /**
   * Получение эмбеддингов через OpenAI-совместимый /v1/embeddings.
   * Используется для offline-обработки каталога (worker).
   */
  async embeddings(options: OllamaEmbeddingOptions): Promise<OllamaEmbeddingResponse> {
    const url = new URL("/v1/embeddings", this.baseUrl);

    const payload = JSON.stringify({
      model: options.model,
      input: options.input,
    });

    return new Promise<OllamaEmbeddingResponse>((resolve, reject) => {
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
              const parsed = JSON.parse(body);
              const data = parsed.data;
              if (!Array.isArray(data) || data.length === 0) {
                return reject(new Error("Unexpected Ollama embeddings response shape"));
              }
              const embeddings = data.map((item: any) => item.embedding as number[]);
              resolve({ embeddings });
            } catch (err) {
              reject(err);
            }
          });
        },
      );

      req.on("error", (err) => reject(err));
      req.write(payload);
      req.end();
    });
  }

  /**
   * Лёгкий health-check Ollama (без вызова моделей).
   * Просто проверяет, что HTTP-сервис доступен.
   */
  async ping(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const url = new URL("/", this.baseUrl);
      const req = http.get(url, (res) => {
        // Достаточно факта успешного подключения; тело не читаем.
        res.resume();
        resolve(true);
      });
      req.on("error", () => resolve(false));
    });
  }
}


