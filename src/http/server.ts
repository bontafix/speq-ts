#!/usr/bin/env node

import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import { pgPool } from "../db/pg";
import { CatalogService } from "../catalog";
import { SearchEngine } from "../search";
import { EquipmentRepository } from "../repository/equipment.repository";
import { LLMProviderFactory, type ProviderType } from "../llm";
import type { SearchQuery } from "../catalog";
import { ParameterDictionaryService } from "../normalization";
import { handleUpdate, setWebhook, deleteWebhook, getWebhookInfo } from "../telegram";

const PORT = process.env.HTTP_PORT ? Number(process.env.HTTP_PORT) : 3000;

const app = express();

// Middleware для парсинга JSON
app.use(express.json());

// Middleware для логирования запросов (после парсинга JSON)
app.use((req: Request, _res: Response, next: NextFunction) => {
  const bodyStr = req.method === "POST" && req.body 
    ? JSON.stringify(req.body).substring(0, 200) 
    : undefined;
  
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    query: req.query,
    body: bodyStr,
    headers: {
      host: req.headers.host,
      "x-forwarded-for": req.headers["x-forwarded-for"],
      "x-real-ip": req.headers["x-real-ip"],
    },
  });
  next();
});

const llmFactory = new LLMProviderFactory();
const repository = new EquipmentRepository();

// Инициализируем словарь параметров для нормализации (опционально)
const dictionaryService = new ParameterDictionaryService();
// Загружаем словарь асинхронно при старте сервера
dictionaryService.loadDictionary().catch((error) => {
  console.warn("Не удалось загрузить словарь параметров. Нормализация параметров отключена.");
  console.warn(`Ошибка: ${error}`);
});

const searchEngine = new SearchEngine(repository, dictionaryService);
const catalogService = new CatalogService(searchEngine);

async function getHealth() {
  const db: { ok: boolean; error?: string } = { ok: false };
  const llmProviders: Record<string, boolean> = {};

  try {
    await pgPool.query("SELECT 1");
    db.ok = true;
  } catch (err) {
    db.error = String(err);
  }

  try {
    const health = await llmFactory.checkHealth();
    Object.assign(llmProviders, health);
  } catch (err) {
    // Игнорируем ошибки health check для LLM
  }

  const hasAnyLlm = Object.values(llmProviders).some((available) => available);
  const status = db.ok && hasAnyLlm ? "ok" : "degraded";

  const config = llmFactory.getConfig();
  return {
    status,
    db,
    llm: {
      providers: llmProviders,
      chatProvider: config.chatProvider,
      embeddingsProvider: config.embeddingsProvider,
      availableProviders: llmFactory.getAvailableProviders(),
      fallbackProviders: config.fallbackProviders,
    },
  };
}

function parseSearchQuery(req: Request): SearchQuery {
  const limitParam = req.query.limit;
  const limit = limitParam ? Number(limitParam) : undefined;

  const query: SearchQuery = {};

  const text = req.query.text;
  if (text && typeof text === "string") query.text = text;

  const category = req.query.category;
  if (category && typeof category === "string") query.category = category;

  const brand = req.query.brand;
  if (brand && typeof brand === "string") query.brand = brand;

  const region = req.query.region;
  if (region && typeof region === "string") query.region = region;

  if (limit !== undefined && !Number.isNaN(limit)) {
    query.limit = limit;
  }

  return query;
}

// Health check endpoint
app.get("/health", async (_req: Request, res: Response) => {
  const health = await getHealth();
  res.status(200).json(health);
});

// Search endpoint
app.get("/search", async (req: Request, res: Response) => {
  const query = parseSearchQuery(req);
  if (!query.text && !query.category && !query.brand) {
    res.status(400).json({
      error:
        "Укажите хотя бы один из параметров: text, category, brand (опционально: region, limit).",
    });
    return;
  }

  try {
    const result = await catalogService.searchEquipment(query);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: "Ошибка при выполнении поиска",
      details: String(err),
    });
  }
});

