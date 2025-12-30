#!/usr/bin/env node

import "dotenv/config";
import http from "http";
import { pgPool } from "../db/pg";
import { CatalogService } from "../catalog";
import { SearchEngine } from "../search";
import { EquipmentRepository } from "../repository/equipment.repository";
import { LLMProviderFactory, type ProviderType } from "../llm";
import type { SearchQuery } from "../catalog";
import { ParameterDictionaryService } from "../normalization";

const PORT = process.env.HTTP_PORT ? Number(process.env.HTTP_PORT) : 3000;

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

function parseSearchQuery(url: URL): SearchQuery {
  const params = url.searchParams;
  const limitParam = params.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const query: SearchQuery = {};

  const text = params.get("text");
  if (text) query.text = text;

  const category = params.get("category");
  if (category) query.category = category;

  const subcategory = params.get("subcategory");
  if (subcategory) query.subcategory = subcategory;

  const brand = params.get("brand");
  if (brand) query.brand = brand;

  const region = params.get("region");
  if (region) query.region = region;

  if (limit !== undefined && !Number.isNaN(limit)) {
    query.limit = limit;
  }

  return query;
}

const server = http.createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (method === "GET" && url.pathname === "/health") {
    const health = await getHealth();
    const body = JSON.stringify(health, null, 2);
    res.statusCode = health.status === "ok" ? 200 : 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(body);
    return;
  }

  if (method === "GET" && url.pathname === "/search") {
    const query = parseSearchQuery(url);
    if (!query.text && !query.category && !query.brand) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify(
          {
            error:
              "Укажите хотя бы один из параметров: text, category, brand (опционально: subcategory, region, limit).",
          },
          null,
          2,
        ),
      );
      return;
    }

    try {
      const result = await catalogService.searchEquipment(query);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(result, null, 2));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify(
          {
            error: "Ошибка при выполнении поиска",
            details: String(err),
          },
          null,
          2,
        ),
      );
    }
    return;
  }

  // Эндпоинт для получения информации о провайдерах
  if (method === "GET" && url.pathname === "/llm/providers") {
    try {
      const health = await llmFactory.checkHealth();
      const config = llmFactory.getConfig();
      const available = llmFactory.getAvailableProviders();

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify(
          {
            available,
            health,
            config: {
              chatProvider: config.chatProvider,
              embeddingsProvider: config.embeddingsProvider,
              fallbackProviders: config.fallbackProviders,
            },
          },
          null,
          2,
        ),
      );
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify(
          {
            error: "Ошибка при получении информации о провайдерах",
            details: String(err),
          },
          null,
          2,
        ),
      );
    }
    return;
  }

  // Эндпоинт для получения списка моделей провайдера
  if (method === "GET" && url.pathname === "/llm/providers/models") {
    const providerType = url.searchParams.get("provider") as ProviderType | null;
    
    if (!providerType) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify(
          {
            error: "Укажите параметр provider (ollama, groq, openai)",
          },
          null,
          2,
        ),
      );
      return;
    }

    try {
      const provider = llmFactory.getProvider(providerType);
      if (!provider) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify(
            {
              error: `Провайдер ${providerType} не инициализирован`,
            },
            null,
            2,
          ),
        );
        return;
      }

      // Для Groq используем специальный метод listModels
      if (providerType === "groq" && "listModels" in provider && typeof provider.listModels === "function") {
        const models = await (provider as any).listModels();
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify(
            {
              provider: providerType,
              models,
            },
            null,
            2,
          ),
        );
        return;
      }

      // Для других провайдеров возвращаем рекомендации
      const recommendations: Record<string, string[]> = {
        ollama: ["qwen2.5:7b-instruct-q4_K_M", "llama3.2:3b", "llama3.3:70b"],
        groq: ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x22b-instruct", "gemma2-9b-it"],
        openai: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
      };

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify(
          {
            provider: providerType,
            models: recommendations[providerType] || [],
            note: "Это рекомендуемые модели. Для получения полного списка используйте API провайдера напрямую.",
          },
          null,
          2,
        ),
      );
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify(
          {
            error: "Ошибка при получении списка моделей",
            details: String(err),
          },
          null,
          2,
        ),
      );
    }
    return;
  }

  // Эндпоинт для смены провайдера (POST)
  if (method === "POST" && url.pathname === "/llm/providers/set") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        const { chatProvider, embeddingsProvider } = data;

        if (chatProvider) {
          // Важно: в этом проекте чат-провайдер фиксирован и не переключается.
          if (String(chatProvider).trim() !== "groq") {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify(
                {
                  error: 'Смена chatProvider запрещена. Разрешён только "groq".',
                },
                null,
                2,
              ),
            );
            return;
          }
          llmFactory.setChatProvider("groq");
        }
        if (embeddingsProvider) {
          llmFactory.setEmbeddingsProvider(embeddingsProvider as ProviderType);
        }

        const config = llmFactory.getConfig();
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify(
            {
              success: true,
              config: {
                chatProvider: config.chatProvider,
                embeddingsProvider: config.embeddingsProvider,
              },
            },
            null,
            2,
          ),
        );
      } catch (err) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify(
            {
              error: "Ошибка при смене провайдера",
              details: String(err),
            },
            null,
            2,
          ),
        );
      }
    });
    return;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(
    JSON.stringify(
      {
        error: "Not found",
      },
      null,
      2,
    ),
  );
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `HTTP API запущен на порту ${PORT}. Маршруты: GET /health, GET /search, GET /llm/providers, GET /llm/providers/models?provider=groq, POST /llm/providers/set`,
  );
});


