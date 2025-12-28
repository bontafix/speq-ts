import https from "https";
import type {
  LLMProvider,
  ChatOptions,
  ChatResponse,
  EmbeddingOptions,
  EmbeddingResponse,
} from "./llm-provider.interface";

/**
 * OpenAI провайдер — работает через официальный OpenAI API.
 * Поддерживает GPT-4, GPT-3.5-turbo и embeddings модели.
 * 
 * Документация: https://platform.openai.com/docs/api-reference
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.baseUrl = baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is required for OpenAIProvider");
    }
  }

  private buildUrl(path: string): URL {
    // OPENAI_BASE_URL по умолчанию содержит "/v1".
    // Если использовать new URL("/chat/completions", baseUrl), то "/v1" будет отброшен.
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
              const parsed = JSON.parse(body);

              if (parsed.error) {
                return reject(
                  new Error(`OpenAI API error: ${parsed.error.message || JSON.stringify(parsed.error)}`),
                );
              }

              const firstChoice = parsed.choices?.[0];
              const message = firstChoice?.message;
              if (!message || typeof message.content !== "string") {
                return reject(new Error("Unexpected OpenAI response shape"));
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
        reject(new Error("OpenAI API request timeout"));
      });
      req.write(payload);
      req.end();
    });
  }

  async embeddings(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    const url = this.buildUrl("/embeddings");

    const payload = JSON.stringify({
      model: options.model,
      input: options.input,
    });

    return new Promise<EmbeddingResponse>((resolve, reject) => {
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
              const parsed = JSON.parse(body);

              if (parsed.error) {
                return reject(
                  new Error(`OpenAI API error: ${parsed.error.message || JSON.stringify(parsed.error)}`),
                );
              }

              const data = parsed.data;
              if (!Array.isArray(data) || data.length === 0) {
                return reject(new Error("Unexpected OpenAI embeddings response shape"));
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
              reject(err);
            }
          });
        },
      );

      req.on("error", (err) => reject(err));
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error("OpenAI API request timeout"));
      });
      req.write(payload);
      req.end();
    });
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
            resolve(res.statusCode === 200);
          },
        );

        req.on("error", () => resolve(false));
        req.setTimeout(5000, () => {
          req.destroy();
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }
}