// LLM providers info endpoint
app.get("/llm/providers", async (_req: Request, res: Response) => {
  try {
    const health = await llmFactory.checkHealth();
    const config = llmFactory.getConfig();
    const available = llmFactory.getAvailableProviders();

    res.status(200).json({
      available,
      health,
      config: {
        chatProvider: config.chatProvider,
        embeddingsProvider: config.embeddingsProvider,
        fallbackProviders: config.fallbackProviders,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: "Ошибка при получении информации о провайдерах",
      details: String(err),
    });
  }
});

// LLM provider models endpoint
app.get("/llm/providers/models", async (req: Request, res: Response) => {
  const providerType = req.query.provider as ProviderType | null;

  if (!providerType) {
    res.status(400).json({
      error: "Укажите параметр provider (ollama, groq, openai)",
    });
    return;
  }

  try {
    const provider = llmFactory.getProvider(providerType);
    if (!provider) {
      res.status(404).json({
        error: `Провайдер ${providerType} не инициализирован`,
      });
      return;
    }

    // Для Groq используем специальный метод listModels
    if (providerType === "groq" && "listModels" in provider && typeof provider.listModels === "function") {
      const models = await (provider as any).listModels();
      res.status(200).json({
        provider: providerType,
        models,
      });
      return;
    }

    // Для других провайдеров возвращаем рекомендации
    const recommendations: Record<string, string[]> = {
      ollama: ["qwen2.5:7b-instruct-q4_K_M", "llama3.2:3b", "llama3.3:70b"],
      groq: ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x22b-instruct", "gemma2-9b-it"],
      openai: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
    };

    res.status(200).json({
      provider: providerType,
      models: recommendations[providerType] || [],
      note: "Это рекомендуемые модели. Для получения полного списка используйте API провайдера напрямую.",
    });
  } catch (err) {
    res.status(500).json({
      error: "Ошибка при получении списка моделей",
      details: String(err),
    });
  }
});

// Telegram webhook endpoint
app.post("/telegram/webhook", async (req: Request, res: Response) => {
  console.log("[Webhook] Получен запрос от Telegram");
  try {
    await handleUpdate(req.body);
    console.log("[Webhook] Обработка завершена успешно");
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[HTTP] Ошибка обработки webhook:", err);
    res.status(500).json({
      error: "Ошибка при обработке webhook",
      details: String(err),
    });
  }
});

// Set webhook endpoint
app.post("/telegram/webhook/set", async (req: Request, res: Response) => {
  try {
    const { webhookUrl } = req.body;

    if (!webhookUrl || typeof webhookUrl !== "string") {
      res.status(400).json({
        error: "Укажите webhookUrl в теле запроса",
      });
      return;
    }

    await setWebhook(webhookUrl);
    res.status(200).json({
      success: true,
      message: `Webhook установлен: ${webhookUrl}`,
    });
  } catch (err) {
    res.status(500).json({
      error: "Ошибка при установке webhook",
      details: String(err),
    });
  }
});

// Delete webhook endpoint
app.post("/telegram/webhook/delete", async (_req: Request, res: Response) => {
  try {
    await deleteWebhook();
    res.status(200).json({
      success: true,
      message: "Webhook удален",
    });
  } catch (err) {
    res.status(500).json({
      error: "Ошибка при удалении webhook",
      details: String(err),
    });
  }
});

// Get webhook info endpoint
app.get("/telegram/webhook/info", async (_req: Request, res: Response) => {
  try {
    const info = await getWebhookInfo();
    res.status(200).json(info);
  } catch (err) {
    res.status(500).json({
      error: "Ошибка при получении информации о webhook",
      details: String(err),
    });
  }
});

// Set LLM provider endpoint
app.post("/llm/providers/set", async (req: Request, res: Response) => {
  try {
    const { chatProvider, embeddingsProvider } = req.body;

    if (chatProvider) {
      // Важно: в этом проекте чат-провайдер фиксирован и не переключается.
      if (String(chatProvider).trim() !== "groq") {
        res.status(400).json({
          error: 'Смена chatProvider запрещена. Разрешён только "groq".',
        });
        return;
      }
      llmFactory.setChatProvider("groq");
    }
    if (embeddingsProvider) {
      llmFactory.setEmbeddingsProvider(embeddingsProvider as ProviderType);
    }

    const config = llmFactory.getConfig();
    res.status(200).json({
      success: true,
      config: {
        chatProvider: config.chatProvider,
        embeddingsProvider: config.embeddingsProvider,
      },
    });
  } catch (err) {
    res.status(400).json({
      error: "Ошибка при смене провайдера",
      details: String(err),
    });
  }
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "Not found",
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Express] Необработанная ошибка:", err);
  res.status(500).json({
    error: "Внутренняя ошибка сервера",
    details: String(err),
  });
});

// Start server
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `HTTP API запущен на порту ${PORT}. Маршруты:\n` +
    `  GET /health\n` +
    `  GET /search\n` +
    `  GET /llm/providers\n` +
    `  GET /llm/providers/models?provider=groq\n` +
    `  POST /llm/providers/set\n` +
    `  POST /telegram/webhook (webhook от Telegram)\n` +
    `  POST /telegram/webhook/set (установка webhook)\n` +
    `  POST /telegram/webhook/delete (удаление webhook)\n` +
    `  GET /telegram/webhook/info (информация о webhook)`,
  );
});


