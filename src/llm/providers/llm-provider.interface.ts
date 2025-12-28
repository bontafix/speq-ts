/**
 * Абстракция для работы с различными LLM провайдерами.
 * Поддерживает Ollama, Groq, OpenAI и другие.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  message: {
    role: "assistant";
    content: string;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | undefined;
}

export interface EmbeddingOptions {
  model: string;
  input: string | string[];
}

export interface EmbeddingResponse {
  embeddings: number[][];
  usage?: {
    promptTokens: number;
    totalTokens: number;
  } | undefined;
}

/**
 * Базовый интерфейс LLM провайдера.
 */
export interface LLMProvider {
  readonly name: string;

  /**
   * Chat completion (текстовая генерация).
   */
  chat(options: ChatOptions): Promise<ChatResponse>;

  /**
   * Получение embeddings для текста.
   */
  embeddings(options: EmbeddingOptions): Promise<EmbeddingResponse>;

  /**
   * Health check провайдера.
   */
  ping(): Promise<boolean>;
}

