import "./env-loader";

export class ConfigService {
  get llm() {
    // В проекте чат-провайдер фиксирован: используем только Groq API.
    // Поэтому дефолтная chat-модель тоже должна быть Groq-совместимой.
    const defaultGroqChatModel = "llama-3.3-70b-versatile";
    return {
      model: process.env.LLM_MODEL ?? defaultGroqChatModel,
      embeddingModel: process.env.EMBED_MODEL ?? "nomic-embed-text",
      // В проекте чат-провайдер фиксирован: используем только Groq API.
      // Любые попытки переключить chat provider через ENV блокируются в validate().
      chatProvider: "groq",
      embeddingsProvider: process.env.LLM_EMBEDDINGS_PROVIDER ?? "ollama",
      baseUrl: process.env.LLM_BASE_URL,
      apiKey: process.env.LLM_API_KEY,
      dialogMaxTurns: Number(process.env.LLM_DIALOG_MAX_TURNS) || 6,
    };
  }

  get db() {
    return {
      host: process.env.DB_HOST || process.env.POSTGRES_HOST || process.env.PGHOST || "localhost",
      port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || process.env.PGPORT) || 5432,
      user: process.env.DB_USER || process.env.POSTGRES_USER || process.env.PGUSER || "postgres",
      password: process.env.DB_PASS || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || "postgres",
      database: process.env.DB_NAME || process.env.DB_DATABASE || process.env.POSTGRES_DB || process.env.PGDATABASE || "speq_db",
    };
  }

  validate(): void {
    const { apiKey } = this.llm;

    // Важно: чат-провайдер должен быть только Groq.
    // Если кто-то выставил LLM_CHAT_PROVIDER, то не даём тихо уйти на Ollama/OpenAI.
    const envChatProviderRaw = process.env.LLM_CHAT_PROVIDER?.trim();
    if (envChatProviderRaw && envChatProviderRaw !== "groq") {
      // Не падаем, чтобы не ломать запуск при старых конфигурациях.
      // Но явно предупреждаем: переменная будет проигнорирована.
      console.warn(
        `⚠️  LLM_CHAT_PROVIDER="${envChatProviderRaw}" будет проигнорирован. В этом проекте для чата используется только Groq API.`,
      );
    }
    
    // Частая ошибка: оставить LLM_MODEL от Ollama (в формате "model:tag"),
    // из-за чего Groq возвращает model_not_found.
    const envModel = process.env.LLM_MODEL?.trim();
    if (envModel && envModel.includes(":")) {
      console.warn(
        `⚠️  LLM_MODEL="${envModel}" выглядит как Ollama-модель (с ":"). Для Groq задайте модель из Groq каталога, например "llama-3.3-70b-versatile".`,
      );
    }

    if (!apiKey && !process.env.GROQ_API_KEY) {
      console.warn("⚠️  Внимание: Вы используете Groq без явного API ключа (LLM_API_KEY или GROQ_API_KEY).");
    }
  }
}

