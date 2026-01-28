#!/usr/bin/env ts-node

import "../config/env-loader";
import { LLMProviderFactory, ProviderType } from "../llm";

async function main() {
  console.log("=== LLM Health Check ===");
  console.log(`NODE_ENV=${process.env.NODE_ENV || "development"}`);

  const factory = new LLMProviderFactory();
  const config = factory.getConfig();
  const available = factory.getAvailableProviders();
  const health = await factory.checkHealth();

  console.log("\nТекущая конфигурация LLM провайдеров:");
  console.log(JSON.stringify(config, null, 2));

  console.log("\nИнициализированные провайдеры:");
  if (available.length === 0) {
    console.log("  — нет ни одного инициализированного провайдера");
  } else {
    available.forEach((p) => console.log(`  - ${p}`));
  }

  console.log("\nHealth-проверка провайдеров (ping):");
  (["groq", "openai", "ollama"] as ProviderType[]).forEach((name) => {
    const ok = health[name];
    if (ok === undefined) {
      console.log(`  - ${name}: не инициализирован (нет ключа или ошибка конструктора)`);
    } else {
      console.log(`  - ${name}: ${ok ? "✅ OK" : "❌ FAIL"}`);
    }
  });

  let exitCode = 0;

  console.log("\nПроверка готовности chat-провайдера (с учётом fallback):");
  try {
    await factory.ensureChatReady();
    console.log("  ✅ Chat провайдер готов к работе.");
  } catch (e: any) {
    exitCode = 1;
    console.error("  ❌ Chat провайдер НЕ готов:");
    console.error("     " + (e?.message ?? String(e)));
  }

  console.log("\nПроверка готовности embeddings-провайдера (с учётом ограничений):");
  try {
    await factory.ensureEmbeddingsReady();
    console.log("  ✅ Embeddings провайдер готов к работе.");
  } catch (e: any) {
    // Для embeddings не всегда критично, поэтому не меняем exitCode, а только предупреждаем.
    console.error("  ⚠️ Embeddings провайдер недоступен:");
    console.error("     " + (e?.message ?? String(e)));
  }

  console.log("\nПодсказки по конфигурации:");
  console.log("  - Чат-провайдер: LLM_CHAT_PROVIDER=groq|openai|ollama");
  console.log("  - Embeddings-провайдер: LLM_EMBEDDINGS_PROVIDER=ollama|openai (groq не поддерживает embeddings)");
  console.log("  - Общая модель для чата: LLM_MODEL=...");
  console.log("  - Модели по провайдерам: LLM_MODEL_GROQ / LLM_MODEL_OPENAI / LLM_MODEL_OLLAMA");
  console.log("  - Модель для embeddings: EMBED_MODEL=...");
  console.log("\nЗапустите эту команду в том же окружении, что и бот/API (те же переменные .env).");

  process.exit(exitCode);
}

main().catch((e) => {
  console.error("Неожиданная ошибка LLM health-check:", e);
  process.exit(1);
});

