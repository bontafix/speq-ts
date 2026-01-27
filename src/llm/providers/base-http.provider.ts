import http from 'http';
import https from 'https';
import { URL } from 'url';
import { LLMProvider, ChatOptions, ChatResponse, EmbeddingOptions, EmbeddingResponse } from './llm-provider.interface';

export abstract class BaseHTTPProvider implements LLMProvider {
  abstract readonly name: string;
  protected abstract defaultTimeout: number;

  /**
   * Выполняет HTTP/HTTPS запрос
   */
  protected async makeRequest(
    url: URL,
    method: 'GET' | 'POST',
    payload: string | null,
    headers: Record<string, string>,
    timeout?: number
  ): Promise<any> {
    const isHttps = url.protocol === 'https:';
    const requestModule = isHttps ? https : http;
    const requestTimeout = timeout ?? this.defaultTimeout;

    return new Promise((resolve, reject) => {
      const options: http.RequestOptions | https.RequestOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (payload) {
        options.headers = {
          ...options.headers,
          'Content-Length': Buffer.byteLength(payload),
        };
      }

      const req = requestModule.request(url, options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          
          // Проверяем HTTP статус код
          if (res.statusCode && res.statusCode >= 400) {
             let errorMsg = `HTTP ${res.statusCode}`;
             try {
               const parsed = JSON.parse(body);
               if (parsed.error) {
                 errorMsg = parsed.error.message || JSON.stringify(parsed.error);
               } else {
                 errorMsg = body; // Если нет поля error, берем все тело
               }
             } catch {
               errorMsg = body || errorMsg;
             }
             return reject(new Error(`${this.name} API error: ${errorMsg}`));
          }

          try {
            // Для пустых ответов (если бывают)
            if (!body && res.statusCode === 200) {
              return resolve({});
            }
            
            const parsed = JSON.parse(body);
            if (parsed.error) {
               return reject(new Error(`${this.name} API error: ${parsed.error.message || JSON.stringify(parsed.error)}`));
            }
            resolve(parsed);
          } catch (err) {
            reject(new Error(`Failed to parse response from ${this.name}: ${err instanceof Error ? err.message : String(err)}. Body: ${body.substring(0, 200)}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`${this.name} connection error: ${err.message}`)));
      
      req.setTimeout(requestTimeout, () => {
        req.destroy();
        reject(new Error(`${this.name} request timeout after ${requestTimeout}ms`));
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  /**
   * Хелпер для извлечения chat content из стандартного OpenAI-like ответа
   */
  protected extractChatResponse(response: any): ChatResponse {
    const firstChoice = response.choices?.[0];
    if (!firstChoice?.message?.content) {
      throw new Error(`Unexpected ${this.name} chat response shape: ${JSON.stringify(response).substring(0, 200)}`);
    }

    return {
      message: firstChoice.message,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens ?? 0,
        completionTokens: response.usage.completion_tokens ?? 0,
        totalTokens: response.usage.total_tokens ?? 0,
      } : undefined,
    };
  }

  /**
   * Хелпер для извлечения embeddings из стандартного OpenAI-like ответа
   */
  protected extractEmbeddingResponse(response: any): EmbeddingResponse {
    const data = response.data;
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`Unexpected ${this.name} embeddings response shape: ${JSON.stringify(response).substring(0, 200)}`);
    }

    return {
      embeddings: data.map((item: any) => item.embedding),
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens ?? 0,
        totalTokens: response.usage.total_tokens ?? 0,
      } : undefined,
    };
  }

  abstract chat(options: ChatOptions): Promise<ChatResponse>;
  abstract embeddings(options: EmbeddingOptions): Promise<EmbeddingResponse>;
  abstract ping(): Promise<boolean>;
}
