import "dotenv/config";

export class ConfigService {
  get llm() {
    return {
      model: process.env.LLM_MODEL ?? "qwen2.5:7b-instruct-q4_K_M",
      embeddingModel: process.env.EMBED_MODEL ?? "nomic-embed-text",
      chatProvider: process.env.LLM_CHAT_PROVIDER ?? "ollama",
      embeddingsProvider: process.env.LLM_EMBEDDINGS_PROVIDER ?? "ollama",
      baseUrl: process.env.LLM_BASE_URL,
      apiKey: process.env.LLM_API_KEY,
      dialogMaxTurns: Number(process.env.LLM_DIALOG_MAX_TURNS) || 6,
    };
  }

  get db() {
    return {
      host: process.env.POSTGRES_HOST || "localhost",
      port: Number(process.env.POSTGRES_PORT) || 5432,
      user: process.env.POSTGRES_USER || "postgres",
      password: process.env.POSTGRES_PASSWORD || "postgres",
      database: process.env.POSTGRES_DB || "speq_db",
    };
  }

  validate(): void {
    const { chatProvider, apiKey } = this.llm;
    
    if (chatProvider === "ollama") {
      return;
    }

    if (chatProvider === "groq") {
      if (!apiKey && !process.env.GROQ_API_KEY) {
        console.warn("⚠️  Внимание: Вы используете Groq без явного API ключа (LLM_API_KEY или GROQ_API_KEY).");
      }
      return;
    }

    if (chatProvider === "openai") {
      if (!apiKey && !process.env.OPENAI_API_KEY) {
        console.warn("⚠️  Внимание: Вы используете OpenAI без явного API ключа (LLM_API_KEY или OPENAI_API_KEY).");
      }
      return;
    }

    // Generic fallback for other providers
    if (!apiKey) {
      console.warn(`⚠️  Внимание: Вы используете провайдер ${chatProvider} без явного API ключа (LLM_API_KEY).`);
    }
  }
}

